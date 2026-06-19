import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Per-day meal store (energy in) with photos, on a rolling 7-day window.
// GET also purges anything older than the window (meals rows + their photos +
// daily_energy) — lazy cleanup on app open. Self-contained (no ../src imports).
const USER_ID = process.env.APP_USER_ID || "a1b2c3d4-0000-4000-8000-000000000001";
const BUCKET = "meal-photos";
const WINDOW = 7;

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function cutoff() {
  const d = new Date();
  d.setDate(d.getDate() - (WINDOW - 1));
  return ymd(d); // oldest day we keep
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      res.status(500).json({ error: "Supabase not configured." });
      return;
    }
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
    const cut = cutoff();

    if (req.method === "GET") {
      // ---- purge data older than the 7-day window ----
      const { data: old } = await sb.from("meals").select("id, photo_path").eq("user_id", USER_ID).lt("date", cut);
      if (old && old.length) {
        const paths = old.map((o: any) => o.photo_path).filter(Boolean);
        if (paths.length) await sb.storage.from(BUCKET).remove(paths);
        await sb.from("meals").delete().eq("user_id", USER_ID).lt("date", cut);
      }
      await sb.from("daily_energy").delete().eq("user_id", USER_ID).lt("date", cut);

      // ---- window meals, photos returned as data URLs (avoids canvas CORS taint) ----
      const { data: meals } = await sb.from("meals").select("*").eq("user_id", USER_ID).gte("date", cut).order("created_at", { ascending: true });
      const out: any[] = [];
      for (const m of meals || []) {
        let img: string | null = null;
        if (m.photo_path) {
          const { data: file } = await sb.storage.from(BUCKET).download(m.photo_path);
          if (file) {
            const buf = Buffer.from(await file.arrayBuffer());
            img = `data:${(file as any).type || "image/jpeg"};base64,${buf.toString("base64")}`;
          }
        }
        out.push({ id: m.id, date: m.date, name: m.name, kcal: m.kcal, p: m.p, c: m.c, f: m.f, img });
      }
      const { data: energy } = await sb.from("daily_energy").select("date, total_kcal").eq("user_id", USER_ID).gte("date", cut);
      res.status(200).json({ meals: out, energy: energy || [], cutoff: cut, today: ymd(new Date()) });
      return;
    }

    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const date = String(b.date || ymd(new Date())).slice(0, 10);
      if (date < cut) {
        res.status(400).json({ error: "That day is outside the 7-day window." });
        return;
      }
      const row: any = { name: b.name || "Meal", kcal: b.kcal || 0, p: b.p || 0, c: b.c || 0, f: b.f || 0 };

      // edit existing meal (id present) vs create new
      if (b.id) {
        await sb.from("meals").update(row).eq("id", b.id).eq("user_id", USER_ID);
        res.status(200).json({ id: b.id, date });
        return;
      }

      // optional photo → upload to the bucket, store its path
      if (b.photoDataUrl) {
        const mt = /^data:(.+?);base64,(.*)$/.exec(b.photoDataUrl);
        if (mt) {
          const path = `${USER_ID}/${date}/${randomUUID()}.jpg`;
          await sb.storage.from(BUCKET).upload(path, Buffer.from(mt[2], "base64"), { contentType: mt[1] || "image/jpeg", upsert: true });
          row.photo_path = path;
        }
      }
      const { data, error } = await sb.from("meals").insert({ user_id: USER_ID, date, ...row }).select("id").single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ id: data.id, date });
      return;
    }

    if (req.method === "DELETE") {
      const id = req.query.id as string | undefined;
      if (!id) {
        res.status(400).json({ error: "Missing id." });
        return;
      }
      const { data: m } = await sb.from("meals").select("photo_path").eq("id", id).eq("user_id", USER_ID).maybeSingle();
      if (m?.photo_path) await sb.storage.from(BUCKET).remove([m.photo_path]);
      await sb.from("meals").delete().eq("id", id).eq("user_id", USER_ID);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "meals_failed" });
  }
}
