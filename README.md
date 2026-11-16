# 2026 Customer Feedback Incentive Program — web app

Next.js (App Router + TypeScript) front-end backed by a **Turso (libSQL)**
database. The app reads the tables and computes every ranking itself —
there is no spreadsheet behind it anymore. Seed data (offices, settings,
previous-round validator scores, prizes) was taken once from the v2
workbook; monthly inputs and validator scores start empty.

## How it works

The workspace uses self-hosted Inter fonts, a compact sidebar, and a dashboard
with one suggested next action. **Enter monthly scores** shows one office,
reporting month, and category at a time. Month navigation keeps unsaved edits;
an optional **View all months** summary lets you review and jump to another month.
Save changes before switching office or category. Blank months mean no data and
clear a previously saved month; zero remains an actual recorded value. Overall
ratings accept percentages with decimals (for example, 95.63).

**Validator ratings** separates office and focal-person questions into tabs and
keeps the progress table collapsed until needed. Rankings and final results
offer track filters and CSV exports. **Offices & focal persons** displays six
offices per page and keeps edits when moving between pages.

**Initial rankings & Top 5** shows running totals and provisional ranks while
criteria are incomplete. Each criterion displays its weighted score followed by
the actual average in parentheses. Missing criteria remain blank. Provisional
totals and Top 5 are for display only; official qualification still requires
all four criteria. Evaluation settings put Frontline and Non-frontline weights
in separate cards, each with its own 100% total.

**Offices & people** lets you search by office or person, edit focal names and
positions, and save changed offices together. Focal-person names appear in the
final results with their office beneath them. **Program settings** groups
validators, evaluation weights, and scoring rules into separate tabs and checks
weight totals before saving. **Customize** saves accent color, display density,
and dashboard visibility preferences in the current browser.

**Working days** uses the supplied [2026 PGLU calendar](https://docs.google.com/spreadsheets/d/1zhifhQ85bDP2kxqSDgMkRNZFkOCHMuMx/edit?gid=509378758).
The 365 daily records are imported into `working_days` on first use; existing
records are preserved. Timeliness counts working days from release through
receipt, inclusive of both dates, using the calendar's holiday, suspension, and
four-day-week flags. Monthly entry stores both dates in `timeliness_dates` and
saves the calculated day count atomically with the monthly score. You can also
enter a day count directly. The reference import is a snapshot of the sheet on
2026-11-16, not a live Google Sheets sync.

Run `npx tsx scripts/verify-working-days.ts` to verify source coverage, monthly
counts, inclusive counting, and missing/out-of-range date handling. Existing
scoring and ranking vectors remain available via `npm run verify:vectors`.

- `GET /api/snapshot` — reads the Turso tables, computes all monthly rates,
  Initial totals and ranks, the top 5 per track, validator averages and
  Final results, and returns one JSON snapshot. Server-side in-memory cache,
  TTL 30 s, stale-while-revalidate; the client polls every 30 s, refetches
  on window focus / reconnect, and refetches immediately after any save.
- `POST /api/monthly` — upserts one office + criterion's 10 month values
  (a blank month deletes that month's row — blank means "no data", never 0).
- `POST /api/scores` — upserts validator scores (1–5) for one top-5 office
  + validator.
- `POST /api/settings` — updates settings rows (validator names, weights,
  mix, rules, timeliness bands, item weights).

## Environment variables (set in Vercel → Project → Settings → Environment Variables)

| Variable | Required | What it is |
|---|---|---|
| `TURSO_DATABASE_URL` | Yes | Turso database URL, e.g. `libsql://<db-name>-<org>.aws-<region>.turso.io`. For local dev: `file:./local.db`. |
| `TURSO_AUTH_TOKEN` | Yes (remote only) | Turso auth token for the database. Not needed for a local `file:` database. |
| `APP_PASSWORD_HASH` | No | If set, visitors must enter the app password once (httpOnly cookie) before using the app. If unset, the app works ungated. |

If `TURSO_DATABASE_URL` (or the token, for a remote database) is missing,
the app still loads and shows a clear "not connected yet" state naming the
missing env vars — it never crashes.

## App password (hashed, never plaintext)

The password is stored ONLY as a scrypt hash in `APP_PASSWORD_HASH`, format
`scrypt:<saltHex>:<derivedHex>`, produced with
`crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })` and a
16-byte random salt. Generate one locally (never commit the output):

```bash
node -e "const c=require('node:crypto');const s=c.randomBytes(16);console.log('scrypt:'+s.toString('hex')+':'+c.scryptSync(process.argv[1],s,64,{N:16384,r:8,p:1}).toString('hex'))" <password>
```

Put the printed hash in the Vercel env var. A wrong password fails; a
malformed hash fails closed.

## Seed the database

```bash
TURSO_DATABASE_URL=file:./local.db node scripts/seed.mjs   # local file DB
# or, for the real Turso database (URL + token from env):
TURSO_DATABASE_URL='libsql://...' TURSO_AUTH_TOKEN='...' node scripts/seed.mjs
```

The seed creates the tables and inserts offices, settings, previous-round
scores and prizes from `scripts/seed-data.json`. Monthly inputs and
validator scores start empty.

If your network cannot reach Turso directly, seed from the deployed app
instead: after the env vars are set, log in and POST to `/api/seed`
(it is behind the same password gate). It runs the same seed and returns
the row counts. Safe to run more than once — it never touches monthly
inputs or validator scores.

## Run locally

```bash
npm install
npm run build
npm start
```

## Deploy

The repo is connected to Vercel — every push to `main` auto-deploys.
Do not create a second Vercel project for this app.

## Rules the app computes (same as the old sheet's formulas)

- Resolution rate = acted/plans (blank if either is blank or plans = 0).
- Collection rate = min(1, forms / (clients × 384.16 / ((clients−1) + 384.16))),
  0 if forms < the track minimum (20 Frontline / 10 Non-frontline), blank if
  forms/clients are missing. The minimum-forms check precedes denominator
  validation, matching the FL and NFL sheet formulas: recorded 0 forms and
  0 visitors yield 0, while qualifying forms with 0 visitors remain unavailable.
- Timeliness score from days: ≤3 → 1.0, ≤5 → 0.8, ≤7 → 0.6, ≤10 → 0.4,
  ≤15 → 0.2, else 0.0. GPR rate = GPR / 100.
- Per-office averages average the monthly rates, ignoring blank months.
  Initial total = the four weighted points, only when all four criteria
  have at least one month of data.
- Top 5 per track by unique tie-break rank (ties break by office list
  order). Validator office/focal totals need all items scored; averages
  use only the validators who rated (a missing validator is not a zero).
- Final total = 60% × Initial + validator average, ranked among the 5.
