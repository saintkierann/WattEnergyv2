import type { RenderProps } from "../types";
import { INK, BONE, PAPER, MUT, LINE, SF, macros, rr, T, meas, cover, softShadow, wordmark } from "../lib/canvas";

/* ---------- DAY-SUMMARY card renderer (1080x1920, end-of-day recap) ---------- */
export function drawDayCard(ctx: CanvasRenderingContext2D, style: string, p: RenderProps) {
  const W = 1080,
    H = 1920,
    t = p.totals,
    meals = p.meals || [],
    imgs = p.imgs || [];
  const M = macros(t, false);
  // Energy in vs out summary line, drawn on each style only when an out value exists.
  const inK = Math.round(p.caloriesIn ?? t.kcal);
  const outK = Math.round(p.act?.kcal || 0);
  const ioNet = inK - outK;
  const ioNetTxt = (ioNet > 0 ? "+" : ioNet < 0 ? "−" : "") + Math.abs(ioNet).toLocaleString();
  const ioLabel = ioNet > 0 ? "SURPLUS" : ioNet < 0 ? "DEFICIT" : "EVEN";
  const ioStr = `IN ${inK.toLocaleString()}  ·  OUT ${outK.toLocaleString()}  ·  NET ${ioNetTxt} ${ioLabel}`;
  ctx.fillStyle = BONE;
  ctx.fillRect(0, 0, W, H);
  wordmark(ctx, 80, 80, INK);
  T(ctx, "TODAY", W - 80, 86, 30, 800, MUT, "right", "top", 3);

  if (style === "recap") {
    // photo grid of up to 4 meals
    const n = Math.min(meals.length, 4);
    const gx = 80,
      gy = 170,
      gap = 18,
      cols = n <= 1 ? 1 : 2;
    const cw = (W - 160 - gap * (cols - 1)) / cols,
      chh = 360;
    for (let i = 0; i < n; i++) {
      const c = i % cols,
        r = Math.floor(i / cols);
      const x = gx + c * (cw + gap),
        y = gy + r * (chh + gap);
      if (imgs[i]) cover(ctx, imgs[i]!, x, y, cw, chh, 28);
      else {
        ctx.fillStyle = "#E7E1D2";
        rr(ctx, x, y, cw, chh, 28);
        ctx.fill();
      }
      // kcal pill on each photo
      const pill = (meals[i].kcal || 0).toLocaleString() + " kcal";
      const pw = meas(ctx, pill, 26, 800) + 36;
      ctx.fillStyle = "rgba(16,15,12,0.82)";
      rr(ctx, x + 16, y + chh - 58, pw, 42, 21);
      ctx.fill();
      T(ctx, pill, x + 16 + 18, y + chh - 37, 26, 800, BONE, "left", "middle");
    }

    const baseY = gy + Math.ceil(n / cols) * (chh + gap) + 40;
    T(ctx, meals.length + (meals.length === 1 ? " MEAL" : " MEALS") + " LOGGED", W / 2, baseY, 30, 800, MUT, "center", "top", 2);
    T(ctx, t.kcal.toLocaleString(), W / 2, baseY + 220, 200, 900, INK, "center", "alphabetic");
    T(ctx, "TOTAL KCAL TODAY", W / 2, baseY + 250, 30, 700, MUT, "center", "top", 3);
    const cxs = [260, 540, 820];
    M.forEach((m, i) => {
      T(ctx, m.g + "g", cxs[i], baseY + 340, 60, 900, m.color, "center", "top");
      T(ctx, m.label, cxs[i], baseY + 414, 24, 700, MUT, "center", "top", 1);
    });
    if (outK > 0) T(ctx, ioStr, W / 2, baseY + 486, 24, 800, MUT, "center", "top", 1);
  } else if (style === "ledger") {
    T(ctx, "DAILY RECAP", 80, 200, 34, 800, MUT, "left", "top", 2);
    T(ctx, t.kcal.toLocaleString(), 80, 420, 220, 900, INK, "left", "alphabetic");
    const nw = meas(ctx, t.kcal.toLocaleString(), 220, 900);
    T(ctx, "KCAL", 80 + nw + 26, 420, 54, 800, MUT, "left", "alphabetic", 1);
    const cxs = [200, 470, 740];
    M.forEach((m, i) => {
      T(ctx, m.g + "g", cxs[i], 470, 44, 900, m.color, "left", "top");
      T(ctx, m.label, cxs[i], 524, 22, 700, MUT, "left", "top", 1);
    });
    if (outK > 0) T(ctx, ioStr, 80, 566, 24, 800, MUT, "left", "top", 1);
    // meal ledger rows
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 600);
    ctx.lineTo(W - 80, 600);
    ctx.stroke();
    const rows = Math.min(meals.length, 7);
    let y = 640;
    for (let i = 0; i < rows; i++) {
      const m = meals[i];
      if (imgs[i]) cover(ctx, imgs[i]!, 80, y, 88, 88, 18);
      else {
        ctx.fillStyle = PAPER;
        rr(ctx, 80, y, 88, 88, 18);
        ctx.fill();
      }
      T(ctx, m.name || "Meal", 196, y + 16, 36, 800, INK, "left", "top");
      T(ctx, m.p + "p · " + m.c + "c · " + m.f + "f", 196, y + 58, 26, 600, MUT, "left", "top");
      T(ctx, (m.kcal || 0).toLocaleString(), W - 80, y + 30, 44, 900, INK, "right", "top");
      y += 124;
    }
    if (meals.length > 7) T(ctx, "+ " + (meals.length - 7) + " more", 196, y + 4, 28, 700, MUT, "left", "top");
  } else if (style === "splits") {
    const accent = "#FF3B30";
    T(ctx, "MEAL SPLITS", 80, 210, 34, 800, MUT, "left", "top", 2);
    T(ctx, t.p + "g P    ·    " + t.c + "g C    ·    " + t.f + "g F", 80, 262, 30, 700, MUT, "left", "top", 1);
    if (outK > 0) T(ctx, ioStr, 80, 304, 24, 800, MUT, "left", "top", 1);
    const x = 80,
      rw = W - 160,
      rh = 144;
    let y = 360;
    const rows = Math.min(meals.length, 7);
    for (let i = 0; i < rows; i++) {
      const m = meals[i];
      T(ctx, String(i + 1), x, y + rh / 2, 46, 800, MUT, "left", "middle");
      T(ctx, m.name || "Meal", x + 86, y + rh / 2, 44, 800, INK, "left", "middle");
      T(ctx, (m.kcal || 0).toLocaleString(), x + rw, y + rh / 2, 54, 900, INK, "right", "middle");
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + rh);
      ctx.lineTo(x + rw, y + rh);
      ctx.stroke();
      y += rh;
    }
    if (meals.length > 7) {
      T(ctx, "+ " + (meals.length - 7) + " more", x + 86, y + 30, 30, 700, MUT, "left", "top");
      y += 86;
    }
    const bh = 184;
    ctx.fillStyle = accent;
    rr(ctx, x, y + 28, rw, bh, 32);
    ctx.fill();
    T(ctx, "TOTAL", x + 40, y + 28 + bh / 2, 54, 800, "#FFFFFF", "left", "middle", 2);
    T(ctx, t.kcal.toLocaleString() + " kcal", x + rw - 40, y + 28 + bh / 2, 60, 900, "#FFFFFF", "right", "middle");
  } else if (style === "messages") {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    const avCx = W / 2,
      avTop = 84,
      avR = 50;
    ctx.fillStyle = "#0A84FF";
    ctx.beginPath();
    ctx.arc(avCx, avTop + avR, avR, 0, Math.PI * 2);
    ctx.fill();
    T(ctx, "W", avCx, avTop + avR, 46, 700, "#FFFFFF", "center", "middle", 0, SF);
    T(ctx, "Today's Fuel", avCx, avTop + avR * 2 + 14, 30, 600, "#1C1C1E", "center", "top", 0, SF);
    let y = avTop + avR * 2 + 78;
    const shown = Math.min(meals.length, 4);
    for (let i = 0; i < shown; i++) {
      const m = meals[i];
      const pw = 364,
        ph = 216,
        px = 70;
      if (imgs[i]) cover(ctx, imgs[i]!, px, y, pw, ph, 30);
      else {
        ctx.fillStyle = "#E9E9EB";
        rr(ctx, px, y, pw, ph, 30);
        ctx.fill();
        T(ctx, "No photo", px + pw / 2, y + ph / 2, 26, 500, "#A6A6AB", "center", "middle", 0, SF);
      }
      y += ph + 12;
      const cap = (m.name || "Meal") + "   ·   " + (m.kcal || 0).toLocaleString() + " cal";
      const cs = 30,
        bpx = 28,
        bpy = 19,
        cbh = cs + bpy * 2;
      const cw = Math.min(meas(ctx, cap, cs, 500, 0, SF) + bpx * 2, W - 180);
      ctx.fillStyle = "#E9E9EB";
      rr(ctx, px, y, cw, cbh, cbh / 2);
      ctx.fill();
      T(ctx, cap, px + bpx, y + cbh / 2, cs, 500, "#1C1C1E", "left", "middle", 0, SF);
      y += cbh + 34;
    }
    if (meals.length > shown) {
      T(ctx, "+ " + (meals.length - shown) + " earlier", 78, y, 26, 500, "#8E8E93", "left", "top", 0, SF);
      y += 56;
    }
    const l1 = "Day total — " + t.kcal.toLocaleString() + " cal";
    const l2 = "P " + t.p + "g · C " + t.c + "g · F " + t.f + "g";
    const fs = 32,
      bpx2 = 34,
      bh3 = 70 + fs * 2;
    const bw2 = Math.max(meas(ctx, l1, fs, 700, 0, SF), meas(ctx, l2, fs, 500, 0, SF)) + bpx2 * 2;
    const by2 = Math.max(y + 6, H - 340),
      bx2 = W - 70 - bw2;
    ctx.save();
    softShadow(ctx, 20, 8, 0.22);
    ctx.fillStyle = "#0A84FF";
    rr(ctx, bx2, by2, bw2, bh3, 34);
    ctx.fill();
    ctx.restore();
    T(ctx, l1, bx2 + bpx2, by2 + 28, fs, 700, "#FFFFFF", "left", "top", 0, SF);
    T(ctx, l2, bx2 + bpx2, by2 + 28 + fs + 14, fs, 500, "rgba(255,255,255,0.92)", "left", "top", 0, SF);
    const d = new Date();
    let hh = d.getHours();
    const ap = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;
    if (outK > 0) T(ctx, `Out ${outK.toLocaleString()} · net ${ioNetTxt}`, 70, by2 + bh3 + 12, 24, 600, "#8E8E93", "left", "top", 0, SF);
    T(ctx, "Fueled " + hh + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ap, W - 70, by2 + bh3 + 12, 24, 600, "#8E8E93", "right", "top", 0, SF);
  }

  if (p.showHandle && p.handle) T(ctx, "@" + p.handle.replace(/^@/, ""), 80, H - 110, 30, 700, MUT, "left", "top", 1);
}
