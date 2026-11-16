import assert from "node:assert/strict";
import {
  collectionRate,
  computeOffice,
  gprRate,
  type MonthlyInput,
} from "../lib/compute";
import { initialCriteria } from "../lib/initial-preview";
import seed from "./seed-data.json";
import type { Office } from "../lib/types";

for (const minimum of [20, 10]) {
  assert.equal(collectionRate(minimum - 1, 100, 384.16, minimum), 0);
  assert.equal(
    collectionRate(minimum - 1, null, 384.16, minimum),
    0,
    "The minimum-forms rule precedes missing visitor data",
  );
  assert.equal(gprRate(100, minimum - 1, minimum), 0);
  assert.equal(
    gprRate(null, minimum - 1, minimum),
    0,
    "Invalid response coverage is a scored zero even when no GAR was recorded",
  );
  assert.ok(Math.abs(gprRate(95.63, minimum, minimum)! - 0.9563) < 1e-12);
  assert.equal(gprRate(null, minimum, minimum), null);
  assert.equal(
    gprRate(100, null, minimum),
    null,
    "An unknown form count is not zero respondents",
  );
  assert.equal(gprRate(100, 0, minimum), 0);
}
for (const [track, minimum, gprWeight] of [
  ["Frontline", 20, 0.2],
  ["Non-frontline", 10, 0.35],
] as const) {
  const office: Office = {
    code: "TEST",
    short: "TEST",
    name: "Test office",
    track,
    focal: "",
    focalPosition: "",
    notes: "",
  };
  const input: MonthlyInput = {
    resolution: new Map([
      [1, { acted: null, plans: 0 }],
      [2, { acted: null, plans: 0 }],
    ]),
    collection: new Map([
      [1, { forms: minimum - 1, clients: 100 }],
      [2, { forms: minimum, clients: 100 }],
    ]),
    gpr: new Map([
      [1, 100],
      [2, 90],
    ]),
    timeliness: new Map(),
  };
  const result = computeOffice(office, input, seed.settings);
  assert.deepEqual(
    result.monthly.gpr.first.slice(0, 2),
    [100, 90],
    "Original GAR values must be preserved",
  );
  assert.deepEqual(result.monthly.gpr.computed.slice(0, 2), [0, 0.9]);
  assert.equal(
    result.initial.gpr,
    45,
    "The invalid month must remain a zero in the average",
  );
  assert.equal(result.initial.gprMonths, 2);
  const weights =
    track === "Frontline" ? [0.35, 0.3, 0.2, 0.15] : [0.3, 0.2, 0.35, 0.15];
  assert.ok(
    Math.abs(
      initialCriteria(result.initial, weights)[2].weighted! - 0.45 * gprWeight,
    ) < 1e-12,
    "Rankings must use the scored GPR",
  );
  input.collection.set(1, { forms: minimum, clients: 100 });
  const corrected = computeOffice(office, input, seed.settings);
  assert.equal(
    corrected.monthly.gpr.computed[0],
    1,
    "Reaching the minimum restores the recorded rating automatically",
  );
  assert.equal(corrected.initial.gpr, 95);
}
console.log(
  "Minimum respondents verified: FL 19/20, NFL 9/10, zero/missing inputs, averaged zeros, weighted rankings, and restored scores without changing recorded GAR.",
);
