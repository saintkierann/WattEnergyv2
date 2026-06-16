import type { RenderProps } from "../types";
import { SF, meas, T, rr, softShadow } from "../lib/canvas";

/* ============================================================================
   iMessage STICKERS — 1080x1080 transparent Story / Messages overlays.
   20 variants that read as real iOS Messages: blue & green bubbles, lock-screen
   notifications, threads, tapbacks, typing indicators. Branded sender "Watt ⚡".
   Signature line: "Fueled H:MM AM/PM".
   ========================================================================== */

const W = 1080,
  H = 1080,
  CX = W / 2,
  MARGIN = 96,
  SENT_R = W - MARGIN, // right edge for sent (blue/green) bubbles
  RECV_L = MARGIN; // left edge for received (grey) bubbles

// iOS Messages palette
const BLUE = "#0A84FF",
  BLUE_HI = "#3D9BFF",
  GREEN = "#34C759",
  GREEN_HI = "#5BD976",
  RX = "#E9E9EB", // received grey bubble
  RX_INK = "#1C1C1E", // text inside grey bubble
  STAMP = "rgba(120,120,128,0.95)", // timestamp grey
  WHITE = "#FFFFFF";

interface Line {
  t: string;
  size: number;
  weight: number;
  color?: string;
  sp?: number;
}

/* ---------- small helpers ---------- */
function clock() {
  const d = new Date();
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ap;
}
const fueled = () => "Fueled " + clock();

function meal(p: RenderProps, n = 30) {
  const s = (p.title || "My meal").trim();
  return s.length > n ? s.slice(0, n - 1).trim() + "…" : s;
}

// gradient fill matching the bubble hue, top-lighter (real bubbles have a subtle sheen)
function bubbleFill(ctx: CanvasRenderingContext2D, y: number, h: number, base: string, hi: string) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, hi);
  g.addColorStop(0.55, base);
  g.addColorStop(1, base);
  return g;
}

// classic iMessage tail at the bottom corner
function tail(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, side: "sent" | "received", fill: string | CanvasGradient) {
  ctx.fillStyle = fill as any;
  ctx.beginPath();
  if (side === "sent") {
    const ex = bx + bw;
    ctx.moveTo(ex - 34, by + bh - 36);
    ctx.quadraticCurveTo(ex - 2, by + bh - 4, ex + 22, by + bh - 1);
    ctx.quadraticCurveTo(ex - 6, by + bh - 2, ex - 14, by + bh - 30);
    ctx.closePath();
  } else {
    const sx = bx;
    ctx.moveTo(sx + 34, by + bh - 36);
    ctx.quadraticCurveTo(sx + 2, by + bh - 4, sx - 22, by + bh - 1);
    ctx.quadraticCurveTo(sx + 6, by + bh - 2, sx + 14, by + bh - 30);
    ctx.closePath();
  }
  ctx.fill();
}

interface BubbleOpts {
  side?: "sent" | "received";
  fill?: string;
  hi?: string;
  textColor?: string;
  midY?: number;
  align?: "center" | "edge";
  maxW?: number;
  padX?: number;
  padY?: number;
  gap?: number;
  tAlign?: "center" | "left";
  showTail?: boolean;
  radius?: number;
}

// Core bubble. Measures + auto-shrinks lines to fit, draws bubble + tail + text.
function bubble(ctx: CanvasRenderingContext2D, lines: Line[], o: BubbleOpts = {}) {
  const side = o.side ?? "sent";
  const padX = o.padX ?? 48,
    padY = o.padY ?? 30,
    gap = o.gap ?? 14,
    maxW = o.maxW ?? 880;

  let contentW = 0;
  lines.forEach((l) => (contentW = Math.max(contentW, meas(ctx, l.t, l.size, l.weight, l.sp ?? 0, SF))));
  if (contentW + padX * 2 > maxW) {
    const s = (maxW - padX * 2) / contentW;
    lines.forEach((l) => (l.size = Math.max(22, l.size * s)));
    contentW = 0;
    lines.forEach((l) => (contentW = Math.max(contentW, meas(ctx, l.t, l.size, l.weight, l.sp ?? 0, SF))));
  }
  let contentH = 0;
  lines.forEach((l, i) => {
    contentH += l.size;
    if (i > 0) contentH += gap;
  });
  const bw = contentW + padX * 2,
    bh = contentH + padY * 2;
  const single = lines.length === 1;
  const radius = o.radius ?? (single ? bh / 2 : 44);

  let bx: number;
  if ((o.align ?? "center") === "center") bx = CX - bw / 2;
  else bx = side === "sent" ? SENT_R - bw : RECV_L;
  const by = (o.midY ?? CX) - bh / 2;

  const fill = o.fill ?? BLUE;
  const grad = o.hi ? bubbleFill(ctx, by, bh, fill, o.hi) : fill;

  ctx.save();
  softShadow(ctx, 26, 9, 0.2);
  ctx.fillStyle = grad as any;
  rr(ctx, bx, by, bw, bh, radius);
  ctx.fill();
  if (o.showTail !== false) tail(ctx, bx, by, bw, bh, side, grad);
  ctx.restore();

  const tAlign = o.tAlign ?? (single ? "center" : "left");
  let ty = by + padY;
  lines.forEach((l) => {
    const tx = tAlign === "center" ? bx + bw / 2 : bx + padX;
    T(ctx, l.t, tx, ty, l.size, l.weight, l.color ?? o.textColor ?? WHITE, tAlign, "top", l.sp ?? 0, SF);
    ty += l.size + gap;
  });
  return { x: bx, y: by, w: bw, h: bh };
}

// timestamp / signature under a bubble
function stamp(ctx: CanvasRenderingContext2D, text: string, b: { x: number; y: number; w: number; h: number }, side: "sent" | "received" | "center" = "sent") {
  ctx.save();
  softShadow(ctx, 10, 2, 0.3);
  if (side === "center") T(ctx, text, CX, b.y + b.h + 24, 27, 600, STAMP, "center", "top", 0, SF);
  else if (side === "sent") T(ctx, text, b.x + b.w - 8, b.y + b.h + 24, 27, 600, STAMP, "right", "top", 0, SF);
  else T(ctx, text, b.x + 8, b.y + b.h + 24, 27, 600, STAMP, "left", "top", 0, SF);
  ctx.restore();
}

// iOS lock-screen / banner notification card
function notif(
  ctx: CanvasRenderingContext2D,
  sender: string,
  body: Line[],
  topY: number,
  o: { w?: number; time?: string; hue?: "blue" | "green" } = {}
) {
  const w = o.w ?? 948,
    x = CX - w / 2,
    padX = 36,
    padTop = 30,
    padBot = 34,
    icon = 80,
    titleSize = 33,
    titleGap = 12,
    lineGap = 9;

  let bodyH = 0;
  body.forEach((l, i) => {
    bodyH += l.size;
    if (i > 0) bodyH += lineGap;
  });
  const h = padTop + titleSize + titleGap + bodyH + padBot;

  ctx.save();
  softShadow(ctx, 44, 20, 0.26);
  ctx.fillStyle = "rgba(250,250,252,0.97)";
  rr(ctx, x, topY, w, h, 46);
  ctx.fill();
  ctx.restore();

  // app icon (rounded square, brand bolt)
  const ix = x + padX,
    iy = topY + padTop;
  const c1 = o.hue === "green" ? GREEN_HI : BLUE_HI,
    c2 = o.hue === "green" ? GREEN : BLUE;
  const g = ctx.createLinearGradient(ix, iy, ix, iy + icon);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  rr(ctx, ix, iy, icon, icon, 20);
  ctx.fill();
  T(ctx, "⚡", ix + icon / 2, iy + icon / 2 + 2, 46, 700, WHITE, "center", "middle", 0, SF);

  const tx = ix + icon + 24;
  T(ctx, sender, tx, topY + padTop + 1, titleSize, 700, "#0B0B0C", "left", "top", 0, SF);
  T(ctx, o.time ?? "now", x + w - padX, topY + padTop + 3, 27, 500, "rgba(120,120,128,0.9)", "right", "top", 0, SF);
  let by = topY + padTop + titleSize + titleGap;
  body.forEach((l) => {
    T(ctx, l.t, tx, by, l.size, l.weight, l.color ?? "rgba(28,28,30,0.92)", "left", "top", 0, SF);
    by += l.size + lineGap;
  });
  return { x, y: topY, w, h };
}

/* ============================================================================
   The 20 renderers
   ========================================================================== */
export function drawSticker(ctx: CanvasRenderingContext2D, style: string, p: RenderProps) {
  ctx.clearRect(0, 0, W, H);
  const t = p.totals;
  const kcal = t.kcal.toLocaleString();
  const macroLine = `${t.p}P · ${t.c}C · ${t.f}F`;

  switch (style) {
    /* ---- BLUE bubbles ---- */
    case "blueMeal": {
      // meal name + calories, one line (content type: meal + calories)
      const b = bubble(ctx, [{ t: `🔥 ${meal(p)} — ${kcal} cal`, size: 46, weight: 500 }], { fill: BLUE, hi: BLUE_HI, maxW: 920 });
      stamp(ctx, fueled(), b, "sent");
      break;
    }
    case "blueMacros": {
      const b = bubble(ctx, [{ t: macroLine, size: 50, weight: 500 }], { fill: BLUE, hi: BLUE_HI });
      stamp(ctx, fueled(), b, "sent");
      break;
    }
    case "blueFull": {
      // "all in one text" — meal name + full macro/calorie breakdown, multi-line
      const b = bubble(
        ctx,
        [
          { t: meal(p), size: 50, weight: 600 },
          { t: `${kcal} cal`, size: 40, weight: 400, color: "rgba(255,255,255,0.92)" },
          { t: macroLine, size: 40, weight: 400, color: "rgba(255,255,255,0.92)" },
        ],
        { fill: BLUE, hi: BLUE_HI, maxW: 720, tAlign: "left" }
      );
      stamp(ctx, fueled(), b, "sent");
      break;
    }
    case "blueKcal": {
      // calories headline
      const b = bubble(
        ctx,
        [
          { t: kcal, size: 132, weight: 700 },
          { t: "calories · fueled", size: 38, weight: 400, color: "rgba(255,255,255,0.9)" },
        ],
        { fill: BLUE, hi: BLUE_HI, gap: 6, padY: 36, tAlign: "center" }
      );
      stamp(ctx, clock(), b, "sent");
      break;
    }
    case "blueProtein": {
      const b = bubble(ctx, [{ t: `💪 ${t.p}g protein down`, size: 50, weight: 500 }], { fill: BLUE, hi: BLUE_HI });
      stamp(ctx, fueled(), b, "sent");
      break;
    }
    case "blueStreak": {
      // daily / streak flex
      const b = bubble(
        ctx,
        [
          { t: "Locked in today 🔥", size: 46, weight: 600 },
          { t: `${t.p}g protein · ${kcal} cal`, size: 40, weight: 400, color: "rgba(255,255,255,0.92)" },
        ],
        { fill: BLUE, hi: BLUE_HI, tAlign: "left", maxW: 760 }
      );
      stamp(ctx, fueled(), b, "sent");
      break;
    }

    /* ---- GREEN bubbles (SMS) ---- */
    case "greenMeal": {
      const b = bubble(ctx, [{ t: `${meal(p)} — ${kcal} cal`, size: 46, weight: 500 }], { fill: GREEN, hi: GREEN_HI, maxW: 920 });
      stamp(ctx, fueled(), b, "sent");
      break;
    }
    case "greenMacros": {
      const b = bubble(
        ctx,
        [
          { t: macroLine, size: 50, weight: 500 },
          { t: `${kcal} cal`, size: 38, weight: 400, color: "rgba(255,255,255,0.9)" },
        ],
        { fill: GREEN, hi: GREEN_HI, gap: 8, tAlign: "center" }
      );
      stamp(ctx, fueled(), b, "sent");
      break;
    }

    /* ---- LOCK-SCREEN notifications ---- */
    case "lockMeal": {
      const n = notif(ctx, "Watt ⚡", [{ t: `${meal(p)} logged — ${kcal} cal`, size: 37, weight: 400 }], 430, { time: "now" });
      stamp(ctx, fueled(), n, "center");
      break;
    }
    case "lockMacros": {
      notif(
        ctx,
        "Watt ⚡",
        [
          { t: "Macros locked in 💪", size: 38, weight: 500, color: "rgba(20,20,22,0.95)" },
          { t: `${t.p}g protein · ${t.c}g carbs · ${t.f}g fat`, size: 35, weight: 400 },
        ],
        408,
        { time: "now" }
      );
      break;
    }
    case "lockProtein": {
      const n = notif(ctx, "Watt ⚡", [{ t: `💪 ${t.p}g protein — nice work`, size: 37, weight: 400 }], 430, { time: "now" });
      stamp(ctx, fueled(), n, "center");
      break;
    }
    case "banner": {
      // compact heads-up banner
      const n = notif(ctx, "Watt ⚡", [{ t: `${kcal} cal logged`, size: 37, weight: 400 }], 470, { w: 820, time: clock() });
      stamp(ctx, "Fueled", n, "center");
      break;
    }
    case "stack": {
      // two stacked notifications + a peeking card behind
      ctx.save();
      softShadow(ctx, 36, 16, 0.18);
      ctx.fillStyle = "rgba(250,250,252,0.55)";
      rr(ctx, CX - 430, 690, 860, 90, 44);
      ctx.fill();
      ctx.restore();
      notif(ctx, "Watt ⚡", [{ t: `${meal(p)} — ${kcal} cal`, size: 35, weight: 400 }], 372, { w: 900, time: "now" });
      notif(ctx, "Watt ⚡", [{ t: `${macroLine}  ·  fueled`, size: 35, weight: 400 }], 548, { w: 900, time: "now" });
      break;
    }

    /* ---- conversational / playful ---- */
    case "tapback": {
      const b = bubble(
        ctx,
        [
          { t: `${meal(p)} 🔥`, size: 48, weight: 500 },
          { t: `${kcal} cal · ${macroLine}`, size: 36, weight: 400, color: "rgba(255,255,255,0.92)" },
        ],
        { fill: BLUE, hi: BLUE_HI, tAlign: "left", maxW: 760 }
      );
      // tapback heart at top-left of the bubble
      const rx = b.x - 18,
        ry = b.y - 18;
      ctx.save();
      softShadow(ctx, 18, 5, 0.2);
      ctx.fillStyle = RX;
      ctx.beginPath();
      ctx.arc(rx, ry, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rx - 30, ry + 34, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rx - 50, ry + 54, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      T(ctx, "❤️", rx, ry + 2, 42, 400, "#FF3B30", "center", "middle", 0, SF);
      stamp(ctx, fueled(), b, "sent");
      break;
    }
    case "thread": {
      bubble(ctx, [{ t: "what did you eat?", size: 42, weight: 400, color: RX_INK }], { side: "received", align: "edge", fill: RX, midY: 410 });
      const a = bubble(ctx, [{ t: `${meal(p)}, ${kcal} cal 🔥`, size: 44, weight: 500 }], { side: "sent", align: "edge", fill: BLUE, hi: BLUE_HI, midY: 560, maxW: 800 });
      stamp(ctx, fueled(), a, "sent");
      break;
    }
    case "threadMacros": {
      bubble(ctx, [{ t: "macros?", size: 42, weight: 400, color: RX_INK }], { side: "received", align: "edge", fill: RX, midY: 420 });
      const a = bubble(ctx, [{ t: `${macroLine} ✅`, size: 46, weight: 500 }], { side: "sent", align: "edge", fill: BLUE, hi: BLUE_HI, midY: 575 });
      stamp(ctx, fueled(), a, "sent");
      break;
    }
    case "delivered": {
      const b = bubble(
        ctx,
        [
          { t: kcal + " cal", size: 56, weight: 600 },
          { t: macroLine, size: 36, weight: 400, color: "rgba(255,255,255,0.9)" },
        ],
        { fill: BLUE, hi: BLUE_HI, tAlign: "center", gap: 10 }
      );
      ctx.save();
      softShadow(ctx, 8, 2, 0.25);
      T(ctx, "Delivered", b.x + b.w - 6, b.y + b.h + 22, 26, 600, STAMP, "right", "top", 0, SF);
      ctx.restore();
      break;
    }
    case "typing": {
      // received typing-indicator bubble with three dots
      const bw = 200,
        bh = 116,
        bx = RECV_L,
        by = CX - bh / 2;
      ctx.save();
      softShadow(ctx, 24, 8, 0.18);
      ctx.fillStyle = RX;
      rr(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
      tail(ctx, bx, by, bw, bh, "received", RX);
      ctx.restore();
      const dotC = "rgba(120,120,128,0.85)";
      [-1, 0, 1].forEach((d) => {
        ctx.fillStyle = dotC;
        ctx.beginPath();
        ctx.arc(bx + bw / 2 + d * 44, by + bh / 2, 16, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.save();
      softShadow(ctx, 10, 2, 0.3);
      T(ctx, "Watt is logging your meal…", bx, by + bh + 30, 32, 500, STAMP, "left", "top", 0, SF);
      ctx.restore();
      break;
    }
    case "contact": {
      // conversation header (avatar + name) above a bubble
      const ay = 300,
        ar = 64;
      ctx.save();
      softShadow(ctx, 24, 8, 0.22);
      const g = ctx.createLinearGradient(CX - ar, ay - ar, CX + ar, ay + ar);
      g.addColorStop(0, BLUE_HI);
      g.addColorStop(1, BLUE);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(CX, ay, ar, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      T(ctx, "⚡", CX, ay + 2, 56, 700, WHITE, "center", "middle", 0, SF);
      ctx.save();
      softShadow(ctx, 10, 2, 0.3);
      T(ctx, "Watt ⚡", CX, ay + ar + 22, 38, 600, "rgba(255,255,255,0.96)", "center", "top", 0, SF);
      ctx.restore();
      const b = bubble(
        ctx,
        [
          { t: meal(p), size: 46, weight: 600 },
          { t: `${kcal} cal · ${macroLine}`, size: 36, weight: 400, color: "rgba(255,255,255,0.92)" },
        ],
        { fill: BLUE, hi: BLUE_HI, midY: 600, tAlign: "left", maxW: 760 }
      );
      stamp(ctx, fueled(), b, "sent");
      break;
    }
    case "doubleBlue": {
      // two consecutive sent bubbles (grouped — tail only on the last)
      bubble(ctx, [{ t: `${meal(p)} 🔥`, size: 46, weight: 500 }], { side: "sent", align: "edge", fill: BLUE, hi: BLUE_HI, midY: 440, showTail: false, maxW: 800 });
      const b = bubble(ctx, [{ t: `${kcal} cal · ${macroLine}`, size: 42, weight: 500 }], { side: "sent", align: "edge", fill: BLUE, hi: BLUE_HI, midY: 565, maxW: 860 });
      stamp(ctx, fueled(), b, "sent");
      break;
    }

    default: {
      const b = bubble(ctx, [{ t: `${meal(p)} — ${kcal} cal`, size: 46, weight: 500 }], { fill: BLUE, hi: BLUE_HI, maxW: 920 });
      stamp(ctx, fueled(), b, "sent");
    }
  }

  // optional @handle footer (kept from original behaviour)
  if (p.showHandle && p.handle) {
    ctx.save();
    softShadow(ctx, 12, 3, 0.4);
    T(ctx, "@" + p.handle.replace(/^@/, ""), CX, H - 92, 30, 600, "rgba(255,255,255,0.85)", "center", "top", 0, SF);
    ctx.restore();
  }
}
