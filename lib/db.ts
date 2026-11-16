// Turso reads/writes + snapshot assembly + server-side cache.
// The app computes everything itself from the Turso tables; the snapshot
// shape matches what the UI pages already expect.
import { getTurso, missingEnv } from "./turso";
import { ensureCalendar, zeroNegativeSubmissionCleanup } from "./calendar";
import {
  assignRanks,
  buildChecks,
  buildFinals,
  buildValidators,
  computeOffice,
  type MonthlyInput,
  type ScoreEntry,
  type SettingsMap,
} from "./compute";
import type {
  Office,
  PrevScoreRow,
  PrizeRow,
  Settings,
  Snapshot,
} from "./types";

const CACHE_TTL_MS = 30_000; // 30 seconds, stale-while-revalidate

type CacheEntry = { data: Snapshot; fetchedAt: number };
let cache: CacheEntry | null = null;
let refreshing = false;

function emptySnapshot(missing: string[]): Snapshot {
  return {
    connected: false,
    missingEnv: missing,
    fetchedAt: null,
    cached: false,
    offices: [],
    settings: null,
    inputResolution: [],
    inputCollection: [],
    inputGpr: [],
    inputTimeliness: [],
    initialFL: [],
    initialNFL: [],
    validators: [],
    validatorAvg: [],
    finalFL: { offices: [], focals: [] },
    finalNFL: { offices: [], focals: [] },
    checks: [],
    prevScores: [],
    prizes: [],
  };
}

function toSettingsObject(map: SettingsMap): Settings {
  const n = (k: string) => {
    const v = parseFloat(map[k] ?? "");
    return Number.isFinite(v) ? v : 0;
  };
  return {
    flWeights: [
      n("fl_res_weight"),
      n("fl_coll_weight"),
      n("fl_gpr_weight"),
      n("fl_time_weight"),
    ],
    nflWeights: [
      n("nf_res_weight"),
      n("nf_coll_weight"),
      n("nf_gpr_weight"),
      n("nf_time_weight"),
    ],
    flTotal:
      n("fl_res_weight") +
      n("fl_coll_weight") +
      n("fl_gpr_weight") +
      n("fl_time_weight"),
    nflTotal:
      n("nf_res_weight") +
      n("nf_coll_weight") +
      n("nf_gpr_weight") +
      n("nf_time_weight"),
    finalInitialWeight: n("final_initial_weight"),
    sampleConstant: n("sample_constant"),
    minFormsFL: n("min_forms_fl"),
    minFormsNFL: n("min_forms_nfl"),
    gprMax: n("gpr_max"),
    validatorScale: n("validator_scale"),
    timelinessBands: [
      n("time_band_1_3"),
      n("time_band_4_5"),
      n("time_band_6_7"),
      n("time_band_8_10"),
      n("time_band_11_15"),
      n("time_band_16_plus"),
    ],
    officeItemWeights: [
      n("office_w_car"),
      n("office_w_onsite"),
      n("office_w_best"),
      n("office_w_interview"),
    ],
    focalItemWeights: [
      n("focal_w_ccarta"),
      n("focal_w_innovation"),
      n("focal_w_responsive"),
      n("focal_w_prof"),
      n("focal_w_comms"),
    ],
    officeSubtotal:
      n("office_w_car") +
      n("office_w_onsite") +
      n("office_w_best") +
      n("office_w_interview"),
    focalSubtotal:
      n("focal_w_ccarta") +
      n("focal_w_innovation") +
      n("focal_w_responsive") +
      n("focal_w_prof") +
      n("focal_w_comms"),
    validatorNames: [
      map["validator_1"] || "",
      map["validator_2"] || "",
      map["validator_3"] || "",
    ],
  };
}

async function fetchSnapshot(): Promise<Snapshot> {
  const missing = missingEnv();
  if (missing.length > 0) return emptySnapshot(missing);
  const db = getTurso();
  if (!db) return emptySnapshot(["TURSO_DATABASE_URL"]);
  await ensureCalendar();

  const [
    officesRes,
    settingsRes,
    resRes,
    collRes,
    gprRes,
    timeRes,
    scoresRes,
    prevRes,
    prizesRes,
  ] = await Promise.all([
    db.execute(
      "SELECT code, short, full_name, track, focal_name, focal_position, notes, sort_order FROM offices ORDER BY sort_order",
    ),
    db.execute("SELECT key, value FROM settings"),
    db.execute(
      "SELECT office_code, month, acted, plans FROM monthly_resolution",
    ),
    db.execute(
      "SELECT office_code, month, forms, clients FROM monthly_collection",
    ),
    db.execute("SELECT office_code, month, gpr FROM monthly_gpr"),
    db.execute("SELECT office_code, month, days FROM monthly_timeliness"),
    db.execute(
      "SELECT track, rank, validator, office_code, car, onsite, best, interview, ccarta, innovation, responsive, prof, comms FROM validator_scores",
    ),
    db.execute(
      "SELECT validator, office_code, car, onsite, best, interview, ccarta, innovation, responsive, prof, comms FROM prev_scores ORDER BY validator, office_code",
    ),
    db.execute(
      "SELECT office_code, item, focal_name, focal_position, status, notes FROM prizes ORDER BY office_code, item",
    ),
  ]);

  const offices: Office[] = officesRes.rows.map((r) => ({
    code: String(r.code),
    short: String(r.short),
    name: String(r.full_name),
    track: String(r.track),
    focal: String(r.focal_name ?? ""),
    focalPosition: String(r.focal_position ?? ""),
    notes: String(r.notes ?? ""),
  }));
  const sortOrder = new Map(offices.map((o, i) => [o.code, i]));

  const settingsMap: SettingsMap = {};
  for (const r of settingsRes.rows)
    settingsMap[String(r.key)] = String(r.value ?? "");

  const byOffice = <T>(rows: { office_code: unknown }[]): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of rows as unknown as T[]) {
      const code = String((r as { office_code: unknown }).office_code);
      if (!m.has(code)) m.set(code, []);
      m.get(code)!.push(r);
    }
    return m;
  };
  const resByOffice = byOffice<{
    office_code: string;
    month: number;
    acted: number | null;
    plans: number | null;
  }>(resRes.rows as never);
  const collByOffice = byOffice<{
    office_code: string;
    month: number;
    forms: number | null;
    clients: number | null;
  }>(collRes.rows as never);
  const gprByOffice = byOffice<{
    office_code: string;
    month: number;
    gpr: number | null;
  }>(gprRes.rows as never);
  const timeByOffice = byOffice<{
    office_code: string;
    month: number;
    days: number | null;
  }>(timeRes.rows as never);

  const toInput = (office: Office): MonthlyInput => {
    const res = new Map<
      number,
      { acted: number | null; plans: number | null }
    >();
    const coll = new Map<
      number,
      { forms: number | null; clients: number | null }
    >();
    const gpr = new Map<number, number | null>();
    const time = new Map<number, number | null>();
    for (const r of resByOffice.get(office.code) || [])
      res.set(Number(r.month), { acted: r.acted, plans: r.plans });
    for (const r of collByOffice.get(office.code) || [])
      coll.set(Number(r.month), { forms: r.forms, clients: r.clients });
    for (const r of gprByOffice.get(office.code) || [])
      gpr.set(Number(r.month), r.gpr);
    for (const r of timeByOffice.get(office.code) || [])
      time.set(Number(r.month), r.days);
    return {
      resolution: res,
      collection: coll,
      gpr,
      timeliness: time,
    };
  };

  const computed = offices.map((o) =>
    computeOffice(o, toInput(o), settingsMap),
  );
  const initialFL = computed
    .filter((c) => c.track === "Frontline")
    .map((c) => c.initial);
  const initialNFL = computed
    .filter((c) => c.track === "Non-frontline")
    .map((c) => c.initial);
  assignRanks(initialFL, sortOrder);
  assignRanks(initialNFL, sortOrder);

  const top5FL = [...initialFL]
    .filter((r) => r.tieBreakRank !== null)
    .sort((a, b) => (a.tieBreakRank as number) - (b.tieBreakRank as number))
    .slice(0, 5);
  const top5NFL = [...initialNFL]
    .filter((r) => r.tieBreakRank !== null)
    .sort((a, b) => (a.tieBreakRank as number) - (b.tieBreakRank as number))
    .slice(0, 5);

  const scoreEntries: ScoreEntry[] = scoresRes.rows.map((r) => ({
    track: String(r.track),
    rank: Number(r.rank),
    validator: String(r.validator),
    office_code: String(r.office_code),
    officeScores: [r.car, r.onsite, r.best, r.interview].map((v) =>
      v === null ? null : Number(v),
    ),
    focalScores: [r.ccarta, r.innovation, r.responsive, r.prof, r.comms].map(
      (v) => (v === null ? null : Number(v)),
    ),
  }));

  const { validators, validatorAvg } = buildValidators(
    top5FL,
    top5NFL,
    settingsMap,
    scoreEntries,
  );
  const finalFL = buildFinals(top5FL, validatorAvg.slice(0, 5), settingsMap);
  const finalNFL = buildFinals(top5NFL, validatorAvg.slice(5, 10), settingsMap);
  for (const row of [...finalFL.focals, ...finalNFL.focals]) {
    const office = offices.find((o) => o.code === row.code);
    row.officeName = office?.name || row.name;
    row.name = office?.focal || "Focal person not assigned";
  }

  const prevScores: PrevScoreRow[] = prevRes.rows.map((r) => ({
    validator: String(r.validator),
    code: String(r.office_code),
    office:
      offices.find((o) => o.code === String(r.office_code))?.name ||
      String(r.office_code),
    scores: [
      r.car,
      r.onsite,
      r.best,
      r.interview,
      r.ccarta,
      r.innovation,
      r.responsive,
      r.prof,
      r.comms,
    ].map((v) => (v === null ? null : Number(v))),
  }));

  const prizeByOffice = new Map<string, PrizeRow>();
  for (const r of prizesRes.rows) {
    const code = String(r.office_code);
    const office = offices.find((o) => o.code === code);
    if (!prizeByOffice.has(code)) {
      prizeByOffice.set(code, {
        office: office?.name || code,
        tablet: "",
        tabletFocal: "",
        tv: "",
        tvFocal: "",
        focalPerson: String(r.focal_name ?? ""),
        focalPosition: String(r.focal_position ?? ""),
        notes: String(r.notes ?? ""),
      });
    }
    const row = prizeByOffice.get(code)!;
    if (String(r.item) === "tablet") {
      row.tablet = String(r.status ?? "");
      row.tabletFocal = String(r.focal_name ?? "");
    } else {
      row.tv = String(r.status ?? "");
      row.tvFocal = String(r.focal_name ?? "");
    }
  }
  const prizes = offices
    .filter((o) => prizeByOffice.has(o.code))
    .map((o) => prizeByOffice.get(o.code)!);

  let inputCellsFilled = 0;
  for (const rows of [resRes.rows, collRes.rows, gprRes.rows, timeRes.rows]) {
    for (const r of rows) {
      for (const [k, v] of Object.entries(r)) {
        if (
          k !== "office_code" &&
          k !== "month" &&
          v !== null &&
          v !== undefined
        )
          inputCellsFilled++;
      }
    }
  }

  const top5Codes = new Set([...top5FL, ...top5NFL].map((r) => r.code));
  const currentScores = scoreEntries.filter((s) =>
    top5Codes.has(s.office_code),
  );
  const ratedOffice = currentScores.filter((s) =>
    s.officeScores.every((v) => v !== null),
  ).length;
  const ratedFocal = currentScores.filter((s) =>
    s.focalScores.every((v) => v !== null),
  ).length;

  const checks = buildChecks({
    settings: settingsMap,
    offices,
    inputCellsFilled,
    completeFL: initialFL.filter((r) => r.status.startsWith("✓")).length,
    completeNFL: initialNFL.filter((r) => r.status.startsWith("✓")).length,
    top5FL: top5FL.length,
    top5NFL: top5NFL.length,
    finalsFL: finalFL.offices.filter((r) => r.finalTotal !== null).length,
    finalsNFL: finalNFL.offices.filter((r) => r.finalTotal !== null).length,
    ratedOffice,
    ratedFocal,
  });

  return {
    connected: true,
    missingEnv: [],
    fetchedAt: new Date().toISOString(),
    cached: false,
    offices,
    settings: toSettingsObject(settingsMap),
    inputResolution: computed.map((c) => c.monthly.resolution),
    inputCollection: computed.map((c) => c.monthly.collection),
    inputGpr: computed.map((c) => c.monthly.gpr),
    inputTimeliness: computed.map((c) => c.monthly.timeliness),
    initialFL,
    initialNFL,
    validators,
    validatorAvg,
    finalFL,
    finalNFL,
    checks,
    prevScores,
    prizes,
  };
}

async function refreshInBackground(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const data = await fetchSnapshot();
    cache = { data, fetchedAt: Date.now() };
  } catch (err) {
    console.error("Snapshot background refresh failed:", err);
  } finally {
    refreshing = false;
  }
}

/** Serve the cached snapshot instantly; re-query Turso in the background when stale. */
export async function getSnapshot(): Promise<Snapshot> {
  if (!cache) {
    const data = await fetchSnapshot();
    cache = { data, fetchedAt: Date.now() };
    return { ...data, cached: false };
  }
  const age = Date.now() - cache.fetchedAt;
  if (age > CACHE_TTL_MS) {
    void refreshInBackground();
    return { ...cache.data, cached: true };
  }
  return { ...cache.data, cached: true };
}

/** Drop the cache so the next read fetches fresh data (call after writes). */
export function invalidateSnapshot(): void {
  cache = null;
}

// ------------------------------------------------------------------ writes
export type Criterion = "resolution" | "collection" | "gpr" | "timeliness";

const MONTHLY_TABLES: Record<Criterion, { table: string; cols: string[] }> = {
  resolution: { table: "monthly_resolution", cols: ["acted", "plans"] },
  collection: { table: "monthly_collection", cols: ["forms", "clients"] },
  gpr: { table: "monthly_gpr", cols: ["gpr"] },
  timeliness: { table: "monthly_timeliness", cols: ["days"] },
};

/**
 * Upsert one office + criterion's 10 month values. A blank month deletes
 * that month's row (blank = no data, never zero).
 */
export async function writeMonthly(
  code: string,
  criterion: Criterion,
  months: {
    first: (number | null)[];
    second?: (number | null)[];
    dates?: { released: string; received: string }[];
  },
): Promise<void> {
  const db = getTurso();
  if (!db)
    throw new Error("Database is not connected (missing Turso env vars).");
  const normalized = {
    ...months,
    first: [...months.first],
    dates: months.dates?.map((d) => ({ ...d })),
  };
  if (criterion === "resolution" || criterion === "timeliness")
    await ensureCalendar();
  const zeroMonths =
    criterion === "resolution"
      ? (months.second || []).flatMap((count, i) =>
          count === 0 ? [i + 1] : [],
        )
      : criterion === "timeliness"
        ? (
            await db.execute({
              sql: "SELECT month FROM monthly_resolution WHERE office_code=? AND plans=0 AND month BETWEEN 1 AND 10",
              args: [code],
            })
          ).rows.map((r) => Number(r.month))
        : [];
  if (zeroMonths.length) await ensureCalendar();
  if (criterion === "timeliness")
    for (const m of zeroMonths) {
      normalized.first[m - 1] = null;
      if (normalized.dates)
        normalized.dates[m - 1] = { released: "", received: "" };
    }
  const stmts = [
    ...zeroMonths.flatMap((m) => zeroNegativeSubmissionCleanup(code, m)),
    ...buildMonthlyStatements(code, criterion, normalized),
  ];
  if (criterion === "timeliness" && normalized.dates) {
    await ensureCalendar();
    for (let i = 0; i < 10; i++) {
      const date = normalized.dates[i];
      stmts.push(
        date?.released && date?.received
          ? {
              sql: "INSERT INTO timeliness_dates (office_code, month, released, received) VALUES (?, ?, ?, ?) ON CONFLICT(office_code, month) DO UPDATE SET released = excluded.released, received = excluded.received",
              args: [code, i + 1, date.released, date.received],
            }
          : {
              sql: "DELETE FROM timeliness_dates WHERE office_code = ? AND month = ?",
              args: [code, i + 1],
            },
      );
    }
  }
  await db.batch(stmts, "write");
  invalidateSnapshot();
}

function buildMonthlyStatements(
  code: string,
  criterion: Criterion,
  months: { first: (number | null)[]; second?: (number | null)[] },
): { sql: string; args: (string | number | null)[] }[] {
  const { table, cols } = MONTHLY_TABLES[criterion];
  const first = months.first.slice(0, 10);
  const second = (months.second || []).slice(0, 10);
  const out: { sql: string; args: (string | number | null)[] }[] = [];
  for (let m = 1; m <= 10; m++) {
    const v1 = first[m - 1] ?? null;
    const v2 = second[m - 1] ?? null;
    const allBlank =
      cols.length === 1 ? v1 === null : v1 === null && v2 === null;
    if (allBlank) {
      out.push({
        sql: `DELETE FROM ${table} WHERE office_code = ? AND month = ?`,
        args: [code, m],
      });
    } else if (cols.length === 1) {
      out.push({
        sql:
          `INSERT INTO ${table} (office_code, month, ${cols[0]}) VALUES (?, ?, ?) ` +
          `ON CONFLICT(office_code, month) DO UPDATE SET ${cols[0]} = excluded.${cols[0]}`,
        args: [code, m, v1],
      });
    } else {
      out.push({
        sql:
          `INSERT INTO ${table} (office_code, month, ${cols[0]}, ${cols[1]}) VALUES (?, ?, ?, ?) ` +
          `ON CONFLICT(office_code, month) DO UPDATE SET ${cols[0]} = excluded.${cols[0]}, ${cols[1]} = excluded.${cols[1]}`,
        args: [code, m, v1, v2],
      });
    }
  }
  return out;
}

export async function writeScores(input: {
  track: "Frontline" | "Non-frontline";
  rank: number;
  code?: string;
  validator: string;
  officeScores: (number | null)[];
  focalScores: (number | null)[];
}): Promise<void> {
  const db = getTurso();
  if (!db)
    throw new Error("Database is not connected (missing Turso env vars).");
  const snap = await getSnapshot();
  const top5 =
    input.track === "Frontline"
      ? snap.validatorAvg.slice(0, 5)
      : snap.validatorAvg.slice(5, 10);
  const office = top5[input.rank - 1];
  if (!office || !office.code)
    throw new Error(`No office at rank ${input.rank} for ${input.track}.`);
  if (input.code && input.code !== office.code) throw new Error("RANK_CHANGED");
  const [car, onsite, best, interview] = input.officeScores;
  const [ccarta, innovation, responsive, prof, comms] = input.focalScores;
  // Legacy schema keys scores by rank. Keep a stable storage slot per
  // office/validator so saving after a re-ranking never overwrites another office.
  const transaction = await db.transaction("write");
  try {
    const existing = await transaction.execute({
      sql: "SELECT rank FROM validator_scores WHERE track = ? AND validator = ? AND office_code = ? ORDER BY rank DESC LIMIT 1",
      args: [input.track, input.validator, office.code],
    });
    const highest = existing.rows.length
      ? null
      : await transaction.execute({
          sql: "SELECT COALESCE(MAX(rank), 0) + 1 AS slot FROM validator_scores WHERE track = ? AND validator = ?",
          args: [input.track, input.validator],
        });
    const slot = Number(existing.rows[0]?.rank ?? highest!.rows[0].slot);
    await transaction.execute({
      sql:
        `INSERT INTO validator_scores (track, rank, validator, office_code, car, onsite, best, interview, ccarta, innovation, responsive, prof, comms) ` +
        `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ` +
        `ON CONFLICT(track, rank, validator) DO UPDATE SET office_code = excluded.office_code, car = excluded.car, onsite = excluded.onsite, best = excluded.best, interview = excluded.interview, ccarta = excluded.ccarta, innovation = excluded.innovation, responsive = excluded.responsive, prof = excluded.prof, comms = excluded.comms`,
      args: [
        input.track,
        slot,
        input.validator,
        office.code,
        car,
        onsite,
        best,
        interview,
        ccarta,
        innovation,
        responsive,
        prof,
        comms,
      ],
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
  invalidateSnapshot();
}

// UI key -> settings table key.
export const SETTINGS_KEY_MAP: Record<string, string> = {
  validator1: "validator_1",
  validator2: "validator_2",
  validator3: "validator_3",
  finalInitialWeight: "final_initial_weight",
  sampleConstant: "sample_constant",
  minFormsFL: "min_forms_fl",
  minFormsNFL: "min_forms_nfl",
  gprMax: "gpr_max",
  validatorScale: "validator_scale",
  flRes: "fl_res_weight",
  flColl: "fl_coll_weight",
  flGpr: "fl_gpr_weight",
  flTime: "fl_time_weight",
  nflRes: "nf_res_weight",
  nflColl: "nf_coll_weight",
  nflGpr: "nf_gpr_weight",
  nflTime: "nf_time_weight",
  time1: "time_band_1_3",
  time2: "time_band_4_5",
  time3: "time_band_6_7",
  time4: "time_band_8_10",
  time5: "time_band_11_15",
  time6: "time_band_16_plus",
  itemCar: "office_w_car",
  itemOnsite: "office_w_onsite",
  itemBest: "office_w_best",
  itemInterview: "office_w_interview",
  itemCcArta: "focal_w_ccarta",
  itemInnovation: "focal_w_innovation",
  itemResponsive: "focal_w_responsive",
  itemProfessionalism: "focal_w_prof",
  itemCommunication: "focal_w_comms",
};

export async function writeSettings(
  cells: { key: string; value: string | number }[],
): Promise<void> {
  const db = getTurso();
  if (!db)
    throw new Error("Database is not connected (missing Turso env vars).");
  for (const c of cells) {
    const dbKey = SETTINGS_KEY_MAP[c.key];
    if (!dbKey) throw new Error(`Not an editable setting: ${c.key}`);
    await db.execute({
      sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      args: [dbKey, String(c.value)],
    });
  }
  invalidateSnapshot();
}

/**
 * Update focal persons for one or more offices. An empty name/position
 * clears that field (blank = no focal person assigned yet).
 */
export async function writeOfficeFocals(
  rows: { code: string; focal: string; focalPosition: string }[],
): Promise<void> {
  const db = getTurso();
  if (!db)
    throw new Error("Database is not connected (missing Turso env vars).");
  await db.batch(
    rows.map((r) => ({
      sql: "UPDATE offices SET focal_name = ?, focal_position = ? WHERE code = ?",
      args: [r.focal, r.focalPosition, r.code],
    })),
    "write",
  );
  invalidateSnapshot();
}
