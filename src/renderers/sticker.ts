import type { RenderProps } from "../types";
import {
  BONE,
  MP_D,
  MC_D,
  MF_D,
  SF,
  macros,
  rr,
  T,
  meas,
  ring,
  softShadow,
  row,
  withA,
  isLight,
  type RowPart,
} from "../lib/canvas";

/* ---------- STICKER renderers (1080x1080, transparent Story overlays) ---------- */
export function drawSticker(ctx: CanvasRenderingContext2D, style: string, p: RenderProps) {
  const W = 1080,
    H = 1080,
    t = p.totals;
  const ink = p.ink || BONE;
  const mcol = p.monoMacros
    ? [ink, ink, ink]
    : [(p.macroColors && p.macroColors.p) || MP_D, (p.macroColors && p.macroColors.c) || MC_D, (p.macroColors && p.macroColors.f) || MF_D];
  const M = macros(t, true).map((m, i) => ({ ...m, color: mcol[i] }));
  const totE = M.reduce((a, m) => a + m.e, 0) || 1;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2;
  const DIM = withA(ink, 0.62),
    FAINT = withA(ink, 0.4);

  if (style === "inline") {
    ctx.save();
    softShadow(ctx, 16, 3, 0.5);
    T(ctx, t.kcal.toLocaleString() + " KCAL", cx, 432, 42, 800, withA(ink, 0.92), "center", "alphabetic", 4);
    ctx.restore();
    const parts: RowPart[] = [];
    M.forEach((m, i) => {
      parts.push({ t: m.short, c: withA(ink, 0.8), size: 40, weight: 800, sp: 1 });
      parts.push({ t: " " + m.g, c: m.color, size: 104, weight: 900 });
      parts.push({ t: "g", c: DIM, size: 40, weight: 800 });
      if (i < M.length - 1) parts.push({ t: "   |   ", c: FAINT, size: 64, weight: 300 });
    });
    ctx.save();
    softShadow(ctx, 30, 6, 0.55);
    row(ctx, parts, cx, 560, 960);
    ctx.restore();
  } else if (style === "stack") {
    ctx.save();
    softShadow(ctx, 38, 8, 0.5);
    T(ctx, t.kcal.toLocaleString(), cx, 470, 188, 900, ink, "center", "alphabetic");
    ctx.restore();
    ctx.save();
    softShadow(ctx, 18, 3, 0.5);
    T(ctx, "KCAL", cx, 504, 46, 800, withA(ink, 0.85), "center", "top", 10);
    ctx.restore();
    let y = 632;
    M.forEach((m) => {
      ctx.save();
      softShadow(ctx, 16, 3, 0.5);
      row(
        ctx,
        [
          { t: m.g + "g", c: m.color, size: 56, weight: 900 },
          { t: "  " + m.label, c: withA(ink, 0.72), size: 30, weight: 700, sp: 2 },
        ],
        cx,
        y,
        760
      );
      ctx.restore();
      y += 84;
    });
  } else if (style === "rings") {
    const cy = 470;
    const rs = [
      { m: M[1], r: 300 },
      { m: M[0], r: 250 },
      { m: M[2], r: 200 },
    ]; // carbs outermost (emphasis)
    ctx.save();
    softShadow(ctx, 20, 4, 0.4);
    rs.forEach((o) => ring(ctx, cx, cy, o.r, 26, o.m.e / totE, o.m.color, withA(ink, 0.12)));
    ctx.restore();
    ctx.save();
    softShadow(ctx, 28, 6, 0.5);
    T(ctx, t.kcal.toLocaleString(), cx, cy + 4, 116, 900, ink, "center", "alphabetic");
    ctx.restore();
    ctx.save();
    softShadow(ctx, 14, 3, 0.5);
    T(ctx, "KCAL", cx, cy + 34, 30, 700, withA(ink, 0.7), "center", "top", 3);
    ctx.restore();
    const parts: RowPart[] = [];
    M.forEach((m, i) => {
      parts.push({ t: m.short + " ", c: withA(ink, 0.72), size: 36, weight: 800 });
      parts.push({ t: m.g + "g", c: m.color, size: 36, weight: 900 });
      if (i < M.length - 1) parts.push({ t: "      ", c: FAINT, size: 36, weight: 400 });
    });
    ctx.save();
    softShadow(ctx, 14, 3, 0.5);
    row(ctx, parts, cx, cy + 360, 880);
    ctx.restore();
  } else if (style === "chips") {
    const fill = isLight(ink) ? "rgba(16,15,12,0.36)" : "rgba(244,241,233,0.5)";
    const bord = withA(ink, 0.42);
    const chip = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.save();
      softShadow(ctx, 26, 10, 0.4);
      ctx.fillStyle = fill;
      rr(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = bord;
      ctx.lineWidth = 2;
      rr(ctx, x, y, w, h, r);
      ctx.stroke();
    };
    const kw = 560,
      kh = 184,
      kx = cx - kw / 2,
      ky = 336;
    chip(kx, ky, kw, kh, 42);
    T(ctx, t.kcal.toLocaleString(), cx, ky + 80, 96, 900, ink, "center", "middle");
    T(ctx, "KCAL", cx, ky + 140, 28, 800, withA(ink, 0.7), "center", "middle", 6);
    const gap = 22,
      totalW = 940,
      mw = (totalW - gap * 2) / 3,
      mh = 172,
      my = ky + kh + 30,
      sx = cx - totalW / 2;
    M.forEach((m, i) => {
      const mx = sx + i * (mw + gap);
      chip(mx, my, mw, mh, 36);
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(mx + mw / 2, my + 46, 12, 0, Math.PI * 2);
      ctx.fill();
      T(ctx, m.g + "g", mx + mw / 2, my + 98, 52, 900, ink, "center", "middle");
      T(ctx, m.label, mx + mw / 2, my + 140, 22, 800, withA(ink, 0.65), "center", "middle", 1);
    });
  } else if (style === "editorial") {
    const lx = 168,
      top = 372,
      tx = lx + 42;
    ctx.save();
    softShadow(ctx, 16, 4, 0.4);
    ctx.fillStyle = M[1].color;
    rr(ctx, lx, top + 4, 10, 326, 5);
    ctx.fill();
    ctx.restore();
    ctx.save();
    softShadow(ctx, 16, 3, 0.5);
    T(ctx, "TOTAL", tx, top, 30, 800, withA(ink, 0.7), "left", "top", 4);
    T(ctx, t.kcal.toLocaleString(), tx, top + 40, 148, 900, ink, "left", "top");
    const nw = meas(ctx, t.kcal.toLocaleString(), 148, 900);
    T(ctx, "KCAL", tx + nw + 18, top + 150, 38, 800, DIM, "left", "alphabetic", 2);
    ctx.restore();
    const maxE = Math.max(...M.map((m) => m.e)) || 1;
    const bw = 372;
    let y = top + 252;
    M.forEach((m) => {
      ctx.save();
      softShadow(ctx, 12, 3, 0.5);
      T(ctx, m.label, tx, y, 28, 800, withA(ink, 0.78), "left", "top", 1);
      T(ctx, m.g + "g", tx + bw, y, 30, 900, m.color, "right", "top");
      ctx.restore();
      const bh = 12,
        by = y + 46;
      ctx.fillStyle = withA(ink, 0.18);
      rr(ctx, tx, by, bw, bh, 6);
      ctx.fill();
      ctx.save();
      softShadow(ctx, 10, 2, 0.35);
      ctx.fillStyle = m.color;
      rr(ctx, tx, by, Math.max(20, bw * (m.e / maxE)), bh, 6);
      ctx.fill();
      ctx.restore();
      y += 88;
    });
  } else if (style === "texts") {
    const blue = "#0A84FF",
      midY = 470;
    let dish = (p.title || "My meal").trim();
    if (dish.length > 26) dish = dish.slice(0, 24).trim() + "…";
    const line = dish + ", " + t.kcal.toLocaleString() + " cal";
    const weight = 500,
      padX = 46,
      padY = 28,
      maxBubble = 940,
      minS = 34;
    let s = 44,
      tw = meas(ctx, line, s, weight, 0, SF);
    if (tw + padX * 2 > maxBubble) {
      s = Math.max(minS, (s * (maxBubble - padX * 2)) / tw);
      tw = meas(ctx, line, s, weight, 0, SF);
    }
    const bw = tw + padX * 2,
      bh = s + padY * 2,
      bx = cx - bw / 2,
      by = midY - bh / 2;
    ctx.save();
    softShadow(ctx, 22, 8, 0.26);
    ctx.fillStyle = blue;
    rr(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + bw - bh * 0.4, by + bh - 9);
    ctx.lineTo(bx + bw + 22, by + bh + 11);
    ctx.lineTo(bx + bw - 14, by + bh - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    T(ctx, line, cx, by + bh / 2 + 1, s, weight, "#FFFFFF", "center", "middle", 0, SF);
    const d = new Date();
    let hh = d.getHours();
    const ap = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;
    const tstr = "Fueled " + hh + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ap;
    T(ctx, tstr, bx + bw - 6, by + bh + 42, 26, 600, "rgba(142,142,147,0.95)", "right", "top", 0, SF);
  } else if (style === "textmac") {
    const blue = "#0A84FF",
      midY = 470;
    const line = "P: " + t.p + "   |   F: " + t.f + "   |   C: " + t.c + "    ·    " + t.kcal.toLocaleString() + " kcal";
    const weight = 500,
      padX = 46,
      padY = 28,
      maxBubble = 956,
      minS = 30;
    let s = 42,
      tw = meas(ctx, line, s, weight, 0, SF);
    if (tw + padX * 2 > maxBubble) {
      s = Math.max(minS, (s * (maxBubble - padX * 2)) / tw);
      tw = meas(ctx, line, s, weight, 0, SF);
    }
    const bw = tw + padX * 2,
      bh = s + padY * 2,
      bx = cx - bw / 2,
      by = midY - bh / 2;
    ctx.save();
    softShadow(ctx, 22, 8, 0.26);
    ctx.fillStyle = blue;
    rr(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + bw - bh * 0.4, by + bh - 9);
    ctx.lineTo(bx + bw + 22, by + bh + 11);
    ctx.lineTo(bx + bw - 14, by + bh - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    T(ctx, line, cx, by + bh / 2 + 1, s, weight, "#FFFFFF", "center", "middle", 0, SF);
    const d = new Date();
    let hh = d.getHours();
    const ap = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;
    T(ctx, "Fueled " + hh + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ap, bx + bw - 6, by + bh + 42, 26, 600, "rgba(142,142,147,0.95)", "right", "top", 0, SF);
  } else if (style === "splits") {
    const accent = "#FF3B30";
    const rowsData = [
      { label: "PROTEIN", val: t.p + "g", c: M[0].color },
      { label: "CARBS", val: t.c + "g", c: M[1].color },
      { label: "FAT", val: t.f + "g", c: M[2].color },
    ];
    const x = 130,
      rw = W - 260,
      rh = 132;
    let y = 264;
    rowsData.forEach((r) => {
      ctx.save();
      softShadow(ctx, 14, 3, 0.45);
      T(ctx, r.label, x, y + rh / 2, 52, 800, withA(ink, 0.9), "left", "middle", 1);
      T(ctx, r.val, x + rw, y + rh / 2, 64, 900, r.c, "right", "middle");
      ctx.restore();
      ctx.strokeStyle = withA(ink, 0.16);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + rh);
      ctx.lineTo(x + rw, y + rh);
      ctx.stroke();
      y += rh;
    });
    const bh = 156;
    ctx.save();
    softShadow(ctx, 26, 10, 0.35);
    ctx.fillStyle = accent;
    rr(ctx, x - 24, y + 22, rw + 48, bh, 30);
    ctx.fill();
    ctx.restore();
    T(ctx, "TOTAL", x + 14, y + 22 + bh / 2, 52, 800, "#FFFFFF", "left", "middle", 2);
    T(ctx, t.kcal.toLocaleString() + " kcal", x + rw + 10, y + 22 + bh / 2, 58, 900, "#FFFFFF", "right", "middle");
  }

  if (p.showHandle && p.handle) {
    ctx.save();
    softShadow(ctx, 14, 3, 0.5);
    const al: CanvasTextAlign = style === "editorial" ? "left" : "center";
    const hx = style === "editorial" ? 210 : cx;
    T(ctx, "@" + p.handle.replace(/^@/, ""), hx, H - 96, 28, 700, withA(ink, 0.72), al, "top", 1);
    ctx.restore();
  }
}
