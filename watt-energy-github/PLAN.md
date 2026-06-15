# Watt Energy — Build & Improvement Plan

**Goal:** Turn the Projects prototype (`watt-energy.jsx`) into a deployable web app,
**live on Vercel**, focused on the loop: **scan a meal → confirm exact macros & add
hidden ingredients the camera can't see → share pre-made stickers/dashboards.**

## North-star sequencing
1. **MVP — live on Vercel** (this round). Web, no login, on-device storage.
2. **Fast-follow — accounts + cloud sync** (Supabase).
3. **Later — native iOS** (Capacitor wrapping the same web app) → App Store.

**Decisions locked in**
- **First target:** Web app, **deployed on Vercel**. iOS deferred.
- **MVP backend:** A single **Vercel serverless function** that proxies the Claude
  vision call and hides the API key. No database, no auth in the MVP.
- **MVP persistence:** **On-device** (IndexedDB/localStorage) — the day's log
  survives refresh without a backend.
- **iOS later:** **Capacitor** (not React Native) — it wraps the existing React +
  HTML Canvas app unchanged. React Native would force a rewrite of every share
  renderer, so Capacitor protects the work we do now.
- **Focus this round:** Deployability · UI/UX polish · More share assets · Scanner accuracy.

---

## 1. Current state — what we're starting from

A single ~800-line `FoodLens` component (React + inline CSS) that already implements
the full UX flow. Strong prototype, **not yet deployable**:

| Blocker | Detail | MVP fix |
|---|---|---|
| **API key exposed / sandbox-only** | Calls `api.anthropic.com` directly from the browser with no auth — only works inside the Projects sandbox. | **Vercel serverless function** proxy holds the key. |
| **No persistence** | `log` is `useState` — the day's meals vanish on refresh. | IndexedDB on-device store. |
| **Single-file / no build** | One `.jsx`, no bundler, no TS. | Vite + React + TypeScript scaffold. |
| **Stale model id** | `claude-sonnet-4-20250514` hardcoded client-side. | Server-set, current model id. |

**Keep (carries over unchanged):** the canvas renderers (`drawCard`, `drawSticker`,
`drawDayCard`), the design language (palette, Archivo type), the "hidden calories"
questioning flow, and the energy in/out concept.

**Deferred to fast-follow (NOT in MVP):** Supabase auth, cloud sync, accounts,
photo storage.

---

## 2. MVP architecture (Vercel)

```
┌──────────────── Browser (mobile-first PWA) ────────────────┐
│  React + TypeScript (Vite), served by Vercel               │
│   • Screens: capture → analyzing → review → manual → share │
│   • Canvas renderers (cards / stickers / day)  ← reused     │
│   • On-device store: IndexedDB (day log + settings)        │
└───────────────┬────────────────────────────────────────────┘
                │ POST /api/analyze-meal   (same origin)
┌───────────────▼──────────── Vercel ────────────────────────┐
│  Serverless function /api/analyze-meal                     │
│   • ANTHROPIC_API_KEY in Vercel env vars (never shipped)    │
│   • injects system prompt server-side                      │
│   • validates JSON, rate-limits, typed errors              │
│   → Anthropic vision API                                    │
└────────────────────────────────────────────────────────────┘
```

Everything is one Vercel project: the static React app **and** the `/api` function
deploy together. No separate backend to manage for the MVP.

---

## 3. The scanner proxy (`/api/analyze-meal`)

- Accepts `{ imageBase64, mediaType }`.
- Holds `ANTHROPIC_API_KEY` in Vercel env vars; injects the system prompt
  server-side (prompt tuning ships without an app rebuild).
- Uses a **current Claude vision model** set server-side (verify the latest id at
  build time — don't reuse `claude-sonnet-4-20250514`).
- Adds: input size cap, basic per-IP rate limiting, JSON-shape validation, and a
  typed error contract the client renders nicely.
- Returns the **same JSON schema** the prototype already parses (`base`,
  `questions`, …) so the review screen logic is unchanged.

---

## 4. Workstreams (mapped to your four focus areas)

### A. Deployability (foundation — do first)
1. Scaffold **Vite + React + TypeScript**; port `FoodLens` into typed modules:
   `renderers/` (card, sticker, day), `screens/`, `lib/canvas.ts`, `lib/api.ts`,
   `store/` (on-device state).
2. Build **`/api/analyze-meal`**; point the client at it; move the prompt + model
   server-side.
3. **On-device persistence:** day log + settings in IndexedDB.
4. **Vercel deploy:** project config, env vars, preview + production. *Live-URL milestone.*
5. PWA basics: installable manifest, mobile viewport, camera input on web.

### B. UI/UX polish
1. **Design-system pass:** tokenize the palette/spacing/type already in `CSS` into a
   small component kit; keep the editorial Archivo look.
2. **Onboarding** (3 cards: scan → confirm hidden calories → share the whole story).
3. **Capture screen** — better camera affordance + framing guide ("plate in frame").
4. **Analyzing state** — richer scan animation + skeletons.
5. **Review screen** — smoother live-total animation, clearer "hidden bit" affordance.
6. Motion/micro-interactions, empty states, accessibility (contrast, reduced-motion),
   dark mode.
   - *Optional:* run the `ui-ux-pro-max` skill to drive the visual system.

### C. More share assets
1. Refactor renderers into a **registry** so adding a style = one entry + one function.
2. New **stickers** (minimal badge, receipt/ticket, gradient, etc.).
3. New **cards** (weekly recap, streak, achievement) — some need the fast-follow
   history data, so MVP ships the per-meal + per-day set that already exists.
4. Customization: more palettes/fonts, handle placement, **visual template
   thumbnails** (render previews so users pick by look, not name).
5. Export polish: crisp @2x/@3x, correct color profile, Story share/deep-link.

### D. Scanner accuracy
1. Iterate the prompt server-side; add a small few-shot calibration set.
2. Improve the **ingredient-adjustment** flow (the "camera can't see" step): smarter
   default questions, per-item editing, quick "+oil/+rice/+sauce" chips.
3. Optional portion-size assist (reference object / plate size).

---

## 5. Suggested sequencing

- **Phase 0 — MVP live on Vercel:** Vite/TS scaffold, port renderers, `/api`
  proxy, IndexedDB store, deploy. *→ a real public URL where scan → review → share
  works.*
- **Phase 1 — Polish & assets:** design-system pass, onboarding, new
  stickers/cards, scanner-flow improvements.
- **Phase 2 — Accounts + cloud sync (fast-follow):** Supabase auth, meal history,
  cross-device sync, photo storage, streaks/trends.
- **Phase 3 — Native iOS:** Capacitor shell, native camera / save-to-Photos /
  share / haptics, Sign in with Apple, TestFlight → App Store.

---

## 6. Open items to confirm
- **Anthropic billing** for production scan volume (each scan = one paid vision call).
- App name / wordmark conventions (currently `WATT ENERGY`).
- Domain for the Vercel deploy (custom domain vs. `*.vercel.app` for now).
- Monetization direction (free vs. paywall later) — informs the fast-follow data model.
- Photo handling/privacy stance once cloud storage arrives.
