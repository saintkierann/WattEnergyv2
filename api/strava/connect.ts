import type { VercelRequest, VercelResponse } from "@vercel/node";

// Step 1 of Strava OAuth: send the user to Strava's authorize page.
// Self-contained (no cross-directory imports — those break Vercel's bundler).
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: "Server missing STRAVA_CLIENT_ID env var." });
    return;
  }
  const base = process.env.APP_BASE_URL || "https://watt-energyv2.vercel.app";
  const redirectUri = `${base}/api/strava/callback`;
  const scope = "read,activity:read_all,profile:read_all";
  const url =
    "https://www.strava.com/oauth/authorize?" +
    `client_id=${clientId}` +
    "&response_type=code" +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&approval_prompt=auto" +
    `&scope=${encodeURIComponent(scope)}`;
  res.redirect(url);
}
