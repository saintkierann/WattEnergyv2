# Deploying Watt Energy to Vercel (GitHub web)

These steps use the **GitHub website** (no GitHub Desktop, no terminal). Your local
`git` is currently broken (Xcode Command Line Tools missing), so we upload the source
through the browser instead.

To avoid uploading `node_modules` or any secret, use the pre-made clean folder:

    /Users/kieran/Desktop/watt-energy-github

It contains only the 24 files that belong on GitHub.

---

## Step 1 — Create an empty repo

1. Go to https://github.com/new (signed in as **saintkierann**).
2. Repository name: `watt-energy`. Public or Private — both work with Vercel.
3. **Do NOT** check "Add a README", `.gitignore`, or license — the repo must be empty.
4. Click **Create repository**.

## Step 2 — Upload the files

1. On the new empty repo page, click the link **"uploading an existing file"**
   (or go to `https://github.com/saintkierann/watt-energy/upload/main`).
2. Open the `watt-energy-github` folder on your Desktop in Finder.
   - To include the dotfiles (`.gitignore`, `.env.example`), press **Cmd + Shift + .**
     in Finder to reveal hidden files. (They're optional — the deploy works without them.)
3. Select everything in that folder (**Cmd + A**) and **drag it onto the GitHub upload
   area**. The `api/` and `src/` folders keep their structure.
4. Wait for the uploads to finish, scroll down, and click **Commit changes**.

Your code is now on GitHub.

---

## Step 3 — Import into Vercel

1. Go to https://vercel.com and **sign in with GitHub** (saintkierann).
2. **Add New… → Project**.
3. If prompted, **install the Vercel GitHub app** and give it access to the
   `watt-energy` repo (you can limit it to just that one).
4. Click **Import** next to `watt-energy`.
5. Leave the auto-detected settings as-is:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - (`api/` is auto-detected as a serverless function — nothing to configure.)

## Step 4 — Add your API key

1. Expand **Environment Variables** on the import screen (or later: Project →
   Settings → Environment Variables).
2. Add:
   - **Name:** `ANTHROPIC_API_KEY`  **Value:** your key (`sk-ant-...`)
   - *(optional)* **Name:** `ANTHROPIC_MODEL`  **Value:** `claude-sonnet-4-6`
     (cheaper per scan than the default `claude-opus-4-8`)
3. Apply to **Production**.

> The key stays server-side and is never sent to the browser. Scanning needs a
> **funded** Anthropic key (each scan = one paid vision call). Without it, the live
> site still works for manual entry and previewing share cards.

## Step 5 — Deploy

Click **Deploy**. In ~1 minute you'll get a live URL like
`https://watt-energy.vercel.app`. Open it on your phone and try a scan.

If you added the key *after* the first deploy: Project → Deployments → ⋯ → **Redeploy**.

---

## Updating later

To push changes from the web: open the repo on github.com, navigate to the file (or
**Add file → Upload files**), edit/commit. Vercel redeploys automatically on each commit.

When you want a smoother update workflow than the web uploader, the longer-term fix is
to repair git locally (`xcode-select --install`) and push from the terminal — but
that's optional and not needed to ship this MVP.
