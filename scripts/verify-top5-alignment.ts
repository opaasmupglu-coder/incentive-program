import assert from "node:assert/strict";
import { initialTop5 } from "../lib/initial-preview";
import { buildValidators, buildFinals } from "../lib/compute";
import type { InitialRow } from "../lib/types";
import seed from "./seed-data.json";

const weights = [0.35, 0.3, 0.2, 0.15];
const rows: InitialRow[] = [98.4, 95.2, 94.6, 91.2, 88.8, 88.7].map(
  (score, i) => ({
    code: ["OPAg", "PHO", "OPVet", "OPAss", "PGENRO", "OPG"][i],
    name: String(i),
    resolution: score / 100,
    collection: score / 100,
    gpr: score,
    timeliness: score / 100,
    resolutionMonths: 10,
    collectionMonths: 10,
    gprMonths: 10,
    timelinessMonths: 10,
    total: i === 3 ? null : score / 100,
    rank: null,
    tieBreakRank: null,
    status: i === 3 ? "Missing: Timeliness" : "✓ Complete",
  }),
);
const top5 = initialTop5(rows, weights);
assert.deepEqual(
  top5.map((r) => r.code),
  ["OPAg", "PHO", "OPVet", "OPAss", "PGENRO"],
);
assert.equal(top5[3].total, null, "Keep the source completeness state");
const validation = buildValidators(top5, [], seed.settings, [
  {
    track: "Frontline",
    rank: 5,
    validator: "CSC",
    office_code: "OPAss",
    officeScores: [5, 5, 5, 5],
    focalScores: [5, 5, 5, 5, 5],
  },
]);
assert.deepEqual(
  validation.validatorAvg.map((r) => r.code),
  top5.map((r) => r.code),
);
assert.equal(
  validation.validatorAvg.find((r) => r.code === "OPAss")?.officeAvg,
  0.4,
  "Retain the pending office's own rating after re-ranking",
);
const finals = buildFinals(top5, validation.validatorAvg, seed.settings);
for (const list of [finals.offices, finals.focals]) {
  assert.deepEqual(
    list.map((r) => r.code),
    top5.map((r) => r.code),
  );
  const assessor = list.find((r) => r.code === "OPAss")!;
  assert.ok(Math.abs(assessor.initialTotal! - 0.912) < 1e-12);
  assert.ok(Math.abs(assessor.initial60! - 0.5472) < 1e-12);
  assert.ok(Math.abs(assessor.finalTotal! - 0.9472) < 1e-12);
  assert.equal(assessor.initialProvisional, true);
  assert.match(assessor.status, /Provisional/);
  assert.ok(
    assessor.rank !== null,
    "Pending status must not suppress the running final rank",
  );
}
const noRatings = buildFinals(top5, [], seed.settings).offices.find(
  (r) => r.code === "OPAss",
)!;
assert.equal(noRatings.validatorAvg, null);
assert.equal(noRatings.finalTotal, null, "Missing validator scores stay blank");
assert.ok(
  noRatings.initial60 !== null,
  "Still show the pending initial contribution",
);
rows[3].total = 0.912;
assert.deepEqual(
  initialTop5(rows, weights).map((r) => r.code),
  top5.map((r) => r.code),
  "Changing completeness alone cannot change Top 5 membership",
);
assert.equal(initialTop5([], weights).length, 0);
console.log(
  "Top 5 aligned across rankings, validators and finals; pending Assessor stays above OPG, uses running totals, retains its own ratings, and is marked provisional.",
);
