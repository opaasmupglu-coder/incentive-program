import { getSnapshot, invalidateSnapshot } from "../lib/db";
import { getTurso } from "../lib/turso";
import assert from "node:assert/strict";

process.loadEnvFile(".env.local");

async function main() {
  console.log("Verifying OPA hidden state and data retention...");
  const db = getTurso()!;

  // 1. Verify in database: OPA data is NOT removed and hidden = 1
  const dbOffice = await db.execute("SELECT * FROM offices WHERE code = 'NF12'");
  assert.equal(dbOffice.rows.length, 1, "NF12 must still exist in offices table");
  assert.equal(Number(dbOffice.rows[0].hidden), 1, "NF12 hidden column must be 1");
  assert.equal(dbOffice.rows[0].short, "OPA");

  const collCount = await db.execute("SELECT COUNT(*) as c FROM monthly_collection WHERE office_code = 'NF12'");
  const gprCount = await db.execute("SELECT COUNT(*) as c FROM monthly_gpr WHERE office_code = 'NF12'");
  const resCount = await db.execute("SELECT COUNT(*) as c FROM monthly_resolution WHERE office_code = 'NF12'");
  const sourceCount = await db.execute("SELECT COUNT(*) as c FROM monthly_feedback_source WHERE office_code = 'NF12'");
  const actionableCount = await db.execute("SELECT COUNT(*) as c FROM actionable_feedback_imports WHERE office_code = 'NF12'");

  assert.equal(Number(collCount.rows[0].c), 10, "All 10 monthly collection records must be preserved");
  assert.equal(Number(gprCount.rows[0].c), 10, "All 10 monthly GPR records must be preserved");
  assert.equal(Number(resCount.rows[0].c), 10, "All 10 monthly resolution records must be preserved");
  assert.equal(Number(sourceCount.rows[0].c), 10, "All 10 monthly source records must be preserved");
  assert.equal(Number(actionableCount.rows[0].c), 10, "All 10 actionable feedback import records must be preserved");
  console.log("Data retention in database verified: 10/10 months intact across all tables.");

  // 2. Verify in snapshot: OPA is hidden from the UI / snapshot
  invalidateSnapshot();
  const snap = await getSnapshot();

  assert.equal(snap.offices.length, 28, `Expected 28 active offices, got ${snap.offices.length}`);
  assert.equal(snap.offices.some((o) => o.code === "NF12"), false, "NF12 must NOT be in snap.offices");
  assert.equal(snap.initialNFL.some((r) => r.code === "NF12"), false, "NF12 must NOT be in snap.initialNFL");
  assert.equal(snap.inputResolution.some((r) => r.code === "NF12"), false, "NF12 must NOT be in snap.inputResolution");
  assert.equal(snap.inputCollection.some((r) => r.code === "NF12"), false, "NF12 must NOT be in snap.inputCollection");
  assert.equal(snap.inputGpr.some((r) => r.code === "NF12"), false, "NF12 must NOT be in snap.inputGpr");
  assert.equal(snap.inputTimeliness.some((r) => r.code === "NF12"), false, "NF12 must NOT be in snap.inputTimeliness");
  console.log("Snapshot verification passed: OPA is completely hidden from application view.");

  db.close();
}

main().catch((err) => {
  console.error("Verification failed:", err);
  getTurso()?.close();
  process.exit(1);
});
