import type { Totals } from "../types";

/* ---------- palette ---------- */
export const INK = "#16140F",
  BONE = "#F4F1E9",
  PAPER = "#FFFFFF",
  MUT = "#8A8578",
  LINE = "rgba(22,20,15,0.14)";
export const BRAND = "WATT ENERGY"; // app wordmark — single source of truth for the name
export const SF = '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, "Helvetica Neue", Arial, sans-serif';

// macro tints — light surfaces (cards) vs dark surfaces (spotlight scrim, stickers)
export const MP_L = "#6F7B73",
  MC_L = INK,
  MF_L = "#B7895A";
export const MP_D = "#A9C3B7",
  MC_D = "#EDE7D9",
  MF_D = "#E6C49A";

export interface Macro {
  label: string;
  short: string;
  color: string;
  g: number;
  e: number;
}

export function macros(t: Totals, dark: boolean): Macro[] {
  return [
    { label: "PROTEIN", short: "P", color: dark ? MP_D : MP_L, g: t.p, e: t.p * 4 },
    { label: "CARBS", short: "C", color: dark ? MC_D : MC_L, g: t.c, e: t.c * 4 },
    { label: "FAT", short: "F", color: dark ? MF_D : MF_L, g: t.f, e: t.f * 9 },
  ];
}

type Ctx = CanvasRenderingContext2D;
type Align = CanvasTextAlign;
type Baseline = CanvasTextBaseline;

/* ---------- canvas helpers ---------- */
export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function T(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
  align: Align = "left",
  baseline: Baseline = "top",
  sp?: number | null,
  fam?: string
) {
  ctx.font = `${weight} ${size}px ${fam || "'Archivo', system-ui, sans-serif"}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (sp != null) {
    try {
      (ctx as any).letterSpacing = sp + "px";
    } catch {}
  }
  ctx.fillText(str, x, y);
  if (sp != null) {
    try {
      (ctx as any).letterSpacing = "0px";
    } catch {}
  }
}

export function meas(ctx: Ctx, str: string, size: number, weight: number, sp?: number | null, fam?: string) {
  ctx.font = `${weight} ${size}px ${fam || "'Archivo', system-ui, sans-serif"}`;
  if (sp != null) {
    try {
      (ctx as any).letterSpacing = sp + "px";
    } catch {}
  }
  const w = ctx.measureText(str).width;
  if (sp != null) {
    try {
      (ctx as any).letterSpacing = "0px";
    } catch {}
  }
  return w;
}

export function cover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, r?: number) {
  ctx.save();
  if (r) {
    rr(ctx, x, y, w, h, r);
    ctx.clip();
  }
  const ir = img.width / img.height,
    br = w / h;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > br) {
    sh = img.height;
    sw = sh * br;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / br;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

export function ring(ctx: Ctx, cx: number, cy: number, rad: number, width: number, frac: number, color: string, track?: string) {
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.strokeStyle = track || "rgba(22,20,15,0.08)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
  if (frac > 0) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(frac, 1));
    ctx.stroke();
  }
}

export function wordmark(ctx: Ctx, x: number, y: number, color: string) {
  ctx.beginPath();
  ctx.arc(x + 6, y + 13, 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  T(ctx, BRAND, x + 22, y, 24, 800, color, "left", "top", 3);
}

// soft halo so light text survives on any Story background; transparent sticker stays transparent
export function softShadow(ctx: Ctx, blur: number, dy?: number, a?: number) {
  ctx.shadowColor = "rgba(0,0,0," + (a == null ? 0.45 : a) + ")";
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = dy || 0;
}

export interface RowPart {
  t: string;
  c: string;
  size: number;
  weight: number;
  sp?: number;
}

// centered row of mixed-size/weight/colour parts, auto-shrunk to fit maxW
export function row(ctx: Ctx, parts: RowPart[], cx: number, y: number, maxW?: number) {
  let total = 0;
  parts.forEach((p) => {
    total += meas(ctx, p.t, p.size, p.weight, p.sp);
  });
  if (maxW && total > maxW) {
    const s = maxW / total;
    parts.forEach((p) => {
      p.size *= s;
    });
    total = 0;
    parts.forEach((p) => {
      total += meas(ctx, p.t, p.size, p.weight, p.sp);
    });
  }
  let x = cx - total / 2;
  parts.forEach((p) => {
    T(ctx, p.t, x, y, p.size, p.weight, p.c, "left", "middle", p.sp);
    x += meas(ctx, p.t, p.size, p.weight, p.sp);
  });
}

// colour helpers for the sticker colour tray
export function withA(hex: string, a: number) {
  const h = (hex || "#F4F1E9").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

export function isLight(hex: string) {
  const h = (hex || "#F4F1E9").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 140;
}
