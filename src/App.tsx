import React, { useState, useRef, useEffect } from "react";
import { BONE, MP_D, MC_D, MF_D } from "./lib/canvas";
import { drawCard } from "./renderers/card";
import { drawSticker } from "./renderers/sticker";
import { drawDayCard } from "./renderers/day";
import { CARD_STYLES, DAY_CARD_STYLES, STICKER_STYLES } from "./renderers/styles";
import { analyzeMeal } from "./lib/api";
import { idbGet, idbSet } from "./lib/store";
import type { MealData, LoggedMeal, Totals } from "./types";

function computeTotals(
  d: MealData | null,
  s: Record<number, number>,
  a?: { p: number; c: number; f: number }
): Totals {
  if (!d) return { kcal: 0, p: 0, c: 0, f: 0 };
  let { kcal, p, c, f } = d.base;
  (d.questions || []).forEach((q, i) => {
    const o = q.opts[s[i] ?? 0];
    if (o) {
      kcal += o.kcal || 0;
      p += o.p || 0;
      c += o.c || 0;
      f += o.f || 0;
    }
  });
  if (a) {
    p += a.p || 0;
    c += a.c || 0;
    f += a.f || 0;
    kcal += (a.p || 0) * 4 + (a.c || 0) * 4 + (a.f || 0) * 9;
  }
  return { kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), f: Math.round(f) };
}

export default function App() {
  const [screen, setScreen] = useState("capture"); // capture|analyzing|review|manual|share
  const [preview, setPreview] = useState<string | null>(null);
  const [data, setData] = useState<MealData | null>(null);
  const [sel, setSel] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LoggedMeal[]>([]);
  const [pop, setPop] = useState(false);
  const [tab, setTab] = useState("cards");
  const [cardStyle, setCardStyle] = useState("spotlight");
  const [stickerStyle, setStickerStyle] = useState("blueMeal");
  const [stickerInk, setStickerInk] = useState(BONE);
  const [monoMacros, setMonoMacros] = useState(false);
  const [macroColors, setMacroColors] = useState({ p: MP_D, c: MC_D, f: MF_D });
  const [handle, setHandle] = useState("");
  const [showHandle, setShowHandle] = useState(false);
  const [manual, setManual] = useState({ title: "", kcal: "", p: "", c: "", f: "" });
  const [act, setAct] = useState({ kcal: "", steps: "", run: "", bike: "", swim: "" });
  const [actOn, setActOn] = useState({ steps: true, run: true, bike: true, swim: true });
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adj, setAdj] = useState({ p: "", c: "", f: "" });
  const [showAdj, setShowAdj] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [copied, setCopied] = useState<string | false>(false);
  const [imgReady, setImgReady] = useState(false);
  const [shareMode, setShareMode] = useState("meal"); // meal | day
  const [dayStyle, setDayStyle] = useState("energy");
  const [reshare, setReshare] = useState(false);
  const [saved, setSaved] = useState<string | false>(false);
  const [dayImgsReady, setDayImgsReady] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dayImgsRef = useRef<(HTMLImageElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const adjNum = { p: +adj.p || 0, c: +adj.c || 0, f: +adj.f || 0 };
  const totals = computeTotals(data, sel, adjNum);
  const dayTotals = log.reduce(
    (a, m) => ({ kcal: a.kcal + (m.kcal || 0), p: a.p + (m.p || 0), c: a.c + (m.c || 0), f: a.f + (m.f || 0) }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
  const actNum = { kcal: +act.kcal || 0, steps: +act.steps || 0, run: +act.run || 0, bike: +act.bike || 0, swim: +act.swim || 0 };

  // ---- on-device persistence: load once, then save on change ----
  useEffect(() => {
    (async () => {
      const savedLog = await idbGet<LoggedMeal[]>("log");
      const savedHandle = await idbGet<string>("handle");
      const savedShow = await idbGet<boolean>("showHandle");
      if (Array.isArray(savedLog)) setLog(savedLog);
      if (typeof savedHandle === "string") setHandle(savedHandle);
      if (typeof savedShow === "boolean") setShowHandle(savedShow);
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (loaded) idbSet("log", log);
  }, [log, loaded]);
  useEffect(() => {
    if (loaded) idbSet("handle", handle);
  }, [handle, loaded]);
  useEffect(() => {
    if (loaded) idbSet("showHandle", showHandle);
  }, [showHandle, loaded]);

  useEffect(() => {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setFontsReady(true));
    else setFontsReady(true);
  }, []);

  useEffect(() => {
    if (!preview) {
      imgRef.current = null;
      setImgReady(false);
      return;
    }
    const im = new Image();
    im.onload = () => {
      imgRef.current = im;
      setImgReady(true);
    };
    im.onerror = () => {
      imgRef.current = null;
      setImgReady(false);
    };
    im.src = preview;
  }, [preview]);

  useEffect(() => {
    if (screen === "review") {
      setPop(true);
      const t = setTimeout(() => setPop(false), 250);
      return () => clearTimeout(t);
    }
  }, [totals.kcal, screen]);

  useEffect(() => {
    if (screen !== "share" || !canvasRef.current) return;
    if (shareMode !== "day" && !data) return;
    const cv = canvasRef.current,
      ctx = cv.getContext("2d");
    if (!ctx) return;
    if (shareMode === "day") {
      cv.width = 1080;
      cv.height = 1920;
      if (dayStyle === "energy") {
        drawCard(ctx, "energy", { totals: dayTotals, caloriesIn: dayTotals.kcal, act: actNum, actOn, handle, showHandle });
      } else {
        drawDayCard(ctx, dayStyle, { totals: dayTotals, meals: log, imgs: dayImgsRef.current, handle, showHandle });
      }
      return;
    }
    const caloriesIn = dayTotals.kcal + (reshare ? 0 : totals.kcal);
    const p = { totals, title: data!.title, img: imgRef.current, handle, showHandle, ink: stickerInk, monoMacros, macroColors, caloriesIn, act: actNum, actOn };
    if (tab === "cards") {
      cv.width = 1080;
      cv.height = 1920;
      drawCard(ctx, cardStyle, p);
    } else {
      cv.width = 1080;
      cv.height = 1080;
      drawSticker(ctx, stickerStyle, p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, shareMode, dayStyle, dayImgsReady, tab, cardStyle, stickerStyle, stickerInk, monoMacros, macroColors, handle, showHandle, fontsReady, imgReady, totals.kcal, totals.p, totals.c, totals.f, dayTotals.kcal, data, act.kcal, act.steps, act.run, act.bike, act.swim, actOn, reshare]);

  // load logged-meal photos into Image elements for the day-summary card
  useEffect(() => {
    if (shareMode !== "day") return;
    let alive = true;
    const imgs: (HTMLImageElement | null)[] = [];
    let pending = 0,
      done = 0;
    const finish = () => {
      if (alive) {
        dayImgsRef.current = imgs;
        setDayImgsReady((v) => v + 1);
      }
    };
    log.forEach((m, i) => {
      if (!m.img) {
        imgs[i] = null;
        return;
      }
      pending++;
      const im = new Image();
      im.onload = () => {
        imgs[i] = im;
        if (++done === pending) finish();
      };
      im.onerror = () => {
        imgs[i] = null;
        if (++done === pending) finish();
      };
      im.src = m.img;
    });
    if (pending === 0) finish();
    return () => {
      alive = false;
    };
  }, [shareMode, log]);

  function onPick() {
    if (fileRef.current) fileRef.current.click();
  }
  function onPickLib() {
    if (libRef.current) libRef.current.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1024;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const cw = Math.max(1, Math.round(img.width * scale));
        const ch = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement("canvas");
        cv.width = cw;
        cv.height = ch;
        cv.getContext("2d")!.drawImage(img, 0, 0, cw, ch);
        let jpeg: string;
        try {
          jpeg = cv.toDataURL("image/jpeg", 0.82);
        } catch {
          jpeg = reader.result as string;
        }
        setPreview(jpeg);
        setScreen("analyzing");
        analyze(jpeg.split(",")[1], "image/jpeg");
      };
      img.onerror = () => {
        setError("Couldn't open that image file — try a different photo.");
        setScreen("review");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    // allow re-selecting the same file
    e.target.value = "";
  }

  async function analyze(b64: string, mediaType: string) {
    try {
      const parsed = await analyzeMeal(b64, mediaType);
      setData(parsed);
      setSel({});
      setAdj({ p: "", c: "", f: "" });
      setShowAdj(false);
      setScreen("review");
    } catch (err: any) {
      const msg = err && err.message ? err.message : "unknown error";
      setError(msg + " — if this keeps happening, use Enter manually below.");
      setScreen("review");
    }
  }

  function choose(qi: number, oi: number) {
    setSel((prev) => ({ ...prev, [qi]: oi }));
  }
  function addToToday() {
    setLog((prev) => [...prev, { name: data!.title, ...totals, img: preview }]);
    reset();
  }
  function reset() {
    setScreen("capture");
    setData(null);
    setSel({});
    setPreview(null);
    setError(null);
    setShareMode("meal");
    setReshare(false);
    setEditIdx(null);
    setAdj({ p: "", c: "", f: "" });
    setShowAdj(false);
  }
  // open the share screen for a previously logged meal
  function shareFromLog(m: LoggedMeal) {
    setData({ title: m.name, items: [], base: { kcal: m.kcal, p: m.p, c: m.c, f: m.f }, confidence: "logged", note: "", questions: [] });
    setSel({});
    setPreview(m.img || null);
    setShareMode("meal");
    setReshare(true);
    setScreen("share");
  }
  // open the end-of-day summary card
  function shareDay() {
    setShareMode("day");
    setReshare(true);
    setTab("cards");
    setScreen("share");
  }
  function deleteLog(i: number) {
    setLog((prev) => prev.filter((_, j) => j !== i));
  }
  function editLog(i: number) {
    const m = log[i];
    setManual({ title: m.name, kcal: String(m.kcal), p: String(m.p), c: String(m.c), f: String(m.f) });
    setEditIdx(i);
    setError(null);
    setScreen("manual");
  }
  function startManual() {
    setError(null);
    setEditIdx(null);
    setManual({ title: "", kcal: "", p: "", c: "", f: "" });
    setScreen("manual");
  }
  function submitManual() {
    if (editIdx != null) {
      const t = { kcal: +manual.kcal || 0, p: +manual.p || 0, c: +manual.c || 0, f: +manual.f || 0 };
      setLog((prev) => prev.map((m, j) => (j === editIdx ? { ...m, name: manual.title || "My meal", ...t } : m)));
      setEditIdx(null);
      setManual({ title: "", kcal: "", p: "", c: "", f: "" });
      setScreen("capture");
      return;
    }
    setData({
      title: manual.title || "My meal",
      items: [],
      base: { kcal: +manual.kcal || 0, p: +manual.p || 0, c: +manual.c || 0, f: +manual.f || 0 },
      confidence: "manual",
      note: "",
      questions: [],
    });
    setSel({});
    setScreen("review");
  }

  function cvBlob(): Blob {
    const cv = canvasRef.current!;
    const d = cv.toDataURL("image/png");
    const bin = atob(d.split(",")[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: "image/png" });
  }
  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "watt-energy.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  async function copyImg() {
    if (!canvasRef.current) return;
    try {
      if (!navigator.clipboard || !(window as any).ClipboardItem) throw new Error("no-clipboard");
      await navigator.clipboard.write([new (window as any).ClipboardItem({ "image/png": Promise.resolve(cvBlob()) })]);
      setCopied("ok");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        download(cvBlob());
        setCopied("saved");
        setTimeout(() => setCopied(false), 1800);
      } catch {}
    }
  }
  async function shareImg() {
    if (!canvasRef.current) return;
    const file = new File([cvBlob()], "watt-energy.png", { type: "image/png" });
    if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
      try {
        await (navigator as any).share({ files: [file] });
        return;
      } catch {}
    }
    download(cvBlob());
  }
  // write to the device photo library. Web falls back to a download; the native
  // path activates once wrapped in a Capacitor app shell (a later phase).
  async function saveToPhotos() {
    if (!canvasRef.current) return;
    const cap = (window as any).Capacitor;
    const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
    if (isNative) {
      try {
        const dataUrl = canvasRef.current.toDataURL("image/png");
        await (window as any).WattNative?.saveToPhotos?.(dataUrl);
        setSaved("photos");
        setTimeout(() => setSaved(false), 1800);
        return;
      } catch {
        /* fall through to download */
      }
    }
    try {
      download(cvBlob());
      setSaved("file");
      setTimeout(() => setSaved(false), 1800);
    } catch {}
  }

  const dayTotal = log.reduce((a, m) => a + m.kcal, 0);
  const dayMode = shareMode === "day";
  const styles = dayMode ? DAY_CARD_STYLES : tab === "cards" ? CARD_STYLES : STICKER_STYLES;
  const activeStyle = dayMode ? dayStyle : tab === "cards" ? cardStyle : stickerStyle;
  const setStyle = dayMode ? setDayStyle : tab === "cards" ? setCardStyle : setStickerStyle;

  return (
    <div className="fl-root">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
      <input ref={libRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      <div className="fl-wrap">
        <div className="fl-head">
          <div className="fl-brand">
            <div className="fl-logo">
              Watt
              <svg className="fl-bolt" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
              </svg>
            </div>
            <div className="fl-tag">scan · fuel · share</div>
          </div>
          {log.length > 0 && screen !== "share" && (
            <div className="fl-today">
              <div className="n">{dayTotal.toLocaleString()}</div>
              <div className="l">kcal today</div>
            </div>
          )}
        </div>

        {screen === "capture" && (
          <div className="fl-hero">
            <h1>
              Share your whole <em>performance</em>.
            </h1>
            <p>Energy in, energy out — one card. Everyone shares a workout. Show the full story.</p>
            <button className="fl-shoot" onClick={onPick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2l1-1.6A1.5 1.5 0 0 1 9 3.7h6a1.5 1.5 0 0 1 1.3.7l1 1.6h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
                <circle cx="12" cy="12" r="3.4" />
              </svg>
              <span>Snap a meal</span>
            </button>
            <div className="fl-hint">
              <b>Pro tip:</b> shoot from above, good light, whole plate in frame.
            </div>
            <button className="fl-upload" onClick={onPickLib}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <circle cx="8.5" cy="10" r="1.6" />
                <path d="M21 16l-5-5-7 7" />
              </svg>
              Upload from camera roll
            </button>
            <button className="fl-manual-link" onClick={startManual}>
              or enter macros manually
            </button>
            {log.length > 0 && (
              <div className="fl-log">
                <div className="fl-log-h">
                  Logged today <span className="fl-log-hint">tap to share</span>
                </div>
                {log.map((m, i) => (
                  <div className="fl-log-row" key={i}>
                    <button className="fl-log-tap" onClick={() => shareFromLog(m)}>
                      <div className="fl-log-left">
                        {m.img && <img className="fl-log-thumb" src={m.img} alt="" />}
                        <div className="fl-log-txt">
                          <div className="nm">{m.name}</div>
                          <div className="mc">
                            {m.p}p · {m.c}c · {m.f}f
                          </div>
                        </div>
                      </div>
                      <div className="kc">
                        {m.kcal}
                        <svg className="fl-log-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </div>
                    </button>
                    <div className="fl-log-acts">
                      <button onClick={() => editLog(i)} aria-label="edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                      <button onClick={() => deleteLog(i)} aria-label="delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                <button className="fl-day-cta" onClick={shareDay}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="17" rx="2.5" />
                    <path d="M3 9h18M8 2v4M16 2v4" />
                  </svg>
                  Share today's totals · {dayTotal.toLocaleString()} kcal
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "analyzing" && (
          <div className="fl-scan">
            <div className="fl-scanimg">
              {preview && <img src={preview} alt="meal" />}
              <div className="fl-scanline" />
            </div>
            <h2>Calculating macros</h2>
            <p className="fl-dots">
              Crunching the numbers<span>.</span>
              <span>.</span>
              <span>.</span>
            </p>
          </div>
        )}

        {screen === "review" && (
          <div className="fl-review">
            {error && (
              <>
                <div className="fl-error">{error}</div>
                <button className="fl-share-cta" onClick={startManual}>
                  Enter macros manually
                </button>
              </>
            )}
            {data && !error && (
              <>
                <div className="fl-mealname">{data.title}</div>
                <div className="fl-total-card">
                  <div className="fl-total-l">Estimated total</div>
                  <div>
                    <span className={"fl-total-n" + (pop ? " pop" : "")}>
                      {totals.kcal.toLocaleString()}
                      <em>kcal</em>
                    </span>
                  </div>
                  <div className="fl-conf">
                    <i />
                    {data.confidence === "manual" ? "manually entered" : data.confidence + " confidence on the photo alone"}
                  </div>
                  <div className="fl-macros">
                    <div className="fl-macro p">
                      <div className="v">
                        {totals.p}
                        <span style={{ fontSize: 11 }}>g</span>
                      </div>
                      <div className="k">Protein</div>
                    </div>
                    <div className="fl-macro c">
                      <div className="v">
                        {totals.c}
                        <span style={{ fontSize: 11 }}>g</span>
                      </div>
                      <div className="k">Carbs</div>
                    </div>
                    <div className="fl-macro f">
                      <div className="v">
                        {totals.f}
                        <span style={{ fontSize: 11 }}>g</span>
                      </div>
                      <div className="k">Fat</div>
                    </div>
                  </div>
                </div>
                {data.items && data.items.length > 0 && (
                  <div className="fl-items">
                    {data.items.map((it, i) => (
                      <span className="fl-item" key={i}>
                        <b>{it.n}</b> {it.kcal}
                      </span>
                    ))}
                  </div>
                )}
                {data.note && <div className="fl-note">{data.note}</div>}

                {data.questions && data.questions.length > 0 && (
                  <>
                    <div className="fl-section-h">
                      <span className="t">The hidden bit</span>
                      <span className="b">+{Math.max(0, totals.kcal - data.base.kcal)} so far</span>
                    </div>
                    <p className="fl-section-sub">The calories that get undercounted. Tap what's true — the total updates live.</p>
                    {data.questions.map((q, qi) => (
                      <div className="fl-q" key={qi}>
                        <div className="fl-q-top">
                          <div className="fl-q-ic">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18" />
                              <circle cx="12" cy="12" r="3.2" />
                            </svg>
                          </div>
                          <div className="fl-q-txt">
                            <div className="q">{q.q}</div>
                            <div className="why">{q.why}</div>
                          </div>
                        </div>
                        <div className="fl-opts">
                          {q.opts.map((o, oi) => {
                            const active = (sel[qi] ?? 0) === oi;
                            const zero = (o.kcal || 0) === 0;
                            return (
                              <button key={oi} className={"fl-opt" + (active ? " sel" : "") + (active && zero ? " zero" : "")} onClick={() => choose(qi, oi)}>
                                {o.l}
                                {(o.kcal || 0) > 0 && <span className="d">+{o.kcal}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <button className="fl-finetune-toggle" onClick={() => setShowAdj((v) => !v)}>
                  <span>Fine-tune grams</span>
                  <span className="fl-finetune-chev">{showAdj ? "–" : "+"}</span>
                </button>
                {showAdj && (
                  <div className="fl-finetune">
                    <p className="fl-finetune-sub">Add grams the photo missed — calories update automatically (4/4/9).</p>
                    <div className="fl-mrow">
                      <label className="fl-field">
                        <span>+ Protein g</span>
                        <input inputMode="numeric" value={adj.p} onChange={(e) => setAdj({ ...adj, p: e.target.value })} placeholder="0" />
                      </label>
                      <label className="fl-field">
                        <span>+ Carbs g</span>
                        <input inputMode="numeric" value={adj.c} onChange={(e) => setAdj({ ...adj, c: e.target.value })} placeholder="0" />
                      </label>
                      <label className="fl-field">
                        <span>+ Fat g</span>
                        <input inputMode="numeric" value={adj.f} onChange={(e) => setAdj({ ...adj, f: e.target.value })} placeholder="0" />
                      </label>
                    </div>
                  </div>
                )}

                <button className="fl-share-cta" onClick={() => setScreen("share")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                    <path d="M12 3v13M8 7l4-4 4 4" />
                  </svg>
                  Share
                </button>
              </>
            )}
          </div>
        )}

        {screen === "manual" && (
          <div className="fl-manual">
            <div className="fl-mealname">{editIdx != null ? "Edit meal" : "Enter it manually"}</div>
            <div className="fl-mform">
              <label className="fl-field">
                <span>Meal name</span>
                <input value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Pan-fried sea bass" />
              </label>
              <label className="fl-field">
                <span>Calories (kcal)</span>
                <input inputMode="numeric" value={manual.kcal} onChange={(e) => setManual({ ...manual, kcal: e.target.value })} placeholder="780" />
              </label>
              <div className="fl-mrow">
                <label className="fl-field">
                  <span>Protein g</span>
                  <input inputMode="numeric" value={manual.p} onChange={(e) => setManual({ ...manual, p: e.target.value })} placeholder="53" />
                </label>
                <label className="fl-field">
                  <span>Carbs g</span>
                  <input inputMode="numeric" value={manual.c} onChange={(e) => setManual({ ...manual, c: e.target.value })} placeholder="60" />
                </label>
                <label className="fl-field">
                  <span>Fat g</span>
                  <input inputMode="numeric" value={manual.f} onChange={(e) => setManual({ ...manual, f: e.target.value })} placeholder="33" />
                </label>
              </div>
            </div>
            {preview && <p className="fl-tip">Your photo's attached — it'll show on the photo cards.</p>}
          </div>
        )}

        {screen === "share" && (data || dayMode) && (
          <div className="fl-share">
            {dayMode ? (
              <div className="fl-day-head">Today's recap</div>
            ) : (
              <div className="fl-tabs">
                <button className={"fl-tab" + (tab === "cards" ? " active" : "")} onClick={() => setTab("cards")}>
                  Full cards
                </button>
                <button className={"fl-tab" + (tab === "stickers" ? " active" : "")} onClick={() => setTab("stickers")}>
                  Stickers
                </button>
              </div>
            )}
            <div className={"fl-preview" + (tab === "stickers" && !dayMode ? " checker" : "")}>
              <canvas ref={canvasRef} className="fl-canvas" />
            </div>
            <div className="fl-styles">
              {styles.map((s) => (
                <button key={s.id} className={"fl-style" + (activeStyle === s.id ? " active" : "")} onClick={() => setStyle(s.id)}>
                  {s.name}
                  {(s as any).tag && <span className="st">{(s as any).tag}</span>}
                </button>
              ))}
            </div>
            {dayMode && dayStyle === "energy" && (
              <div className="fl-activity">
                <div className="fl-activity-h">Your training today</div>
                <p className="fl-activity-sub">This is the half other apps can't share. Toggle what to showcase.</p>
                <label className="fl-act-kcal">
                  <span>
                    Calories burned<i>energy out</i>
                  </span>
                  <input inputMode="numeric" value={act.kcal} onChange={(e) => setAct((a) => ({ ...a, kcal: e.target.value }))} placeholder="640" />
                </label>
                {[
                  { key: "steps", label: "Steps", unit: "", ph: "12,500" },
                  { key: "run", label: "Run", unit: "km", ph: "10" },
                  { key: "bike", label: "Bike", unit: "km", ph: "25" },
                  { key: "swim", label: "Swim", unit: "yd", ph: "800" },
                ].map((f) => (
                  <div className={"fl-act-row" + ((actOn as any)[f.key] ? " on" : "")} key={f.key}>
                    <button className={"fl-toggle sm" + ((actOn as any)[f.key] ? " on" : "")} onClick={() => setActOn((o) => ({ ...o, [f.key]: !(o as any)[f.key] }))} aria-label={"toggle " + f.label}>
                      <span />
                    </button>
                    <span className="fl-act-label">{f.label}</span>
                    <div className="fl-act-input">
                      <input inputMode="numeric" value={(act as any)[f.key]} onChange={(e) => setAct((a) => ({ ...a, [f.key]: e.target.value }))} placeholder={f.ph} />
                      {f.unit && <span className="u">{f.unit}</span>}
                    </div>
                  </div>
                ))}
                <p className="fl-tip">Energy in = today's logged meals. Energy out = what you enter here.</p>
              </div>
            )}
            <div className="fl-handle-row">
              <button className={"fl-toggle" + (showHandle ? " on" : "")} onClick={() => setShowHandle((v) => !v)}>
                <span />
              </button>
              <span className="fl-handle-l">Add my handle</span>
              {showHandle && <input className="fl-handle-in" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="yourhandle" />}
            </div>
            {tab === "stickers" && !dayMode && <p className="fl-tip">Transparent PNG — Copy it, or Save and drop it onto your own Story photo or video.</p>}
            {dayMode && <p className="fl-tip">Your whole day in one card — meals, totals and macros. Save it or share straight to your Story.</p>}
          </div>
        )}
      </div>

      {screen === "review" && (
        <div className="fl-bar">
          <button className="fl-btn ghost" onClick={reset} aria-label="retake">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 4v4h4" />
            </svg>
          </button>
          {data && !error && (
            <button className="fl-btn primary" onClick={addToToday}>
              Add {totals.kcal.toLocaleString()} kcal to today
            </button>
          )}
          {error && (
            <button className="fl-btn primary" onClick={reset}>
              Try another photo
            </button>
          )}
        </div>
      )}

      {screen === "manual" && (
        <div className="fl-bar">
          <button className="fl-btn ghost" onClick={() => setScreen("capture")} aria-label="back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="fl-btn primary" onClick={submitManual}>
            {editIdx != null ? "Save" : "Continue"}
          </button>
        </div>
      )}

      {screen === "share" && (
        <div className="fl-bar">
          <button
            className="fl-btn ghost"
            onClick={() => {
              if (reshare || dayMode) {
                setShareMode("meal");
                setReshare(false);
                setScreen("capture");
              } else setScreen("review");
            }}
            aria-label="back"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="fl-btn outline" onClick={copyImg}>
            {copied === "ok" ? "Copied ✓" : copied === "saved" ? "Saved ✓" : "Copy"}
          </button>
          <button className="fl-btn outline" onClick={saveToPhotos}>
            {saved === "photos" ? "Saved ✓" : saved === "file" ? "Downloaded ✓" : "Save"}
          </button>
          <button className="fl-btn primary" onClick={shareImg}>
            Share
          </button>
        </div>
      )}
    </div>
  );
}
