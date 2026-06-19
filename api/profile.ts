import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Profile + BMR. Weight/sex come from Strava on connect; height/age are entered
// in onboarding here. BMR via Mifflin-St Jeor. Self-contained.
const USER_ID = process.env.APP_USER_ID || "a1b2c3d4-0000-4000-8000-000000000001";

function bmrMifflin(sex: string | null, weightKg: number, heightCm: number, age: number) {
  const bias = (sex || "M").toUpperCase().startsWith("F") ? -161 : 5;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + bias);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      res.status(500).json({ error: "Supabase not configured." });
      return;
    }
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

    if (req.method === "GET") {
      const { data } = await sb.from("profile").select("sex, weight_kg, height_cm, age, measurement_pref, bmr").eq("user_id", USER_ID).maybeSingle();
      res.status(200).json(data || {});
      return;
    }

    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { data: cur } = await sb.from("profile").select("sex, weight_kg").eq("user_id", USER_ID).maybeSingle();
      const weight = Number(b.weight_kg ?? cur?.weight_kg);
      const height = Number(b.height_cm);
      const age = Number(b.age);
      const sex = cur?.sex ?? b.sex ?? "M";
      const update: any = { user_id: USER_ID, updated_at: new Date().toISOString() };
      if (b.weight_kg != null) update.weight_kg = weight;
      if (b.height_cm != null) update.height_cm = height;
      if (b.age != null) update.age = age;
      if (weight && height && age) update.bmr = bmrMifflin(sex, weight, height, age);
      await sb.from("profile").upsert(update);
      res.status(200).json({ ok: true, bmr: update.bmr ?? null });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "profile_failed" });
  }
}
