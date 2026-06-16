import Anthropic from "@anthropic-ai/sdk";
import { ANALYZE_PROMPT } from "./prompt";

// Current vision-capable model. Override per-deployment with ANTHROPIC_MODEL
// (e.g. claude-sonnet-4-6 / claude-haiku-4-5 for lower cost per scan).
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface AnalyzeInput {
  imageBase64?: string;
  mediaType?: string;
}

export interface AnalyzeResult {
  status: number;
  json: unknown;
}

function extractJSON(text: string): any {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s !== -1 && e !== -1) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

// Coerce the model output into the shape the client expects, defending against
// missing fields so the review screen never crashes on a partial reply.
function normalize(d: any) {
  const num = (v: any) => Math.max(0, Math.round(Number(v) || 0));
  const base = d?.base || {};
  return {
    title: typeof d?.title === "string" ? d.title : "Meal",
    items: Array.isArray(d?.items)
      ? d.items.map((it: any) => ({ n: String(it?.n ?? ""), kcal: num(it?.kcal) }))
      : [],
    base: { kcal: num(base.kcal), p: num(base.p), c: num(base.c), f: num(base.f) },
    confidence: ["low", "medium", "high"].includes(d?.confidence) ? d.confidence : "medium",
    note: typeof d?.note === "string" ? d.note : "",
    questions: Array.isArray(d?.questions)
      ? d.questions.slice(0, 5).map((q: any) => ({
          q: String(q?.q ?? ""),
          why: String(q?.why ?? ""),
          opts: Array.isArray(q?.opts)
            ? q.opts.map((o: any) => ({
                l: String(o?.l ?? ""),
                kcal: num(o?.kcal),
                p: num(o?.p),
                c: num(o?.c),
                f: num(o?.f),
              }))
            : [],
        }))
      : [],
  };
}

export async function analyzeMealCore(input: AnalyzeInput): Promise<AnalyzeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      status: 500,
      json: { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local (local) or your Vercel project env vars, then redeploy. You can still enter macros manually." },
    };
  }

  const imageBase64 = input?.imageBase64;
  const mediaType = input?.mediaType || "image/jpeg";
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return { status: 400, json: { error: "Missing image data." } };
  }
  if (!ALLOWED_MEDIA.includes(mediaType)) {
    return { status: 400, json: { error: "Unsupported image type." } };
  }
  // Guard against oversized payloads (base64 is ~1.33x the byte size).
  if (imageBase64.length > 9_000_000) {
    return { status: 413, json: { error: "Image is too large — try a smaller photo." } };
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as any, data: imageBase64 },
            },
            { type: "text", text: ANALYZE_PROMPT },
          ],
        },
      ],
    });

    if (String(message.stop_reason) === "refusal") {
      return { status: 422, json: { error: "The reader declined this image. Try another photo of your meal, or enter macros manually." } };
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!text.trim()) {
      return { status: 502, json: { error: "Empty reply from the model. Try again, or enter macros manually." } };
    }

    let parsed: any;
    try {
      parsed = extractJSON(text);
    } catch {
      return { status: 502, json: { error: "Couldn't parse the reading (response may have been cut off). Try again." } };
    }

    return { status: 200, json: normalize(parsed) };
  } catch (err: any) {
    const msg = err?.message || "unknown error";
    const status = typeof err?.status === "number" ? err.status : 502;
    return { status, json: { error: "Reader failed: " + msg } };
  }
}
