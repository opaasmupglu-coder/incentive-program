import type { CalendarDay } from "./calendar";
export function countWorkingDays(
  days: CalendarDay[],
  released: string,
  received: string,
): number | null {
  if (!released || !received || received < released) return null;
  const range = days.filter((d) => d.date >= released && d.date <= received);
  const expected =
    Math.round(
      (Date.parse(received + "T00:00:00Z") -
        Date.parse(released + "T00:00:00Z")) /
        86400000,
    ) + 1;
  if (!Number.isFinite(expected) || range.length !== expected) return null;
  // Validate full calendar coverage, but start counting after release day.
  return range.filter((d) => d.date > released && d.working).length;
}
