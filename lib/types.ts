// Snapshot types — the shape returned by GET /api/snapshot.
// All values are computed by the app from the Turso tables.

export type Office = {
  code: string;
  short: string;
  name: string;
  track: "Frontline" | "Non-frontline" | string;
  focal: string;
  focalPosition: string;
  notes: string;
};

export type Settings = {
  flWeights: number[]; // Resolution, Collection, GPR, Timeliness
  nflWeights: number[];
  flTotal: number | null;
  nflTotal: number | null;
  finalInitialWeight: number | null;
  sampleConstant: number | null;
  minFormsFL: number | null;
  minFormsNFL: number | null;
  gprMax: number | null;
  validatorScale: number | null;
  timelinessBands: number[]; // 1-3d, 4-5d, 6-7d, 8-10d, 11-15d, 16+d
  officeItemWeights: number[]; // CAR, Onsite, Best Practices, Interview
  focalItemWeights: number[]; // CC-ARTA, Innovation, Responsiveness, Prof, Comms
  officeSubtotal: number | null;
  focalSubtotal: number | null;
  validatorNames: string[]; // 3 slots
};

export type MonthlyRow = {
  code: string;
  // per-month inputs (10 months, Jan..Oct); null = blank on the sheet
  first: (number | null)[];
  second: (number | null)[];
  // computed per-month rate/score from the sheet (read-only)
  computed: (number | null)[];
};

export type InitialRow = {
  code: string;
  name: string;
  resolution: number | null;
  resolutionMonths: number | null;
  collection: number | null;
  collectionMonths: number | null;
  gpr: number | null;
  gprMonths: number | null;
  timeliness: number | null;
  timelinessMonths: number | null;
  total: number | null;
  status: string;
  rank: number | null;
  tieBreakRank: number | null;
};

export type ValidatorRow = {
  rank: number | null;
  validator: string;
  code: string;
  name: string;
  officeScores: (number | null)[]; // 4 items
  focalScores: (number | null)[]; // 5 items
  officeTotal: number | null;
  focalTotal: number | null;
  officeRated: boolean;
  focalRated: boolean;
  sheetRow: number; // absolute row on the Validators sheet (for writes)
};

export type ValidatorAvgRow = {
  code: string;
  name: string;
  officePerValidator: (number | null)[];
  officeAvg: number | null;
  officeRatedCount: number | null;
  focalPerValidator: (number | null)[];
  focalAvg: number | null;
  focalRatedCount: number | null;
};

export type FinalRow = {
  code: string;
  name: string;
  officeName?: string;
  initialTotal: number | null;
  initialProvisional?: boolean;
  initial60: number | null;
  validatorAvg: number | null;
  finalTotal: number | null;
  rank: number | null;
  status: string;
};

export type CheckRow = { label: string; result: string; meaning: string };

export type PrizeRow = {
  office: string;
  tablet: string;
  tabletFocal: string;
  tv: string;
  tvFocal: string;
  focalPerson: string;
  focalPosition: string;
  notes: string;
};

export type PrevScoreRow = {
  validator: string;
  code: string;
  office: string;
  scores: (number | null)[];
};

export type Snapshot = {
  connected: boolean;
  missingEnv: string[];
  fetchedAt: string | null;
  cached: boolean;
  offices: Office[];
  settings: Settings | null;
  inputResolution: MonthlyRow[];
  inputCollection: MonthlyRow[];
  inputGpr: MonthlyRow[];
  inputTimeliness: MonthlyRow[];
  initialFL: InitialRow[];
  initialNFL: InitialRow[];
  validators: ValidatorRow[];
  validatorAvg: ValidatorAvgRow[];
  finalFL: { offices: FinalRow[]; focals: FinalRow[] };
  finalNFL: { offices: FinalRow[]; focals: FinalRow[] };
  checks: CheckRow[];
  prevScores: PrevScoreRow[];
  prizes: PrizeRow[];
};

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
] as const;

export const OFFICE_ITEMS = [
  "CAR",
  "Onsite Visit",
  "Best Practices",
  "Interview",
];
export const FOCAL_ITEMS = [
  "CC & ARTA Compliance",
  "Innovation & Initiative",
  "Responsiveness",
  "Professionalism",
  "Communication",
];
