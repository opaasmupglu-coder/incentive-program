// Re-seed ONLY the structural reference data: offices + settings.
// Usage:
//   TURSO_DATABASE_URL='libsql://...' TURSO_AUTH_TOKEN='...' node scripts/seed-reference.mjs
//   TURSO_DATABASE_URL=file:./local.db node scripts/seed-reference.mjs
// It does NOT touch prev_scores, prizes, monthly inputs, or validator
// scores — those stay exactly as they are. Use scripts/seed.mjs to restore
// the full reference set (offices, settings, prev_scores, prizes).
// Writes are sent in small batched requests with a retry per chunk, because
// some networks (egress proxies) drop the connection mid-seed.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("Missing TURSO_DATABASE_URL");
  process.exit(1);
}
if (!url.startsWith("file:") && !authToken) {
  console.error("Missing TURSO_AUTH_TOKEN (required for a remote database)");
  process.exit(1);
}

const data = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "seed-data.json"), "utf-8")
);

const db = createClient({ url, authToken });

async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`${label} failed (attempt ${attempt}/3): ${err.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS offices (
     code TEXT PRIMARY KEY, short TEXT, full_name TEXT, track TEXT,
     focal_name TEXT, focal_position TEXT, notes TEXT, sort_order INTEGER)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
];

const stmts = DDL.map((sql) => ({ sql, args: [] }));
for (const o of data.offices) {
  stmts.push({
    sql: `INSERT OR REPLACE INTO offices
      (code, short, full_name, track, focal_name, focal_position, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [o.code, o.short, o.full_name, o.track, o.focal_name, o.focal_position, o.notes, o.sort_order],
  });
}
for (const [key, value] of Object.entries(data.settings)) {
  stmts.push({
    sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    args: [key, value],
  });
}

const CHUNK = 25;
for (let i = 0; i < stmts.length; i += CHUNK) {
  const n = i / CHUNK + 1;
  const total = Math.ceil(stmts.length / CHUNK);
  await withRetry(() => db.batch(stmts.slice(i, i + CHUNK), "write"), `chunk ${n}/${total}`);
}

const countsRow = await withRetry(
  () =>
    db.execute(
      `SELECT (SELECT COUNT(*) FROM offices) AS offices, (SELECT COUNT(*) FROM settings) AS settings`
    ),
  "counts"
);
const counts = {};
for (const [k, v] of Object.entries(countsRow.rows[0])) counts[k] = Number(v);
console.log("Reference seed complete:", JSON.stringify(counts));
