// Clear ALL rows from every Turso table (schema stays intact).
// Usage: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in the environment, then `node scripts/clear-data.mjs`.
// Prints the row count of each table afterwards (all should be 0).
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const TABLES = [
  "monthly_resolution",
  "monthly_collection",
  "monthly_gpr",
  "monthly_timeliness",
  "validator_scores",
  "prev_scores",
  "prizes",
  "settings",
  "offices",
];

for (const t of TABLES) {
  await db.execute(`DELETE FROM ${t}`);
}

const counts = {};
for (const t of TABLES) {
  const r = await db.execute(`SELECT COUNT(*) AS c FROM ${t}`);
  counts[t] = Number(r.rows[0].c);
}
console.log(JSON.stringify(counts, null, 2));
console.log("total rows:", Object.values(counts).reduce((a, b) => a + b, 0));
