import type { RenderProps } from "../types";
import {
  INK,
  BONE,
  PAPER,
  MUT,
  LINE,
  MP_L,
  MC_L,
  MF_L,
  MF_D,
  BRAND,
  macros,
  rr,
  T,
  meas,
  cover,
  ring,
  wordmark,
} from "../lib/canvas";

/* ---------- CARD renderers (1080x1920) ---------- */
export function drawCard(ctx: CanvasRenderingContext2D, style: string, p: RenderProps) {
  const W = 1080,
    H = 1920,
    t = p.totals;
  ctx.fillStyle = BONE;
  ctx.fillRect(0, 0, W, H);

  if (style === "spotlight") {
    const M = macros(t, true);
    if (p.img) cover(ctx, p.img, 0, 0, W, H);
    const g = ctx.createLinearGradient(0, 720, 0, H);
    g.addColorStop(0, "rgba(12,11,8,0)");
    g.addColorStop(0.55, "rgba(12,11,8,0.78)");
    g.addColorStop(1, "rgba(12,11,8,0.96)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 720, W, H - 720);
    wordmark(ctx, 80, 80, BONE);
    T(ctx, (p.title || "Meal").toUpperCase(), 80, 1430, 34, 800, BONE, "left", "top", 2);
    T(ctx, t.kcal.toLocaleString(), 80, 1620, 168, 900, BONE, "left", "alphabetic");
    const nw = meas(ctx, t.kcal.toLocaleString(), 168, 900);
    T(ctx, "KCAL", 80 + nw + 22, 1620, 48, 800, "rgba(244,241,233,0.6)", "left", "alphabetic", 1);
    const pw = (W - 160 - 48) / 3,
      ph = 150,
      py = 1700;
    M.forEach((m, i) => {
      const px = 80 + i * (pw + 24);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      rr(ctx, px, py, pw, ph, 26);
      ctx.fill();
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(px + 34, py + 40, 11, 0, Math.PI * 2);
      ctx.fill();
      T(ctx, m.g + "g", px + 30, py + 60, 50, 800, BONE);
      T(ctx, m.label, px + 30, py + 112, 22, 700, "rgba(244,241,233,0.6)", "left", "top", 1);
    });
  } else if (style === "frame") {
    const M = macros(t, false);
    wordmark(ctx, W / 2 - meas(ctx, BRAND, 24, 800, 3) / 2 - 14, 80, INK);
    T(ctx, (p.title || "Meal").toUpperCase(), W / 2, 150, 30, 800, INK, "center", "top", 2);
    ctx.save();
    ctx.shadowColor = "rgba(22,20,15,0.22)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = PAPER;
    rr(ctx, 80, 240, 920, 920, 40);
    ctx.fill();
    ctx.restore();
    if (p.img) cover(ctx, p.img, 80, 240, 920, 920, 40);
    ctx.strokeStyle = "rgba(22,20,15,0.12)";
    ctx.lineWidth = 2;
    rr(ctx, 80, 240, 920, 920, 40);
    ctx.stroke();
    T(ctx, t.kcal.toLocaleString(), W / 2, 1330, 150, 900, INK, "center", "alphabetic");
    T(ctx, "KCAL", W / 2, 1400, 34, 700, MUT, "center", "top", 4);
    const cxs = [260, 540, 820];
    M.forEach((m, i) => {
      T(ctx, m.g + "g", cxs[i], 1500, 66, 900, m.color, "center", "top");
      T(ctx, m.label, cxs[i], 1582, 26, 700, MUT, "center", "top", 1);
    });
  } else if (style === "dashboard") {
    const M = macros(t, false);
    const maxE = Math.max(...M.map((m) => m.e)) || 1;
    wordmark(ctx, 80, 90, INK);
    if (p.img) cover(ctx, p.img, 770, 70, 230, 230, 30);
    else {
      ctx.fillStyle = PAPER;
      rr(ctx, 770, 70, 230, 230, 30);
      ctx.fill();
    }
    T(ctx, (p.title || "Meal").toUpperCase(), 80, 320, 38, 800, INK, "left", "top", 1);
    T(ctx, t.kcal.toLocaleString(), 80, 600, 200, 900, INK, "left", "alphabetic");
    const nw = meas(ctx, t.kcal.toLocaleString(), 200, 900);
    T(ctx, "KCAL", 80 + nw + 24, 600, 50, 800, MUT, "left", "alphabetic", 1);
    T(ctx, "ESTIMATED CALORIES", 80, 630, 30, 700, MUT, "left", "top", 2);
    M.forEach((m, i) => {
      const ry = 800 + i * 200;
      T(ctx, m.label, 80, ry, 36, 800, INK, "left", "top", 1);
      T(ctx, m.g + "g", 1000, ry, 36, 800, m.color, "right", "top");
      ctx.fillStyle = "rgba(22,20,15,0.08)";
      rr(ctx, 80, ry + 56, 920, 30, 15);
      ctx.fill();
      const fw = Math.max(30, 920 * (m.e / maxE));
      ctx.fillStyle = m.color;
      rr(ctx, 80, ry + 56, fw, 30, 15);
      ctx.fill();
    });
  } else if (style === "rings") {
    const M = macros(t, false);
    const totE = M.reduce((a, m) => a + m.e, 0) || 1;
    wordmark(ctx, W / 2 - meas(ctx, BRAND, 24, 800, 3) / 2 - 14, 96, INK);
    T(ctx, (p.title || "Meal").toUpperCase(), W / 2, 154, 30, 800, INK, "center", "top", 2);
    const cx = W / 2,
      cy = 760;
    const rs = [
      { m: M[1], r: 360 },
      { m: M[0], r: 286 },
      { m: M[2], r: 212 },
    ];
    rs.forEach((o) => ring(ctx, cx, cy, o.r, 50, o.m.e / totE, o.m.color, "rgba(22,20,15,0.08)"));
    T(ctx, t.kcal.toLocaleString(), cx, cy - 6, 150, 900, INK, "center", "alphabetic");
    T(ctx, "KCAL", cx, cy + 30, 38, 700, MUT, "center", "top", 4);
    M.forEach((m, i) => {
      const ly = 1230 + i * 92;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(360, ly + 16, 13, 0, Math.PI * 2);
      ctx.fill();
      T(ctx, m.label, 400, ly, 38, 800, INK);
      T(ctx, m.g + "g", 720, ly, 38, 800, m.color, "right");
    });
  } else if (style === "energy") {
    const inK = Math.round(p.caloriesIn || 0);
    const a = p.act || { kcal: 0, steps: 0, run: 0, bike: 0, swim: 0 };
    const on = p.actOn || {};
    const outK = Math.round(a.kcal || 0);
    const net = inK - outK;
    wordmark(ctx, W / 2 - meas(ctx, BRAND, 24, 800, 3) / 2 - 14, 96, INK);
    T(ctx, "TODAY'S ENERGY", W / 2, 156, 30, 800, INK, "center", "top", 2);

    const pw = 426,
      ph = 286,
      gap = 22,
      px1 = (W - pw * 2 - gap) / 2,
      py = 250,
      px2 = px1 + pw + gap;
    ctx.fillStyle = PAPER;
    rr(ctx, px1, py, pw, ph, 36);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    rr(ctx, px1, py, pw, ph, 36);
    ctx.stroke();
    ctx.fillStyle = MP_L;
    ctx.beginPath();
    ctx.arc(px1 + 44, py + 48, 10, 0, Math.PI * 2);
    ctx.fill();
    T(ctx, "ENERGY IN", px1 + 66, py + 36, 25, 800, MUT, "left", "top", 2);
    T(ctx, inK.toLocaleString(), px1 + 40, py + 196, 92, 900, INK, "left", "alphabetic");
    T(ctx, "KCAL · FOOD", px1 + 40, py + ph - 52, 22, 700, MUT, "left", "top", 1);
    ctx.fillStyle = INK;
    rr(ctx, px2, py, pw, ph, 36);
    ctx.fill();
    ctx.fillStyle = MF_D;
    ctx.beginPath();
    ctx.arc(px2 + 44, py + 48, 10, 0, Math.PI * 2);
    ctx.fill();
    T(ctx, "ENERGY OUT", px2 + 66, py + 36, 25, 800, "rgba(244,241,233,0.6)", "left", "top", 2);
    T(ctx, outK.toLocaleString(), px2 + 40, py + 196, 92, 900, BONE, "left", "alphabetic");
    T(ctx, "KCAL · BURNED", px2 + 40, py + ph - 52, 22, 700, "rgba(244,241,233,0.55)", "left", "top", 1);

    T(ctx, "NET BALANCE", W / 2, 644, 27, 800, MUT, "center", "top", 3);
    const sign = net > 0 ? "+" : net < 0 ? "−" : "";
    T(ctx, sign + Math.abs(net).toLocaleString(), W / 2, 838, 150, 900, INK, "center", "alphabetic");
    const ncolor = net > 0 ? MF_L : MP_L;
    T(ctx, (net > 0 ? "SURPLUS" : net < 0 ? "DEFICIT" : "EVEN") + " · KCAL", W / 2, 866, 28, 800, ncolor, "center", "top", 2);

    const metrics: { k: string; v: string; c: string }[] = [];
    if (on.steps && a.steps) metrics.push({ k: "STEPS", v: Math.round(a.steps).toLocaleString(), c: MP_L });
    if (on.run && a.run) metrics.push({ k: "RUN", v: a.run + " km", c: MF_L });
    if (on.bike && a.bike) metrics.push({ k: "BIKE", v: a.bike + " km", c: MC_L });
    if (on.swim && a.swim) metrics.push({ k: "SWIM", v: a.swim + " yd", c: MP_L });
    T(ctx, "TRAINING", 80, 1040, 30, 800, INK, "left", "top", 2);
    if (metrics.length === 0) {
      ctx.fillStyle = PAPER;
      rr(ctx, 80, 1108, W - 160, 110, 28);
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      rr(ctx, 80, 1108, W - 160, 110, 28);
      ctx.stroke();
      T(ctx, "Add your training to showcase it", W / 2, 1164, 30, 600, MUT, "center", "middle");
    } else {
      metrics.forEach((m, i) => {
        const ry = 1108 + i * 130;
        ctx.fillStyle = PAPER;
        rr(ctx, 80, ry, W - 160, 112, 28);
        ctx.fill();
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 2;
        rr(ctx, 80, ry, W - 160, 112, 28);
        ctx.stroke();
        ctx.fillStyle = m.c;
        ctx.beginPath();
        ctx.arc(134, ry + 56, 11, 0, Math.PI * 2);
        ctx.fill();
        T(ctx, m.k, 170, ry + 56, 36, 800, INK, "left", "middle");
        T(ctx, m.v, W - 130, ry + 56, 46, 900, INK, "right", "middle");
      });
    }
  }

  if (p.showHandle && p.handle) {
    const light = style === "spotlight";
    const hx = style === "dashboard" || style === "spotlight" ? 80 : W / 2;
    const al: CanvasTextAlign = style === "dashboard" || style === "spotlight" ? "left" : "center";
    T(ctx, "@" + p.handle.replace(/^@/, ""), hx, 1840, 30, 700, light ? "rgba(244,241,233,0.65)" : MUT, al, "top", 1);
  }
}
