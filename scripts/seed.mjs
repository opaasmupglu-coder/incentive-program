// Seed the Turso database: create tables + insert reference data.
// Usage:
//   TURSO_DATABASE_URL=file:./local.db node scripts/seed.mjs
//   TURSO_DATABASE_URL='libsql://...' TURSO_AUTH_TOKEN='...' node scripts/seed.mjs
// Reference data (offices, settings, prev_scores, prizes) comes from
// scripts/seed-data.json. Monthly inputs and validator scores start empty
// and are NOT touched by this script (re-running it never wipes them).
//
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
  `CREATE TABLE IF NOT EXISTS monthly_resolution (
     office_code TEXT, month INTEGER, acted INTEGER, plans INTEGER,
     PRIMARY KEY(office_code, month))`,
  `CREATE TABLE IF NOT EXISTS monthly_collection (
     office_code TEXT, month INTEGER, forms INTEGER, clients INTEGER,
     PRIMARY KEY(office_code, month))`,
  `CREATE TABLE IF NOT EXISTS monthly_gpr (
     office_code TEXT, month INTEGER, gpr INTEGER, PRIMARY KEY(office_code, month))`,
  `CREATE TABLE IF NOT EXISTS monthly_timeliness (
     office_code TEXT, month INTEGER, days INTEGER, PRIMARY KEY(office_code, month))`,
  `CREATE TABLE IF NOT EXISTS validator_scores (
     track TEXT, rank INTEGER, validator TEXT, office_code TEXT,
     car INTEGER, onsite INTEGER, best INTEGER, interview INTEGER,
     ccarta INTEGER, innovation INTEGER, responsive INTEGER, prof INTEGER, comms INTEGER,
     PRIMARY KEY(track, rank, validator))`,
  `CREATE TABLE IF NOT EXISTS prev_scores (
     validator TEXT, office_code TEXT, car INTEGER, onsite INTEGER, best INTEGER,
     interview INTEGER, ccarta INTEGER, innovation INTEGER, responsive INTEGER,
     prof INTEGER, comms INTEGER)`,
  `CREATE TABLE IF NOT EXISTS prizes (
     office_code TEXT, item TEXT, focal_name TEXT, focal_position TEXT,
     status TEXT, notes TEXT, PRIMARY KEY(office_code, item))`,
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
for (const p of data.prev_scores) {
  stmts.push({
    sql: `INSERT OR REPLACE INTO prev_scores
      (validator, office_code, car, onsite, best, interview, ccarta, innovation, responsive, prof, comms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [p.validator, p.office_code, p.car, p.onsite, p.best, p.interview, p.ccarta, p.innovation, p.responsive, p.prof, p.comms],
  });
}
for (const p of data.prizes) {
  stmts.push({
    sql: `INSERT OR REPLACE INTO prizes
      (office_code, item, focal_name, focal_position, status, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [p.office_code, p.item, p.focal_name, p.focal_position, p.status, p.notes],
  });
}

// Send in small chunks of 25 statements per request, retrying each chunk.
const CHUNK = 25;
for (let i = 0; i < stmts.length; i += CHUNK) {
  const n = i / CHUNK + 1;
  const total = Math.ceil(stmts.length / CHUNK);
  await withRetry(() => db.batch(stmts.slice(i, i + CHUNK), "write"), `chunk ${n}/${total}`);
}

// All counts in a single query.
const COUNT_SQL = `SELECT
  (SELECT COUNT(*) FROM offices) AS offices,
  (SELECT COUNT(*) FROM settings) AS settings,
  (SELECT COUNT(*) FROM prev_scores) AS prev_scores,
  (SELECT COUNT(*) FROM prizes) AS prizes,
  (SELECT COUNT(*) FROM monthly_resolution) AS monthly_resolution,
  (SELECT COUNT(*) FROM monthly_collection) AS monthly_collection,
  (SELECT COUNT(*) FROM monthly_gpr) AS monthly_gpr,
  (SELECT COUNT(*) FROM monthly_timeliness) AS monthly_timeliness,
  (SELECT COUNT(*) FROM validator_scores) AS validator_scores`;
const countsRow = await withRetry(() => db.execute(COUNT_SQL), "counts");
const counts = {};
for (const [k, v] of Object.entries(countsRow.rows[0])) counts[k] = Number(v);
console.log("Seed complete:", JSON.stringify(counts));
