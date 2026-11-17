import type { InitialRow } from "./types";

export function initialCriteria(
  row: InitialRow,
  weights: number[],
  gprScale = 100,
) {
  const actual = [
    row.resolution,
    row.collection,
    row.gpr === null ? null : row.gpr / gprScale,
    row.timeliness,
  ];
  return actual.map((rate, index) => ({
    actual: rate,
    weighted: rate === null ? null : rate * (weights[index] ?? 0),
  }));
}

/** Running totals and stable ranks; incomplete source totals remain null. */
export function initialPreview(
  rows: InitialRow[],
  weights: number[],
  gprScale = 100,
) {
  const preview = rows
    .map((row) => {
      const criteria = initialCriteria(row, weights, gprScale);
      const entered = criteria.filter((c) => c.actual !== null).length;
      return {
        ...row,
        entered,
        provisional: row.total === null,
        displayTotal:
          row.total ??
          (entered
            ? criteria.reduce((sum, c) => sum + (c.weighted ?? 0), 0)
            : null),
        displayRank: null as number | null,
        previewTop5: false,
      };
    })
    .sort((a, b) =>
      a.displayTotal === null
        ? b.displayTotal === null
          ? 0
          : 1
        : b.displayTotal === null
          ? -1
          : b.displayTotal - a.displayTotal,
    );
  for (const [index, row] of preview.entries()) {
    if (row.displayTotal === null) continue;
    row.displayRank =
      1 +
      preview.filter(
        (other) =>
          other.displayTotal !== null && other.displayTotal > row.displayTotal!,
      ).length;
    row.previewTop5 = index < 5;
  }
  return preview;
}

/** Use the same running Top 5 for rankings, validator ratings, and finals. */
export function initialTop5(
  rows: InitialRow[],
  weights: number[],
  gprScale = 100,
) {
  return initialPreview(rows, weights, gprScale).filter(
    (row) => row.previewTop5,
  );
}
