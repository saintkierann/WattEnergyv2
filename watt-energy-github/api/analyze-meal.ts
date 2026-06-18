import type { VercelRequest, VercelResponse } from "@vercel/node";

// Reasoning (adaptive thinking) makes a scan take longer than the 10s default,
// so give the function headroom. Vercel honors this up to the plan's ceiling.
export const maxDuration = 60;

/* ============================================================================
   Vercel serverless function: the production meal-scanner proxy.
   SELF-CONTAINED on purpose — it imports only the Anthropic SDK (a real npm
   dep Vercel always bundles) and inlines the prompt + logic. Importing across
   directories (../src/server) under an ESM ("type":"module") project made
   Vercel's function bundler fail at load time (FUNCTION_INVOCATION_FAILED).
   The SDK is lazy-loaded and everything is wrapped so any failure returns
   readable JSON instead of a hard 500 crash.
   NOTE: src/server/* mirrors this logic for the local `vite dev` middleware;
   this file is the production source of truth — keep the prompt in sync.
   ========================================================================== */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const ANALYZE_PROMPT = `You are a precise sports-nutrition estimator for an endurance athlete. Analyze the food photo.
Return ONLY valid JSON. No markdown, no code fences, no preamble.
Schema:
{"title":"short meal name (max 5 words)","items":[{"n":"food","kcal":int}],"base":{"kcal":int,"p":int,"c":int,"f":int},"confidence":"low"|"medium"|"high","note":"short caveat (max 18 words)","questions":[{"q":"short question","why":"why it's commonly missed","opts":[{"l":"label","kcal":0,"p":0,"c":0,"f":0}]}]}

METHOD — estimate bottom-up, the way a dietitian logs a meal, never a single eyeballed guess:
1. Identify each distinct food/component on the plate.
2. For each, estimate the PORTION IN GRAMS using visible scale cues — plate/bowl diameter (a dinner plate ≈ 27cm), fork/spoon size, hand, the food's own depth and how much of the plate it covers. Be realistic for an adult athlete; do not lowball.
3. For each, apply a per-100g macro density (protein/carb/fat grams per 100g for that food) and compute that item's grams of protein, carb, fat from its portion.
4. Sum protein, carb, fat across ALL items → these are "base" p/c/f.
5. Compute base.kcal = 4·protein + 4·carb + 9·fat (the Atwater rule). The total is DERIVED from the macros, not guessed.

PRECISION — your output must look like a database sum, not a guess:
- Do NOT round totals to multiples of 5, 10, 25, 50, or 100. Report the actual computed figure (e.g. 623, not 600; 418, not 400).
- base.kcal MUST equal 4·p + 4·c + 9·f within ±3%. If it doesn't, you made an arithmetic error — recompute.
- Each item's "kcal" is that item's own computed calories; the item kcals should sum to roughly base.kcal.

Rules:
- Do the per-item gram estimation in your reasoning before writing JSON. Do NOT lowball dense staple carbs (rice, pasta, potato, oats, bread) — use realistic athlete portions. A microwave rice pouch ≈ 350 kcal / 73g carb per 250g; a restaurant rice serving is often 1.5–2 pouches. Assume minimal added fats/oils unless visible, but for starchy carbs lean toward the larger realistic portion. p/c/f in grams.
- 3-4 "questions" on UNDERCOUNTED calories. If a starchy staple is present, ALWAYS include one question on its portion (offer microwave-pouch and large/restaurant options). Then cover the most relevant of: cooking oil/method, butter/spreads, dressings/sauces, drinks.
- Each question has 4-5 "opts" forming a graduated scale by CONCRETE QUANTITY. The FIRST opt is the neutral default with all deltas 0 (it is already counted in base), but its LABEL MUST STILL STATE THE CONCRETE AMOUNT you assumed — e.g. "As shown ~250g" for a portion already on the plate, or "None (0 tsp)" where nothing extra is added. NEVER label it bare "As shown" or "None" without a number. EVERY opt label (including the first) must carry its quantity. Others ADD realistic, NON-conservative deltas. LABELS MUST be quantity-based: grams for foods/carbs/protein, tsp/tbsp for oils, butter, dressings, sauces. NEVER use vague words like light/medium/heavy. Examples:
  · cooking oil → "1 tsp" (+40, fat 4.5) / "1 tbsp" (+120, fat 14) / "2 tbsp" (+240, fat 28) / "3 tbsp" (+360, fat 42)
  · butter → "1 tsp" (+35, fat 4) / "1 tbsp" (+100, fat 11) / "2 tbsp" (+200, fat 22)
  · dressing/sauce → "1 tbsp" / "2 tbsp" / "3 tbsp" with realistic deltas and matching fat/carb grams
  · rice/pasta/potato portion → "+125g" (+165, carb 28) / "+250g (1 pouch)" (+330, carb 73) / "+400g" (+520, carb 115) / "+500g (2 pouches)" (+660, carb 145)
  Set p/c/f on each opt to match the quantity. Keep labels short (the gram or tbsp amount leads).
If not food: {"title":"Not food","items":[],"base":{"kcal":0,"p":0,"c":0,"f":0},"confidence":"low","note":"That doesn't look like food — try a photo of your meal.","questions":[]}`;

function extractJSON(text: string): any {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"),
    e = t.lastIndexOf("}");
  if (s !== -1 && e !== -1) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

function normalize(d: any) {
  const num = (v: any) => Math.max(0, Math.round(Number(v) || 0));
  const base = d?.base || {};
  const p = num(base.p), c = num(base.c), f = num(base.f);
  // Enforce the Atwater rule server-side: the calorie total must agree with its
  // macros. This guarantees an internally-consistent, non-rounded number even if
  // the model's stated kcal drifts — the source of the "always 550/600" feel.
  const kcalFromMacros = 4 * p + 4 * c + 9 * f;
  const statedKcal = num(base.kcal);
  const kcal =
    statedKcal > 0 && Math.abs(statedKcal - kcalFromMacros) / statedKcal <= 0.12
      ? statedKcal
      : kcalFromMacros;
  return {
    title: typeof d?.title === "string" ? d.title : "Meal",
    items: Array.isArray(d?.items) ? d.items.map((it: any) => ({ n: String(it?.n ?? ""), kcal: num(it?.kcal) })) : [],
    base: { kcal, p, c, f },
    confidence: ["low", "medium", "high"].includes(d?.confidence) ? d.confidence : "medium",
    note: typeof d?.note === "string" ? d.note : "",
    questions: Array.isArray(d?.questions)
      ? d.questions.slice(0, 5).map((q: any) => ({
          q: String(q?.q ?? ""),
          why: String(q?.why ?? ""),
          opts: Array.isArray(q?.opts) ? q.opts.map((o: any) => ({ l: String(o?.l ?? ""), kcal: num(o?.kcal), p: num(o?.p), c: num(o?.c), f: num(o?.f) })) : [],
        }))
      : [],
  };
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Add it in the Vercel project's Environment Variables (Production) and redeploy. You can still enter macros manually." });
      return;
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const imageBase64: string | undefined = body?.imageBase64;
    const mediaType: string = body?.mediaType || "image/jpeg";

    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "Missing image data." });
      return;
    }
    if (!ALLOWED_MEDIA.includes(mediaType)) {
      res.status(400).json({ error: "Unsupported image type." });
      return;
    }
    if (imageBase64.length > 9_000_000) {
      res.status(413).json({ error: "Image is too large — try a smaller photo." });
      return;
    }

    // Lazy-load so a module-load issue can never crash the whole function.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    // Adaptive thinking + high effort: the model reasons through per-item portion
    // sizes and macro densities before answering, which is what drives accuracy.
    // Thinking output counts toward max_tokens, so the budget is raised and the
    // request is streamed (non-streaming can time out at this output size).
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as any, data: imageBase64 } },
            { type: "text", text: ANALYZE_PROMPT },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();

    if (String(message.stop_reason) === "refusal") {
      res.status(422).json({ error: "The reader declined this image. Try another photo of your meal, or enter macros manually." });
      return;
    }

    const text = message.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    if (!text.trim()) {
      res.status(502).json({ error: "Empty reply from the model. Try again, or enter macros manually." });
      return;
    }

    let parsed: any;
    try {
      parsed = extractJSON(text);
    } catch {
      res.status(502).json({ error: "Couldn't parse the reading (response may have been cut off). Try again." });
      return;
    }

    res.status(200).json(normalize(parsed));
  } catch (err: any) {
    // Convert any unexpected failure into readable JSON (never a hard crash).
    const status = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({ error: "Reader failed: " + (err?.message || "unknown error") });
  }
}
