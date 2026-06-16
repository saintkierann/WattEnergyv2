import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeMealCore } from "../src/server/analyzeMeal";

// Vercel serverless function: the production meal-scanner proxy.
// Holds ANTHROPIC_API_KEY (set in the Vercel project env vars) so the key
// never reaches the browser.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const { status, json } = await analyzeMealCore(body);
  res.status(status).json(json);
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
