// Verification vectors for lib/compute.ts — the numbers must reproduce the
// v2 sheet's formulas exactly. Run with: npx tsx scripts/verify-vectors.ts
import {
  assignRanks,
  buildFinals,
  buildValidators,
  collectionRate,
  computeOffice,
  focalTotal,
  officeTotal,
  resolutionRate,
  timelinessScore,
  type MonthlyInput,
} from "../lib/compute";
import type { InitialRow, Office } from "../lib/types";

let failures = 0;
function check(
  label: string,
  got: number | null,
  expected: number,
  tol = 1e-4,
): void {
  if (got === null || Math.abs(got - expected) > tol) {
    failures++;
    console.error(`FAIL ${label}: got ${got}, expected ${expected}`);
  } else {
    console.log(`ok   ${label}: ${got}`);
  }
}
function checkStr(label: string, got: string, expected: string): void {
  if (got !== expected) {
    failures++;
    console.error(
      `FAIL ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
  } else {
    console.log(`ok   ${label}`);
  }
}

const SETTINGS: Record<string, string> = {
  fl_res_weight: "0.35",
  fl_coll_weight: "0.30",
  fl_gpr_weight: "0.20",
  fl_time_weight: "0.15",
  nf_res_weight: "0.30",
  nf_coll_weight: "0.20",
  nf_gpr_weight: "0.35",
  nf_time_weight: "0.15",
  final_initial_weight: "0.60",
  sample_constant: "384.16",
  min_forms_fl: "20",
  min_forms_nfl: "10",
  gpr_max: "100",
  validator_scale: "5",
  time_band_1_3: "1.0",
  time_band_4_5: "0.8",
  time_band_6_7: "0.6",
  time_band_8_10: "0.4",
  time_band_11_15: "0.2",
  time_band_16_plus: "0.0",
  validator_1: "CSC",
  validator_2: "DILG",
  validator_3: "MSGC",
  office_w_car: "0.10",
  office_w_onsite: "0.10",
  office_w_best: "0.10",
  office_w_interview: "0.10",
  focal_w_ccarta: "0.10",
  focal_w_innovation: "0.10",
  focal_w_responsive: "0.10",
  focal_w_prof: "0.05",
  focal_w_comms: "0.05",
};

const PTO: Office = {
  code: "FL01",
  short: "PTO",
  name: "Office of the Provincial Treasurer (PTO)",
  track: "Frontline",
  focal: "",
  focalPosition: "",
  notes: "",
};

// --- monthly rates
check("Collection rate 40/50", collectionRate(40, 50, 384.16, 20), 0.9021);
check("Resolution rate 90/100", resolutionRate(90, 100), 0.9);
if (resolutionRate(90, 0) !== null) {
  failures++;
  console.error("FAIL Resolution blank when plans=0");
} else console.log("ok   Resolution blank when plans=0");
check("Collection 0 when forms < min", collectionRate(10, 50, 384.16, 20), 0);
if (collectionRate(40, 1, 384.16, 20) !== null) {
  failures++;
  console.error("FAIL Collection blank when clients<=1");
} else console.log("ok   Collection blank when clients<=1");
check("Timeliness 2 days", timelinessScore(2, [1, 0.8, 0.6, 0.4, 0.2, 0]), 1.0);
check(
  "Timeliness 12 days",
  timelinessScore(12, [1, 0.8, 0.6, 0.4, 0.2, 0]),
  0.2,
);
check(
  "Timeliness 99 days",
  timelinessScore(99, [1, 0.8, 0.6, 0.4, 0.2, 0]),
  0.0,
);

// --- PTO one month: acted 90, plans 100, forms 40, clients 50, GPR 90, days 2
const input: MonthlyInput = {
  resolution: new Map([[1, { acted: 90, plans: 100 }]]),
  collection: new Map([[1, { forms: 40, clients: 50 }]]),
  gpr: new Map([[1, 90]]),
  timeliness: new Map([[1, 2]]),
};
const pto = computeOffice(PTO, input, SETTINGS);
check("PTO Initial total", pto.initial.total, 0.9156);
checkStr("PTO status", pto.initial.status, "✓ Complete");
check("PTO Resolution avg", pto.initial.resolution, 0.9);
check("PTO Collection avg", pto.initial.collection, 0.9021);
check("PTO GPR avg", pto.initial.gpr, 90);
check("PTO Timeliness avg", pto.initial.timeliness, 1.0);

// --- blank office: no data at all
const empty = computeOffice(
  PTO,
  {
    resolution: new Map(),
    collection: new Map(),
    gpr: new Map(),
    timeliness: new Map(),
  },
  SETTINGS,
);
if (empty.initial.total !== null) {
  failures++;
  console.error(
    `FAIL blank office total: got ${empty.initial.total}, expected null`,
  );
} else console.log("ok   blank office total is null");
checkStr(
  "blank office status",
  empty.initial.status,
  "Missing: Resolution Collection GPR Timeliness",
);

// --- validator totals
const OW = [0.1, 0.1, 0.1, 0.1];
const FW = [0.1, 0.1, 0.1, 0.05, 0.05];
check("Office total (5,5,5,5)", officeTotal([5, 5, 5, 5], OW, 5), 0.4);
check("Office total (4,4,4,4)", officeTotal([4, 4, 4, 4], OW, 5), 0.32);
check("Office total (2,3,4,5)", officeTotal([2, 3, 4, 5], OW, 5), 0.28);
check("Focal total (5,4,3,2,1)", focalTotal([5, 4, 3, 2, 1], FW, 5), 0.27);
if (officeTotal([5, 5, 5, null], OW, 5) !== null) {
  failures++;
  console.error("FAIL office total with a missing item should be null");
} else console.log("ok   office total null when an item is missing");

// --- tie-break: two offices with the same total
const mkRow = (code: string, total: number | null): InitialRow => ({
  code,
  name: code,
  resolution: null,
  resolutionMonths: 0,
  collection: null,
  collectionMonths: 0,
  gpr: null,
  gprMonths: 0,
  timeliness: null,
  timelinessMonths: 0,
  total,
  status: total === null ? "Missing" : "✓ Complete",
  rank: null,
  tieBreakRank: null,
});
const tieRows = [mkRow("FL01", 0.8), mkRow("FL02", 0.8), mkRow("FL04", 0.7)];
assignRanks(
  tieRows,
  new Map([
    ["FL01", 0],
    ["FL02", 1],
    ["FL04", 2],
  ]),
);
check("tie rank FL01", tieRows[0].rank, 1);
check("tie rank FL02", tieRows[1].rank, 1);
check("tie-break FL01 (earlier in list)", tieRows[0].tieBreakRank, 1);
check("tie-break FL02", tieRows[1].tieBreakRank, 2);
check("tie-break FL04", tieRows[2].tieBreakRank, 3);

// --- Final: FL01 with office avg 0.36 (CSC 0.40 + DILG 0.32, MSGC unrated)
const top5: InitialRow[] = [pto.initial];
const avgRows = [
  {
    code: "FL01",
    name: "Office of the Provincial Treasurer (PTO)",
    officePerValidator: [0.4, 0.32, null],
    officeAvg: 0.36,
    officeRatedCount: 2,
    focalPerValidator: [0.4, 0.32, null],
    focalAvg: 0.36,
    focalRatedCount: 2,
  },
];
const finals = buildFinals(top5, avgRows, SETTINGS);
check("FL01 Final (office)", finals.offices[0].finalTotal, 0.9094);

// --- buildValidators: average-of-rated (MSGC missing is not a zero)
const { validatorAvg } = buildValidators(top5, [], SETTINGS, [
  {
    track: "Frontline",
    rank: 1,
    validator: "CSC",
    office_code: "FL01",
    officeScores: [5, 5, 5, 5],
    focalScores: [5, 5, 5, 5, 5],
  },
  {
    track: "Frontline",
    rank: 1,
    validator: "DILG",
    office_code: "FL01",
    officeScores: [4, 4, 4, 4],
    focalScores: [4, 4, 4, 4, 4],
  },
]);
check(
  "ValidatorAvg FL01 office (avg of rated)",
  validatorAvg[0].officeAvg,
  0.36,
);
check("ValidatorAvg FL01 rated count", validatorAvg[0].officeRatedCount, 2);

// Ratings belong to the office even when its ranking changes.
const moved = buildValidators(
  [mkRow("FL02", 0.95), pto.initial],
  [],
  SETTINGS,
  [
    {
      track: "Frontline",
      rank: 1,
      validator: "CSC",
      office_code: "FL01",
      officeScores: [5, 5, 5, 5],
      focalScores: [5, 5, 5, 5, 5],
    },
  ],
);
check(
  "Moved office keeps its own rating",
  moved.validatorAvg[1].officeAvg,
  0.4,
);
if (moved.validatorAvg[0].officeAvg !== null) {
  failures++;
  console.error("FAIL another office inherited a rating from its rank");
} else
  console.log(
    "ok   ratings do not transfer to a different office at the same rank",
  );

if (failures > 0) {
  console.error(`${failures} vector check(s) FAILED`);
  process.exit(1);
}
console.log("All verification vectors passed.");
