import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Backfills the last 7 days of energy OUT into daily_energy:
//   base_kcal     = BMR × 1.2 (resting + normal daily living)
//   activity_kcal = that day's Strava activity calories
//   total_kcal    = base + activity
// Refreshes the Strava token if expired. Self-contained.
const USER_ID = process.env.APP_USER_ID || "a1b2c3d4-0000-4000-8000-000000000001";
const WINDOW = 7;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      res.status(500).json({ error: "Supabase not configured." });
      return;
    }
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
    const { data: acct } = await sb.from("strava_account").select("*").eq("user_id", USER_ID).maybeSingle();
    if (!acct) {
      res.status(400).json({ error: "Strava not connected." });
      return;
    }
    const { data: prof } = await sb.from("profile").select("bmr").eq("user_id", USER_ID).maybeSingle();
    const base = prof?.bmr ? Math.round(prof.bmr * 1.2) : 0;

    // refresh the access token if it's expired (or about to)
    let access = acct.access_token as string;
    if (!acct.expires_at || acct.expires_at <= Math.floor(Date.now() / 1000) + 120) {
      const rr = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: acct.refresh_token }),
      });
      const tok: any = await rr.json();
      if (tok?.access_token) {
        access = tok.access_token;
        await sb.from("strava_account").update({ access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: tok.expires_at, updated_at: new Date().toISOString() }).eq("user_id", USER_ID);
      }
    }

    // pull activities in the window, sum calories per local day
    const after = Math.floor((Date.now() - WINDOW * 86400000) / 1000);
    const listRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`, { headers: { Authorization: `Bearer ${access}` } });
    const acts: any = await listRes.json();
    const byDay: Record<string, number> = {};
    if (Array.isArray(acts)) {
      let n = 0;
      for (const a of acts) {
        if (n++ > 40) break;
        const day = String(a.start_date_local || a.start_date || "").slice(0, 10);
        if (!day) continue;
        let cal = typeof a.calories === "number" ? a.calories : 0;
        if (!cal) {
          // calories live on the detailed activity; fall back to kilojoules (≈ kcal for rides)
          const dRes = await fetch(`https://www.strava.com/api/v3/activities/${a.id}`, { headers: { Authorization: `Bearer ${access}` } });
          const det: any = await dRes.json();
          cal = typeof det?.calories === "number" ? det.calories : typeof det?.kilojoules === "number" ? det.kilojoules : 0;
        }
        byDay[day] = (byDay[day] || 0) + Math.round(cal);
      }
    }

    const dates = Array.from({ length: WINDOW }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return ymd(d);
    });
    const rows = dates.map((date) => ({ user_id: USER_ID, date, base_kcal: base, activity_kcal: byDay[date] || 0, total_kcal: base + (byDay[date] || 0), updated_at: new Date().toISOString() }));
    await sb.from("daily_energy").upsert(rows, { onConflict: "user_id,date" });

    res.status(200).json({ ok: true, base, days: rows.map((r) => ({ date: r.date, activity: r.activity_kcal, total: r.total_kcal })) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "sync_failed" });
  }
}
