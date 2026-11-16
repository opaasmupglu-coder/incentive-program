import { mkdirSync, writeFileSync } from "node:fs";
import { getTurso } from "../lib/turso";
import { getCalendar } from "../lib/calendar";
import { countWorkingDays } from "../lib/working-days";

// Preview by default; --apply backs up the original rows before updating.
process.loadEnvFile(".env.local");
async function main() {
  const calendar = await getCalendar();
  const db = getTurso()!;
  const tx = await db.transaction("write");
  try {
    const dates = (
      await tx.execute(
        "SELECT d.*,t.days,(CASE WHEN b.office_code IS NOT NULL THEN b.feedback_count ELSE r.plans END) AS plans FROM timeliness_dates d LEFT JOIN monthly_timeliness t ON t.office_code=d.office_code AND t.month=d.month LEFT JOIN monthly_resolution r ON r.office_code=d.office_code AND r.month=d.month LEFT JOIN monthly_timeliness_basis b ON b.office_code=d.office_code AND b.month=d.month",
      )
    ).rows;
    const plan = dates
      .filter((r) => r.plans !== 0)
      .map((r) => {
        const days = countWorkingDays(
          calendar,
          String(r.released || ""),
          String(r.received || ""),
        );
        if (days === null)
          throw new Error(`Invalid dates: ${r.office_code}, month ${r.month}`);
        return {
          code: String(r.office_code),
          month: Number(r.month),
          before: r.days,
          days,
        };
      });
    const changed = plan.filter((r) => r.before !== r.days);
    if (!process.argv.includes("--apply")) {
      console.log(
        `Preview: ${plan.length} date-based records, ${changed.length} need recalculation. Manual day counts are unchanged. Use --apply to update.`,
      );
      return;
    }
    mkdirSync(".local", { recursive: true });
    const backup = `.local/timeliness-release-day-backup-${Date.now()}.json`;
    writeFileSync(
      backup,
      JSON.stringify(
        { capturedAt: new Date().toISOString(), dates, plan },
        null,
        2,
      ),
      { flag: "wx" },
    );
    for (const r of changed) {
      await tx.execute({
        sql: "INSERT INTO monthly_timeliness (office_code,month,days) VALUES (?,?,?) ON CONFLICT(office_code,month) DO UPDATE SET days=excluded.days",
        args: [r.code, r.month, r.days],
      });
    }
    await tx.commit();
    console.log(
      `Recalculated ${changed.length} date-based records, excluding release day. Backup: ${backup}. Manual counts and submission dates preserved.`,
    );
  } finally {
    if (!tx.closed) await tx.rollback();
    db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
