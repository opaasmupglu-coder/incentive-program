import { getSnapshot, invalidateSnapshot } from "../lib/db";
import { getTurso } from "../lib/turso";
import assert from "node:assert/strict";

process.loadEnvFile(".env.local");

async function main() {
  console.log("Verifying snapshot with OPA (NF12)...");
  invalidateSnapshot();
  const snap = await getSnapshot();

  // 1. Verify connected and office counts
  assert.equal(snap.connected, true, "Database should be connected");
  assert.equal(snap.offices.length, 29, `Expected 29 offices, got ${snap.offices.length}`);

  const flOffices = snap.offices.filter(o => o.track === "Frontline");
  const nflOffices = snap.offices.filter(o => o.track === "Non-frontline");
  assert.equal(flOffices.length, 18, `Expected 18 Frontline offices, got ${flOffices.length}`);
  assert.equal(nflOffices.length, 11, `Expected 11 Non-frontline offices, got ${nflOffices.length}`);

  // 2. Verify OPA office presence
  const opa = snap.offices.find(o => o.code === "NF12");
  assert.ok(opa, "NF12 should exist in offices list");
  assert.equal(opa.short, "OPA");
  assert.equal(opa.track, "Non-frontline");
  assert.equal(opa.focal, "Jeffrey P. Racca");
  assert.equal(opa.focalPosition, "Administrative Aide I");

  // 3. Verify OPA in initialNFL
  const opaInitial = snap.initialNFL.find(r => r.code === "NF12");
  assert.ok(opaInitial, "NF12 should exist in initialNFL");
  console.log("OPA Initial Row:", {
    code: opaInitial.code,
    name: opaInitial.name,
    resolution: opaInitial.resolution,
    collection: opaInitial.collection,
    gpr: opaInitial.gpr,
    timeliness: opaInitial.timeliness,
    status: opaInitial.status,
    total: opaInitial.total,
  });

  assert.equal(opaInitial.resolution, 1.0, "OPA resolution should be 1.0 (100%)");
  assert.ok(Math.abs(opaInitial.collection! - 0.8638120699125785) < 1e-6, "OPA collection rate should be ~0.8638");
  assert.ok(Math.abs(opaInitial.gpr! - 99.966) < 1e-3, "OPA GPR should be 99.966");
  assert.equal(opaInitial.timeliness, 1.0, "OPA rated timeliness should be 1.0 (100%)");
  assert.equal(opaInitial.status, "Missing: Timeliness", "OPA should have status 'Missing: Timeliness' due to Month 5 pending submission");

  // 4. Verify input monthly rows
  const collRow = snap.inputCollection.find(r => r.code === "NF12");
  assert.ok(collRow, "NF12 should have inputCollection row");
  assert.deepEqual(collRow.first, [40, 23, 63, 13, 33, 39, 39, 18, 38, 33]);
  assert.deepEqual(collRow.second, [49, 37, 63, 39, 35, 44, 39, 28, 41, 35]);

  const gprRow = snap.inputGpr.find(r => r.code === "NF12");
  assert.ok(gprRow, "NF12 should have inputGpr row");
  assert.deepEqual(gprRow.first, [100, 100, 100, 100, 99.66, 100, 100, 100, 100, 100]);

  const resRow = snap.inputResolution.find(r => r.code === "NF12");
  assert.ok(resRow, "NF12 should have inputResolution row");
  assert.deepEqual(resRow.first, [null, null, null, null, 1, null, null, null, null, null]);
  assert.deepEqual(resRow.second, [0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);

  // 5. Verify checks table
  const nflCheck = snap.checks.find(c => c.label === "Non-frontline offices");
  assert.ok(nflCheck, "Checks should include Non-frontline offices");
  assert.equal(nflCheck.result, "11", "Non-frontline offices count should be 11");

  console.log("\nAll OPA snapshot verifications passed successfully!");
  getTurso()?.close();
}

main().catch((err) => {
  console.error(err);
  getTurso()?.close();
  process.exit(1);
});
