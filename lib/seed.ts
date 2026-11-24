// One-time database seed, runnable from the deployed app itself.
// Some networks cannot reach Turso directly (egress proxy), so the app
// carries its own seed: POST /api/seed (behind the password gate) creates
// the tables and inserts the reference data from scripts/seed-data.json.
// It never touches monthly inputs or validator scores, so re-running it
// is safe and never wipes entered data.
//
// Writes are sent in small batched requests with a retry per chunk, because
// some networks drop the connection mid-seed.
import seedData from "../scripts/seed-data.json";
import { getTurso } from "./turso";

const DDL = [
  `CREATE TABLE IF NOT EXISTS offices (
     code TEXT PRIMARY KEY, short TEXT, full_name TEXT, track TEXT,
     focal_name TEXT, focal_position TEXT, notes TEXT, sort_order INTEGER, hidden INTEGER DEFAULT 0)`,
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

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`${label} failed (attempt ${attempt}/3):`, err);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

export async function runSeed(): Promise<Record<string, number>> {
  const db = getTurso();
  if (!db) throw new Error("Turso is not connected. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");

  const data = seedData as {
    offices: Array<Record<string, string | number>>;
    settings: Record<string, string>;
    prev_scores: Array<Record<string, string | number | null>>;
    prizes: Array<Record<string, string | number | null>>;
  };

  const stmts: Array<{ sql: string; args: Array<string | number | null> }> =
    DDL.map((sql) => ({ sql, args: [] }));
  for (const o of data.offices) {
    stmts.push({
      sql: `INSERT OR REPLACE INTO offices
        (code, short, full_name, track, focal_name, focal_position, notes, sort_order, hidden)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [o.code, o.short, o.full_name, o.track, o.focal_name, o.focal_position, o.notes, o.sort_order, (o as any).hidden ?? 0],
    });
  }
  for (const [key, value] of Object.entries(data.settings)) {
    stmts.push({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", args: [key, value] });
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

  const CHUNK = 25;
  const total = Math.ceil(stmts.length / CHUNK);
  for (let i = 0; i < stmts.length; i += CHUNK) {
    const n = i / CHUNK + 1;
    await withRetry(() => db.batch(stmts.slice(i, i + CHUNK), "write"), `chunk ${n}/${total}`);
  }

  const countsRow = await withRetry(() => db.execute(COUNT_SQL), "counts");
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(countsRow.rows[0])) counts[k] = Number(v);
  return counts;
}
