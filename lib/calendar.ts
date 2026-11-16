import source from "../data/working-days-2026.json";
import { getTurso } from "./turso";
export type CalendarDay = { date: string; working: boolean; note: string };
let initialized: Promise<void> | null = null;
export async function ensureCalendar() {
  if (!initialized)
    initialized = (async () => {
      const db = getTurso();
      if (!db) throw new Error("The program database is not connected.");
      await db.batch(
        [
          "CREATE TABLE IF NOT EXISTS working_days (date TEXT PRIMARY KEY, working INTEGER NOT NULL, note TEXT)",
          "CREATE TABLE IF NOT EXISTS timeliness_dates (office_code TEXT, month INTEGER, released TEXT, received TEXT, PRIMARY KEY(office_code, month))",
        ],
        "write",
      );
      const count = await db.execute(
        "SELECT COUNT(*) AS n FROM working_days WHERE date LIKE '2026-%'",
      );
      if (Number(count.rows[0].n) < 365) {
        for (let i = 0; i < source.days.length; i += 50)
          await db.batch(
            source.days
              .slice(i, i + 50)
              .map((d) => ({
                sql: "INSERT OR IGNORE INTO working_days (date, working, note) VALUES (?, ?, ?)",
                args: [d.date, d.working ? 1 : 0, d.note],
              })),
            "write",
          );
      }
    })().catch((error) => {
      initialized = null;
      throw error;
    });
  await initialized;
}
export async function getCalendar(): Promise<CalendarDay[]> {
  await ensureCalendar();
  const result = await getTurso()!.execute(
    "SELECT date, working, note FROM working_days ORDER BY date",
  );
  return result.rows.map((r) => ({
    date: String(r.date),
    working: Number(r.working) === 1,
    note: String(r.note || ""),
  }));
}
export { source as calendarSource };
