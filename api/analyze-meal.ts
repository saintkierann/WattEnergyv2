import type { VercelRequest, VercelResponse } from "@vercel/node";

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
Rules:
- "base" = realistic estimate of what's visible. Do NOT lowball dense staple carbs (rice, pasta, potato, oats, bread) — use generous athlete portions. A microwave rice pouch ≈ 350 kcal / 73g carb per 250g; a restaurant rice serving is often 1.5–2 pouches. Assume minimal added fats/oils unless visible, but for starchy carbs lean toward the larger realistic portion. p/c/f in grams.
- 3-4 "questions" on UNDERCOUNTED calories. If a starchy staple is present, ALWAYS include one question on its portion (offer microwave-pouch and large/restaurant options). Then cover the most relevant of: cooking oil/method, butter/spreads, dressings/sauces, drinks.
- Each question has 4-5 "opts" forming a graduated scale by CONCRETE QUANTITY. FIRST opt = neutral default (all 0, label like "As shown" or "None"). Others ADD realistic, NON-conservative deltas. LABELS MUST be quantity-based: grams for foods/carbs/protein, tsp/tbsp for oils, butter, dressings, sauces. NEVER use vague words like light/medium/heavy. Examples:
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
  return {
    title: typeof d?.title === "string" ? d.title : "Meal",
    items: Array.isArray(d?.items) ? d.items.map((it: any) => ({ n: String(it?.n ?? ""), kcal: num(it?.kcal) })) : [],
    base: { kcal: num(base.kcal), p: num(base.p), c: num(base.c), f: num(base.f) },
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

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
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
