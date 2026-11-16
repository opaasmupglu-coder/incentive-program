import assert from "node:assert/strict";
import {
  computeOffice,
  resolutionRate,
  type MonthlyInput,
} from "../lib/compute";
import seed from "./seed-data.json";
import type { Office } from "../lib/types";

assert.equal(
  resolutionRate(null, 0),
  1,
  "Confirmed zero negatives require no acted-upon input",
);
assert.equal(resolutionRate(0, 0), 1);
assert.equal(
  resolutionRate(null, 2),
  null,
  "Pending acted-upon counts must remain missing",
);
assert.equal(resolutionRate(1, 2), 0.5);
assert.equal(resolutionRate(0, 2), 0);
assert.equal(
  resolutionRate(null, null),
  null,
  "Missing source data is not a confirmed zero",
);
assert.equal(
  resolutionRate(1, 0),
  null,
  "Inconsistent positive acted-upon counts stay invalid",
);
const office: Office = {
  code: "FL01",
  short: "PTO",
  name: "Treasurer",
  track: "Frontline",
  focal: "",
  focalPosition: "",
  notes: "",
};
const input: MonthlyInput = {
  resolution: new Map([
    [1, { acted: null, plans: 0 }],
    [2, { acted: null, plans: 2 }],
  ]),
  collection: new Map([[1, { forms: 40, clients: 50 }]]),
  gpr: new Map([[1, 95.63]]),
  timeliness: new Map([[1, 2]]),
};
const pending = computeOffice(office, input, seed.settings);
assert.equal(pending.monthly.resolution.computed[0], 1);
assert.equal(pending.monthly.resolution.computed[1], null);
assert.equal(
  pending.initial.total,
  null,
  "Confirmed zero months must not qualify an office with pending negative-comment months",
);
input.resolution.set(2, { acted: 1, plans: 2 });
assert.equal(
  computeOffice(office, input, seed.settings).initial.total,
  null,
  "Positive-negative months still require a submission count/date",
);
input.timeliness.set(2, 2);
const completed = computeOffice(office, input, seed.settings);
assert.equal(completed.initial.resolution, 0.75);
assert.notEqual(completed.initial.total, null);
console.log(
  "Resolution: zero negatives auto-score 100%; positive counts need acted-upon input; pending months stay provisional; 1/2 scores 50%.",
);
