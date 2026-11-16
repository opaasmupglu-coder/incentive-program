import assert from "node:assert/strict";
import source from "../data/working-days-2026.json";
import { countWorkingDays } from "../lib/working-days";

const days = source.days;
assert.equal(days.length, 365);
assert.equal(new Set(days.map((d) => d.date)).size, 365);
assert.equal(days.filter((d) => d.working).length, 223);
assert.equal(countWorkingDays(days, "2026-01-01", "2026-01-05"), 1);
assert.equal(countWorkingDays(days, "2026-01-03", "2026-01-04"), 0);
assert.equal(countWorkingDays(days, "2026-01-05", "2026-01-05"), 0);
assert.equal(countWorkingDays(days, "2026-05-11", "2026-05-13"), 2);
assert.equal(countWorkingDays(days, "2026-01-05", "2026-01-06"), 1);
assert.equal(countWorkingDays(days, "2026-01-09", "2026-01-12"), 1);
assert.equal(countWorkingDays(days, "2026-01-03", "2026-01-05"), 1);
assert.equal(countWorkingDays(days, "2026-01-01", "2026-01-31"), 20);
assert.equal(countWorkingDays(days, "2026-02-01", "2026-02-28"), 19);
assert.equal(countWorkingDays(days, "2026-03-01", "2026-03-31"), 17);
assert.equal(countWorkingDays(days, "2026-01-06", "2026-01-05"), null);
assert.equal(countWorkingDays(days, "2025-12-31", "2026-01-05"), null);
assert.equal(countWorkingDays(days, "", "2026-01-05"), null);
assert.equal(countWorkingDays(days, "invalid", "2026-01-05"), null);
console.log(
  "Working-day coverage, monthly totals, excluded release day, included receipt day, same-day zero, weekends, and invalid ranges verified.",
);
