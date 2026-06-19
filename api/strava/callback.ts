import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Step 2 of Strava OAuth: exchange the code for tokens, pull the detailed
// athlete (weight + sex), store both in Supabase, then return to the app.
// Self-contained on purpose (no ../src imports — they break Vercel bundling).
const USER_ID = process.env.APP_USER_ID || "a1b2c3d4-0000-4000-8000-000000000001";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const base = process.env.APP_BASE_URL || "https://watt-energyv2.vercel.app";
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      res.redirect(`${base}/?strava=error&msg=no_code`);
      return;
    }

    // Exchange authorization code for tokens.
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });
    const tok: any = await tokenRes.json();
    if (!tok?.access_token) {
      res.redirect(`${base}/?strava=error&msg=${encodeURIComponent(tok?.message || "token_exchange_failed")}`);
      return;
    }

    // Detailed athlete (weight + sex require the profile:read_all scope).
    const aRes = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const ath: any = await aRes.json();

    const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

    await supa.from("strava_account").upsert({
      user_id: USER_ID,
      athlete_id: ath?.id ?? tok?.athlete?.id ?? null,
      athlete_name: [ath?.firstname, ath?.lastname].filter(Boolean).join(" ") || null,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: tok.expires_at,
      updated_at: new Date().toISOString(),
    });

    // Upsert only the Strava-sourced profile fields; height/age (set later in
    // onboarding) are not in this payload, so they're preserved on conflict.
    await supa.from("profile").upsert({
      user_id: USER_ID,
      sex: ath?.sex ?? null,
      weight_kg: ath?.weight ?? null,
      measurement_pref: ath?.measurement_preference ?? null,
      updated_at: new Date().toISOString(),
    });

    res.redirect(`${base}/?strava=connected`);
  } catch (e: any) {
    res.redirect(`${base}/?strava=error&msg=${encodeURIComponent(e?.message || "unknown")}`);
  }
}
