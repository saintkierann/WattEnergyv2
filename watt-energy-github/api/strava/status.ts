import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Tells the app whether Strava is connected and whether profile onboarding
// (height + age) is still needed. Read on app load.
const USER_ID = process.env.APP_USER_ID || "a1b2c3d4-0000-4000-8000-000000000001";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      res.status(200).json({ connected: false, configured: false });
      return;
    }
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
    const { data: acct } = await supa
      .from("strava_account")
      .select("athlete_name, athlete_id")
      .eq("user_id", USER_ID)
      .maybeSingle();
    const { data: prof } = await supa
      .from("profile")
      .select("weight_kg, sex, height_cm, age")
      .eq("user_id", USER_ID)
      .maybeSingle();

    res.status(200).json({
      configured: true,
      connected: !!acct,
      athleteName: acct?.athlete_name ?? null,
      weight_kg: prof?.weight_kg ?? null,
      sex: prof?.sex ?? null,
      needsProfile: !!acct && (prof?.height_cm == null || prof?.age == null),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "status_failed" });
  }
}
