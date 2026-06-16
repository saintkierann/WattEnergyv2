# Watt Energy — MVP

Scan a meal → confirm the macros the camera can't see → share a ready-made card or
sticker. Mobile-first web app (React + TypeScript + Vite), deployable to Vercel.

This is the **Phase 0 MVP**: scanner proxy + on-device persistence, no login.
See [PLAN.md](PLAN.md) for the full roadmap (accounts/sync and native iOS come later).

## Run locally

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open the printed URL (default http://localhost:5173).

- **Scanning a photo** needs `ANTHROPIC_API_KEY` in `.env.local`.
- **Manual macro entry** works with no key — handy for previewing the UI and the
  share cards/stickers without spending API credits.

The day's meal log (with photos) is saved on-device via IndexedDB, so it survives
a refresh. There is no server-side storage in this MVP.

## How it works

```
Browser (React)  ──POST /api/analyze-meal──►  serverless proxy  ──►  Anthropic vision API
   • screens: capture → analyzing → review → manual → share
   • canvas renderers: cards / stickers / day-summary
   • IndexedDB: day log + settings
```

The Anthropic key is **never** shipped to the browser. The same proxy logic
([src/server/analyzeMeal.ts](src/server/analyzeMeal.ts)) runs as:

- a **Vercel serverless function** in production ([api/analyze-meal.ts](api/analyze-meal.ts)), and
- a **Vite dev middleware** locally ([vite.config.ts](vite.config.ts)).

### Model

Defaults to `claude-opus-4-8` (most capable, supports vision). Each scan is one paid
vision call, so for a high-volume consumer app you may want a cheaper model — set
`ANTHROPIC_MODEL=claude-sonnet-4-6` (or `claude-haiku-4-5`) in your env to switch.

## Deploy to Vercel

1. Push this folder to a Git repo and import it into Vercel (it auto-detects Vite +
   the `/api` function — no config needed).
2. In the Vercel project settings, add the env var **`ANTHROPIC_API_KEY`** (and
   optionally `ANTHROPIC_MODEL`).
3. Deploy. The static app and the `/api/analyze-meal` function ship together.

## Project layout

```
api/analyze-meal.ts        Vercel serverless proxy (prod)
src/server/                shared proxy logic + prompt (key stays here)
src/renderers/             canvas card / sticker / day-summary renderers
src/lib/                   canvas helpers, API client, IndexedDB store
src/App.tsx                the app (capture → review → share flow)
vite.config.ts             dev server + local /api middleware
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with the local scanner proxy |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check without emitting |
