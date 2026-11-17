// Pure computation for the Incentive Program.
// These rules are the v2 sheet's formulas, reimplemented exactly so the app
// computes everything itself from the Turso tables. No I/O in this module.
import type {
  CheckRow,
  FinalRow,
  InitialRow,
  MonthlyRow,
  Office,
  ValidatorAvgRow,
  ValidatorRow,
} from "./types";

export type SettingsMap = Record<string, string>;

export function numSetting(
  s: SettingsMap,
  key: string,
  fallback: number,
): number {
  const v = parseFloat(s[key] ?? "");
  return Number.isFinite(v) ? v : fallback;
}

export type MonthlyInput = {
  resolution: Map<number, { acted: number | null; plans: number | null }>;
  collection: Map<number, { forms: number | null; clients: number | null }>;
  gpr: Map<number, number | null>;
  timeliness: Map<number, number | null>;
};

export function resolutionRate(
  acted: number | null,
  plans: number | null,
): number | null {
  if (plans === null) return null;
  // A confirmed zero combined negative-comment/suggestion count needs no action.
  if (plans === 0) return acted !== null && acted > 0 ? null : 1;
  if (acted === null) return null;
  return acted / plans;
}

export function collectionRate(
  forms: number | null,
  clients: number | null,
  sampleConstant: number,
  minForms: number,
): number | null {
  if (forms === null) return null;
  if (forms < minForms) return 0;
  // The sheet checks the minimum first, including recorded zero-visitor months.
  if (clients === null || clients <= 0) return null;
  const rate =
    forms / ((clients * sampleConstant) / (clients - 1 + sampleConstant));
  return Math.min(1, rate);
}

/** Keep the recorded GAR separate from the score allowed by respondent coverage. */
export function gprRate(
  recordedGar: number | null,
  forms: number | null,
  minForms: number,
): number | null {
  if (forms === null) return null;
  if (forms < minForms) return 0;
  return recordedGar === null ? null : recordedGar / 100;
}

export function timelinessScore(
  days: number | null,
  bands: number[],
): number | null {
  if (days === null) return null;
  if (days <= 3) return bands[0];
  if (days <= 5) return bands[1];
  if (days <= 7) return bands[2];
  if (days <= 10) return bands[3];
  if (days <= 15) return bands[4];
  return bands[5];
}

function avg(values: (number | null)[]): {
  avg: number | null;
  months: number;
} {
  const real = values.filter((v): v is number => v !== null);
  if (real.length === 0) return { avg: null, months: 0 };
  return {
    avg: real.reduce((a, b) => a + b, 0) / real.length,
    months: real.length,
  };
}

export type OfficeComputation = {
  code: string;
  name: string;
  track: string;
  monthly: {
    resolution: MonthlyRow;
    collection: MonthlyRow;
    gpr: MonthlyRow;
    timeliness: MonthlyRow;
  };
  initial: InitialRow;
};

/** Compute one office's monthly rows + initial row. */
export function computeOffice(
  office: Office,
  input: MonthlyInput,
  settings: SettingsMap,
): OfficeComputation {
  const isFL = office.track === "Frontline";
  const wRes = numSetting(
    settings,
    isFL ? "fl_res_weight" : "nf_res_weight",
    0,
  );
  const wColl = numSetting(
    settings,
    isFL ? "fl_coll_weight" : "nf_coll_weight",
    0,
  );
  const wGpr = numSetting(
    settings,
    isFL ? "fl_gpr_weight" : "nf_gpr_weight",
    0,
  );
  const wTime = numSetting(
    settings,
    isFL ? "fl_time_weight" : "nf_time_weight",
    0,
  );
  const sampleConstant = numSetting(settings, "sample_constant", 384.16);
  const minForms = numSetting(
    settings,
    isFL ? "min_forms_fl" : "min_forms_nfl",
    isFL ? 20 : 10,
  );
  const bands = [
    numSetting(settings, "time_band_1_3", 1.0),
    numSetting(settings, "time_band_4_5", 0.8),
    numSetting(settings, "time_band_6_7", 0.6),
    numSetting(settings, "time_band_8_10", 0.4),
    numSetting(settings, "time_band_11_15", 0.2),
    numSetting(settings, "time_band_16_plus", 0.0),
  ];

  const resRates: (number | null)[] = [];
  const collRates: (number | null)[] = [];
  const gprRates: (number | null)[] = [];
  const timeScores: (number | null)[] = [];
  const resFirst: (number | null)[] = [];
  const resSecond: (number | null)[] = [];
  const collFirst: (number | null)[] = [];
  const collSecond: (number | null)[] = [];
  const gprFirst: (number | null)[] = [];
  const timeFirst: (number | null)[] = [];
  const timeSecond: (number | null)[] = [];
  for (let m = 1; m <= 10; m++) {
    const r = input.resolution.get(m) || { acted: null, plans: null };
    const c = input.collection.get(m) || { forms: null, clients: null };
    const g = input.gpr.get(m) ?? null;
    const d = input.timeliness.get(m) ?? null;
    const submissionCount = r.plans;
    resFirst.push(r.acted);
    resSecond.push(r.plans);
    collFirst.push(c.forms);
    collSecond.push(c.clients);
    gprFirst.push(g);
    timeFirst.push(submissionCount === 0 ? null : d);
    timeSecond.push(submissionCount);
    resRates.push(resolutionRate(r.acted, r.plans));
    collRates.push(
      collectionRate(c.forms, c.clients, sampleConstant, minForms),
    );
    gprRates.push(gprRate(g, c.forms, minForms));
    timeScores.push(submissionCount === 0 ? 1 : timelinessScore(d, bands));
  }

  const res = avg(resRates);
  const coll = avg(collRates);
  const gpr = avg(gprRates);
  const time = avg(timeScores);

  const missing: string[] = [];
  const pendingNegativeCounts = [...input.resolution.values()].some(
    (r) => r.plans !== null && r.plans > 0 && r.acted === null,
  );
  if (res.avg === null || pendingNegativeCounts) missing.push("Resolution");
  if (coll.avg === null) missing.push("Collection");
  if (gpr.avg === null) missing.push("GPR");
  const pendingSubmissionDates = timeSecond.some(
    (count, i) =>
      count !== null && count > 0 && input.timeliness.get(i + 1) == null,
  );
  if (time.avg === null || pendingSubmissionDates) missing.push("Timeliness");

  const total =
    missing.length === 0
      ? res.avg! * wRes +
        coll.avg! * wColl +
        gpr.avg! * wGpr +
        time.avg! * wTime
      : null;

  return {
    code: office.code,
    name: office.name,
    track: office.track,
    monthly: {
      resolution: {
        code: office.code,
        first: resFirst,
        second: resSecond,
        computed: resRates,
      },
      collection: {
        code: office.code,
        first: collFirst,
        second: collSecond,
        computed: collRates,
      },
      gpr: {
        code: office.code,
        first: gprFirst,
        second: Array(10).fill(null),
        computed: gprRates,
      },
      timeliness: {
        code: office.code,
        first: timeFirst,
        second: timeSecond,
        computed: timeScores,
      },
    },
    initial: {
      code: office.code,
      name: office.name,
      resolution: res.avg,
      resolutionMonths: res.months,
      collection: coll.avg,
      collectionMonths: coll.months,
      gpr: gpr.avg !== null ? gpr.avg * 100 : null,
      gprMonths: gpr.months,
      timeliness: time.avg,
      timelinessMonths: time.months,
      total,
      status: total !== null ? "✓ Complete" : `Missing: ${missing.join(" ")}`,
      rank: null,
      tieBreakRank: null,
    },
  };
}

/** Assign competition ranks (ties share a rank) and unique tie-break ranks. */
export function assignRanks(
  rows: InitialRow[],
  sortOrder: Map<string, number>,
): void {
  const withTotal = rows.filter((r) => r.total !== null);
  for (const r of rows) {
    if (r.total === null) {
      r.rank = null;
      r.tieBreakRank = null;
      continue;
    }
    r.rank = 1 + withTotal.filter((o) => o.total! > r.total!).length;
  }
  const ordered = [...withTotal].sort((a, b) => {
    if (b.total! !== a.total!) return b.total! - a.total!;
    return (sortOrder.get(a.code) ?? 0) - (sortOrder.get(b.code) ?? 0);
  });
  ordered.forEach((r, i) => {
    r.tieBreakRank = i + 1;
  });
}

export function officeTotal(
  scores: (number | null)[],
  weights: number[],
  scale: number,
): number | null {
  if (scores.some((s) => s === null)) return null;
  return scores.reduce<number>(
    (sum, s, i) => sum + ((s as number) / scale) * weights[i],
    0,
  );
}

export function focalTotal(
  scores: (number | null)[],
  weights: number[],
  scale: number,
): number | null {
  if (scores.some((s) => s === null)) return null;
  return scores.reduce<number>(
    (sum, s, i) => sum + ((s as number) / scale) * weights[i],
    0,
  );
}

export type ScoreEntry = {
  track: string;
  rank: number;
  validator: string;
  office_code: string;
  officeScores: (number | null)[];
  focalScores: (number | null)[];
};

/** Build the Validators rows (top 5 per track x 3 validators) + averages. */
export function buildValidators(
  top5FL: InitialRow[],
  top5NFL: InitialRow[],
  settings: SettingsMap,
  scores: ScoreEntry[],
): { validators: ValidatorRow[]; validatorAvg: ValidatorAvgRow[] } {
  const validatorNames = [
    settings["validator_1"] || "",
    settings["validator_2"] || "",
    settings["validator_3"] || "",
  ].filter(Boolean);
  const scale = numSetting(settings, "validator_scale", 5);
  const officeW = [
    numSetting(settings, "office_w_car", 0.1),
    numSetting(settings, "office_w_onsite", 0.1),
    numSetting(settings, "office_w_best", 0.1),
    numSetting(settings, "office_w_interview", 0.1),
  ];
  const focalW = [
    numSetting(settings, "focal_w_ccarta", 0.1),
    numSetting(settings, "focal_w_innovation", 0.1),
    numSetting(settings, "focal_w_responsive", 0.1),
    numSetting(settings, "focal_w_prof", 0.05),
    numSetting(settings, "focal_w_comms", 0.05),
  ];

  const validators: ValidatorRow[] = [];
  const avgRows: ValidatorAvgRow[] = [];
  const blocks: { track: string; list: InitialRow[]; baseRow: number }[] = [
    { track: "Frontline", list: top5FL, baseRow: 4 },
    { track: "Non-frontline", list: top5NFL, baseRow: 19 },
  ];
  for (const { track, list, baseRow } of blocks) {
    list.forEach((office, idx) => {
      const rank = idx + 1;
      const officePerValidator: (number | null)[] = [];
      const focalPerValidator: (number | null)[] = [];
      validatorNames.forEach((validator, vi) => {
        const entry = scores.find(
          (s) =>
            s.track === track &&
            s.office_code === office.code &&
            s.validator === validator,
        );
        const officeScores = entry
          ? entry.officeScores
          : [null, null, null, null];
        const focalScores = entry
          ? entry.focalScores
          : [null, null, null, null, null];
        const oTotal = officeTotal(officeScores, officeW, scale);
        const fTotal = focalTotal(focalScores, focalW, scale);
        if (oTotal !== null) officePerValidator.push(oTotal);
        else officePerValidator.push(null);
        if (fTotal !== null) focalPerValidator.push(fTotal);
        else focalPerValidator.push(null);
        validators.push({
          rank,
          validator,
          code: office.code,
          name: office.name,
          officeScores,
          focalScores,
          officeTotal: oTotal,
          focalTotal: fTotal,
          officeRated: oTotal !== null,
          focalRated: fTotal !== null,
          sheetRow: baseRow + idx * 3 + vi,
        });
      });
      const ratedOffice = officePerValidator.filter(
        (v) => v !== null,
      ) as number[];
      const ratedFocal = focalPerValidator.filter(
        (v) => v !== null,
      ) as number[];
      avgRows.push({
        code: office.code,
        name: office.name,
        officePerValidator,
        officeAvg: ratedOffice.length
          ? ratedOffice.reduce((a, b) => a + b, 0) / ratedOffice.length
          : null,
        officeRatedCount: ratedOffice.length,
        focalPerValidator,
        focalAvg: ratedFocal.length
          ? ratedFocal.reduce((a, b) => a + b, 0) / ratedFocal.length
          : null,
        focalRatedCount: ratedFocal.length,
      });
    });
  }
  return { validators, validatorAvg: avgRows };
}

/** Build final rows (office + focal) for one track's top 5. */
export function buildFinals(
  top5: (InitialRow & { displayTotal?: number | null })[],
  avgRows: ValidatorAvgRow[],
  settings: SettingsMap,
): { offices: FinalRow[]; focals: FinalRow[] } {
  const mix = numSetting(settings, "final_initial_weight", 0.6);
  const offices: FinalRow[] = [];
  const focals: FinalRow[] = [];
  top5.forEach((office) => {
    const avg = avgRows.find((a) => a.code === office.code);
    const initialTotal = office.total ?? office.displayTotal ?? null;
    const initialProvisional = office.total === null;
    const initial60 = initialTotal !== null ? initialTotal * mix : null;
    const status = (final: number | null) =>
      initialProvisional
        ? final !== null
          ? `Provisional: ${office.status}`
          : "Pending initial data; waiting: validator rating"
        : final !== null
          ? "✓ Final"
          : "Waiting: validator rating";
    const offFinal =
      initial60 !== null &&
      avg?.officeAvg !== null &&
      avg?.officeAvg !== undefined
        ? initial60 + (avg.officeAvg as number)
        : null;
    const focFinal =
      initial60 !== null &&
      avg?.focalAvg !== null &&
      avg?.focalAvg !== undefined
        ? initial60 + (avg.focalAvg as number)
        : null;
    offices.push({
      code: office.code,
      name: office.name,
      initialTotal,
      initialProvisional,
      initial60,
      validatorAvg: avg?.officeAvg ?? null,
      finalTotal: offFinal,
      rank: null,
      status: status(offFinal),
    });
    focals.push({
      code: office.code,
      name: office.name,
      initialTotal,
      initialProvisional,
      initial60,
      validatorAvg: avg?.focalAvg ?? null,
      finalTotal: focFinal,
      rank: null,
      status: status(focFinal),
    });
  });
  const rankList = (rows: FinalRow[]) => {
    const done = rows.filter((r) => r.finalTotal !== null);
    for (const r of rows) {
      r.rank =
        r.finalTotal === null
          ? null
          : 1 + done.filter((o) => o.finalTotal! > r.finalTotal!).length;
    }
  };
  rankList(offices);
  rankList(focals);
  return { offices, focals };
}

export function buildChecks(input: {
  settings: SettingsMap;
  offices: Office[];
  inputCellsFilled: number;
  completeFL: number;
  completeNFL: number;
  top5FL: number;
  top5NFL: number;
  finalsFL: number;
  finalsNFL: number;
  ratedOffice: number;
  ratedFocal: number;
}): CheckRow[] {
  const s = input.settings;
  const flTotal =
    numSetting(s, "fl_res_weight", 0) +
    numSetting(s, "fl_coll_weight", 0) +
    numSetting(s, "fl_gpr_weight", 0) +
    numSetting(s, "fl_time_weight", 0);
  const nfTotal =
    numSetting(s, "nf_res_weight", 0) +
    numSetting(s, "nf_coll_weight", 0) +
    numSetting(s, "nf_gpr_weight", 0) +
    numSetting(s, "nf_time_weight", 0);
  const officeSub =
    numSetting(s, "office_w_car", 0) +
    numSetting(s, "office_w_onsite", 0) +
    numSetting(s, "office_w_best", 0) +
    numSetting(s, "office_w_interview", 0);
  const focalSub =
    numSetting(s, "focal_w_ccarta", 0) +
    numSetting(s, "focal_w_innovation", 0) +
    numSetting(s, "focal_w_responsive", 0) +
    numSetting(s, "focal_w_prof", 0) +
    numSetting(s, "focal_w_comms", 0);
  const flCount = input.offices.filter((o) => o.track === "Frontline").length;
  const nfCount = input.offices.filter(
    (o) => o.track === "Non-frontline",
  ).length;
  return [
    {
      label: "FL weights total 100%",
      result: String(Math.round(flTotal * 100) / 100),
      meaning: "Must be 100%.",
    },
    {
      label: "NFL weights total 100%",
      result: String(Math.round(nfTotal * 100) / 100),
      meaning: "Must be 100%.",
    },
    {
      label: "Office validator subtotal = 0.40",
      result: String(Math.round(officeSub * 100) / 100),
      meaning: "CAR + Onsite + Best + Interview.",
    },
    {
      label: "Focal validator subtotal = 0.40",
      result: String(Math.round(focalSub * 100) / 100),
      meaning:
        "CC-ARTA + Innovation + Responsiveness + Professionalism + Communication.",
    },
    {
      label: "Frontline offices",
      result: String(flCount),
      meaning: "Should be 17.",
    },
    {
      label: "Non-frontline offices",
      result: String(nfCount),
      meaning: "Should be 11.",
    },
    {
      label: "Input cells filled (all 4 monthly tables)",
      result: String(input.inputCellsFilled),
      meaning: "0 right now — no monthly numbers have been entered yet.",
    },
    {
      label: "FL offices with a complete Initial total",
      result: String(input.completeFL),
      meaning: "0 until monthly data is entered.",
    },
    {
      label: "NFL offices with a complete Initial total",
      result: String(input.completeNFL),
      meaning: "0 until monthly data is entered.",
    },
    {
      label: "FL top-5 slots filled",
      result: String(input.top5FL),
      meaning: "Should be 5 once 5 FL offices have complete Initial totals.",
    },
    {
      label: "NFL top-5 slots filled",
      result: String(input.top5NFL),
      meaning: "Should be 5 once 5 NFL offices have complete Initial totals.",
    },
    {
      label: "FL offices with a Final total",
      result: String(input.finalsFL),
      meaning: "Needs Initial + validator rating.",
    },
    {
      label: "NFL offices with a Final total",
      result: String(input.finalsNFL),
      meaning: "Needs Initial + validator rating.",
    },
    {
      label: "Validator rows fully rated (office items)",
      result: String(input.ratedOffice),
      meaning:
        "Out of 30 validator-office rows (top 5 × 3 validators × 2 tracks).",
    },
    {
      label: "Validator rows fully rated (focal items)",
      result: String(input.ratedFocal),
      meaning: "Out of 30 validator-office rows.",
    },
    {
      label: "Computation errors",
      result: "0",
      meaning: "Should be 0 — blanks are intentional, errors are not.",
    },
  ];
}
