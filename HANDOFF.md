# P5 Social Dashboard – Handoff Guide

This document captures everything required for another agent to pick up the work on the P5 Social Dashboard. It explains environment setup, Airtable integration details, current UI requirements, and next steps.

---

## 1. Repository / Project Layout

```
pivot-5-website_11.19.25/
├── Dashboard.tsx                # original standalone dashboard component (not wired into Next.js project)
└── p5-dashboard/                # new Next.js 16 app (App Router, TS, Tailwind)
    ├── package.json
    ├── src/app/page.tsx         # entire dashboard UI + airtable fetch
    ├── src/app/layout.tsx
    ├── src/app/globals.css      # global styling (set to light background)
    └── ... (standard Next.js files)
```

*All active development is happening inside `p5-dashboard/`.*

---

## 2. Airtable Access

### API Key (PAT)
Store your Airtable PAT in env vars only (do not commit). Example names:
```
NEXT_PUBLIC_AIRTABLE_TOKEN=<YOUR_AIRTABLE_PAT>
```

### Current Base/Table Targets

| Purpose            | Base Name   | Base ID        | Table Name | Table ID      |
|--------------------|-------------|----------------|------------|---------------|
| Social posts feed  | `P5`        | `appRXkjvqEavU8Znj` | `Stories`   | `tblghZMRtNIPw7sTo` |
| (prior iteration)  | `P5 Social Posts` | `appRUgK44hQnXH1PM` | `Social Post Input` | `tbllJMN2QBPJoG3jA` |

The dashboard **now fetches from the `P5` base & `Stories` table** to align with the n8n/P5 pipeline (fields: `Headline`, `Label`, `B1/B2/B3`, Cloudinary image, etc.). If you need to switch bases, update the constants near the top of `src/app/page.tsx`.

### API Validation

To confirm access, run:
```bash
curl "https://api.airtable.com/v0/appRXkjvqEavU8Znj/Stories" \
  -H "Authorization: Bearer $NEXT_PUBLIC_AIRTABLE_TOKEN"
```
Returns HTTP 200 with `B1/B2/B3`, `Label`, `Image`, etc.

---

## 3. Front-End Stack & Commands

* Next.js 16 (App Router, TypeScript, Tailwind, Turbopack).
* Located in `p5-dashboard/`. Dependencies already installed via `npm install`.

Key scripts:
- `npm run dev` → launches dev server on `http://localhost:3000`.
- `npm run lint` → ESLint (TS/Next rules). Currently clean after recent fixes.
- `npm run build` → standard Next.js build (not run yet).

Dev server warning about multiple lockfiles can be ignored or fix by removing `/Users/patsimmons/package-lock.json` or setting `turbopack.root` in `next.config.ts`.

---

## 4. Dashboard Component Logic (`src/app/page.tsx`)

### Data Flow
1. On mount (`useEffect + fetchPosts`), call Airtable REST API: `GET https://api.airtable.com/v0/appRXkjvqEavU8Znj/Stories` with PAT header.
2. Normalize records:
   - **Headline** via field candidates (`Headline`, `Title`).
   - **Label** from `Label` column.
   - **Bullets** gather `B1`, `B2`, `B3` (case-insensitive) as ordered list; duplicates skipped.
   - **Image** from `Image`, `Cloudinary`, or fallback fields (ensures string/URL).
   - **CTA** fields currently unused (still supported by candidate arrays).
3. Render cards in 3-column grid (responsive). Each card includes: image, channel/status row, headline, label (uppercase orange), bullet list with orange dots, optional CTA button.
4. Refresh button triggers same fetch.
5. Status summary chips (counts by `Status`).
6. Empty state when no records available.

### Theming Requirements Implemented
- Background color set to `#f8f8f6` (globals + `<main>`).
- Cards white with subtle border/shadow, matching screenshot aesthetic.
- Bullet markers are small orange dots; label text uppercase orange.

### Image Handling
- Uses Next.js `<Image>` with `unoptimized` flag because images are remote; priority for first 6 cards.

### Type Safety
- Introduced `AirtableFields` alias to avoid `any`; `ensureString`/`findFieldValue` accept `unknown` and coerce to string when possible.

---

## 5. Outstanding / Optional Tasks

1. **Design polish**: match screenshot exactly (spacing, fonts, CTA buttons). Currently close but not pixel-perfect.
2. **CTA button**: hooking up to actual `URL` field and `CTA Label` if desired (data available but not always populated).
3. **Filtering / Sorting**: currently default Airtable order. Could use `sort` or `view` query parameters.
4. **Environment variables**: PAT + base ID are hard-coded per user instruction. For production, move to `.env.local` and reference via `process.env`.
5. **Deployment**: no production deploy yet. Use Vercel/Netlify etc. after env secrets set.

---

## 6. How to Continue Development

1. `cd /Users/patsimmons/client-coding/pivot-5-website_11.19.25/p5-dashboard`
2. `npm run dev`
3. Visit `http://localhost:3000`
4. Modify `src/app/page.tsx` for UI/data tweaks. `globals.css` for theme adjustments.
5. Use `npm run lint` before committing.

If the dev server reports "site can’t be reached," ensure no orphaned `next dev` process is running (`pkill -f "next dev"`).

---

## 7. Recent Adjustments (for context)
- Switched data source from `P5 Social Posts` base to `P5` base (`Stories` table).
- Confirmed API access via curl/node.
- Added label + bullet rendering and styled per screenshot.
- Set page background to light/white, orange bullet markers.
- Replaced `<img>` with Next `<Image>` (unoptimized) to satisfy ESLint.
- Added `HANDOFF.md` (this doc).

---

## 8. Contacts / Notes
- User expects immediate Airtable responsiveness; PAT is considered temporary and may change.
- n8n pipeline apparently populates `Stories` table (P5 base). Ensure data consistency there before testing UI changes.
- Image URLs appear to be from Cloudinary; allowing remote images without Next config due to `unoptimized` flag.

---

That’s everything needed for another agent to take over without context loss.

---

## 9. Website Setup (Step-by-Step)

Follow these steps on a clean machine to bring the dashboard up locally:

1) Install Node 18+ / npm (Next.js 16 requires at least Node 18). Verify with `node -v` / `npm -v`.

2) Install dependencies
```bash
cd /Users/patsimmons/client-coding/pivot-5-website_11.19.25/p5-dashboard
npm install
```

3) Run the dev server
```bash
npm run dev
# Opens on http://localhost:3000 (Network: http://192.168.1.215:3000)
```
If you see “site can’t be reached”, ensure no stray Next dev is running: `pkill -f "next dev"` then rerun.

4) Lint (optional before commit)
```bash
npm run lint
```

5) Build (for prod validation)
```bash
npm run build
```

6) Turbopack root warning
If the dev log warns about multiple lockfiles, either remove `/Users/patsimmons/package-lock.json` or set `turbopack: { root: "." }` in `next.config.ts`.

7) Environment / secrets
PAT and base/table IDs are hard-coded per user request. For production, move to `.env.local`:
```
NEXT_PUBLIC_AIRTABLE_TOKEN=<YOUR_AIRTABLE_PAT>
NEXT_PUBLIC_AIRTABLE_BASE_ID=appRXkjvqEavU8Znj
NEXT_PUBLIC_AIRTABLE_TABLE=Stories
```
Then update `page.tsx` to read from `process.env` instead of hard-coded constants.

8) Remote images
We use `<Image unoptimized />` to avoid configuring Next remote patterns. If you want optimization, add the Cloudinary domain to `next.config.ts` `images.remotePatterns` and remove `unoptimized`.

9) UI theming quick toggles
- Background color: `globals.css` and `main` wrapper use `#f8f8f6`.
- Card styling/layout in `page.tsx` under the `<main>` render.
- Orange bullet dots and label text inside the card body.

10) Testing the data source
As a quick smoke test you can call:
```bash
curl "https://api.airtable.com/v0/appRXkjvqEavU8Znj/Stories" \
  -H "Authorization: Bearer $NEXT_PUBLIC_AIRTABLE_TOKEN"
```
Expect HTTP 200 and fields including `Headline`, `Label`, `B1/B2/B3`, `Image`.

---

## 11. Running locally (updated env)

1) Ensure you are inside the Next app folder (not the parent):
```bash
cd /Users/patsimmons/client-coding/pivot-5-website_11.19.25/p5-dashboard
```

2) Install deps (only needed once per machine):
```bash
npm install
```

3) Env is now read from `.env.local` (create locally or in Vercel; do not commit secrets). Example:
```
NEXT_PUBLIC_AIRTABLE_TOKEN=...
NEXT_PUBLIC_AIRTABLE_BASE_ID=...
NEXT_PUBLIC_AIRTABLE_TABLE=...
```

4) Start dev server:
```bash
npm run dev
# opens http://localhost:3000
```
If port 3000 is busy, try: `HOST=0.0.0.0 PORT=3001 npm run dev`

If you are at the repo root (`.../pivot-5-website_11.19.25`) without changing into `p5-dashboard`, npm will report missing package.json.

---

## 12. Deploying to Vercel

Repo to use: https://github.com/per-simmons/pivot-5-website.git

Project root: set Vercel’s Root Directory to `p5-dashboard/` (in the Vercel dashboard). `vercel.json` simply runs install/build/output at repo root:
```json
{
  "version": 2,
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

Add env vars in Vercel Project Settings → Environment Variables:
```
NEXT_PUBLIC_AIRTABLE_TOKEN=<YOUR_AIRTABLE_PAT>
NEXT_PUBLIC_AIRTABLE_BASE_ID=appRUgK44hQnXH1PM
NEXT_PUBLIC_AIRTABLE_TABLE=Social Post Input
```

Build/runtime:
- Framework: Next.js (16)
- Install: `npm install`
- Build: `npm run build`
- Output: `.next` (inside p5-dashboard)

Optional git steps (if not yet pushed):
```
git init
npm install --prefix p5-dashboard
npm run lint --prefix p5-dashboard
# add/commit, then set remote github.com/per-simmons/pivot-5-website.git and push
```

Notes:
- Filtering uses last_modified/last_updated; base `appRUgK44hQnXH1PM` / `Social Post Input`.
- `.vercelignore` inside `p5-dashboard` excludes node_modules/.next from upload.
