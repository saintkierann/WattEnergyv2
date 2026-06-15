import type { MealData } from "../types";

// Calls the serverless proxy (Vercel function in prod, Vite middleware in dev).
// The Anthropic key never reaches the browser.
export async function analyzeMeal(imageBase64: string, mediaType: string): Promise<MealData> {
  const res = await fetch("/api/analyze-meal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mediaType }),
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error("Bad response (HTTP " + res.status + ")");
  }
  if (!res.ok || (json && json.error)) {
    throw new Error((json && json.error) || "HTTP " + res.status);
  }
  return json as MealData;
}
