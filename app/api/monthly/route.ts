import { NextRequest, NextResponse } from "next/server";
import { writeMonthly, type Criterion } from "@/lib/db";
import { getCalendar, ensureCalendar } from "@/lib/calendar";
import { countWorkingDays } from "@/lib/working-days";
import { getTurso } from "@/lib/turso";

export const dynamic = "force-dynamic";

const CRITERIA: Criterion[] = ["resolution", "collection", "gpr", "timeliness"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code || "");
    const criterion = String(body.criterion || "") as Criterion;
    if (!code)
      return NextResponse.json(
        { error: "Office code is required." },
        { status: 400 },
      );
    if (!CRITERIA.includes(criterion))
      return NextResponse.json(
        { error: "Unknown criterion." },
        { status: 400 },
      );
    const first = Array.isArray(body.first) ? body.first : [];
    const second = Array.isArray(body.second) ? body.second : [];
    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      return typeof v === "number" ? v : Number(String(v));
    };
    const numbers: (number | null)[] = first.slice(0, 10).map(toNum);
    const secondNumbers: (number | null)[] = second.slice(0, 10).map(toNum);
    if (
      [...numbers, ...secondNumbers].some(
        (n) =>
          n !== null &&
          (!Number.isFinite(n) ||
            n < 0 ||
            (criterion !== "gpr" && !Number.isInteger(n))),
      )
    )
      return NextResponse.json(
        {
          error:
            criterion === "gpr"
              ? "Enter a rating between 0 and 100."
              : "Enter non-negative whole numbers.",
        },
        { status: 400 },
      );
    if (criterion === "gpr" && numbers.some((n) => n !== null && n > 100))
      return NextResponse.json(
        { error: "GPR must be between 0 and 100." },
        { status: 400 },
      );
    if (
      criterion === "resolution" &&
      numbers.some(
        (n, i) =>
          n !== null && secondNumbers[i] != null && n > secondNumbers[i]!,
      )
    )
      return NextResponse.json(
        {
          error:
            "Total Acted Upon cannot exceed Total Negative Comments + Suggestions.",
        },
        { status: 400 },
      );
    let dates: { released: string; received: string }[] | undefined;
    if (criterion === "timeliness") await ensureCalendar();
    const zeroMonths =
      criterion === "timeliness"
        ? new Set(
            (
              await getTurso()?.execute({
                sql: "SELECT month FROM monthly_resolution WHERE office_code=? AND plans=0",
                args: [code],
              })
            )?.rows.map((r) => Number(r.month)) || [],
          )
        : new Set<number>();
    if (criterion === "timeliness" && Array.isArray(body.dates)) {
      dates = body.dates
        .slice(0, 10)
        .map((d: { released?: string; received?: string }) => ({
          released: String(d?.released || ""),
          received: String(d?.received || ""),
        }));
      const calendar = await getCalendar();
      for (let i = 0; i < dates!.length; i++) {
        if (zeroMonths.has(i + 1)) {
          dates![i] = { released: "", received: "" };
          numbers[i] = null;
          continue;
        }
        const d = dates![i];
        if (!d.released && !d.received) continue;
        const count = countWorkingDays(calendar, d.released, d.received);
        if (count === null)
          return NextResponse.json(
            {
              error: `Month ${i + 1}: choose valid release and received dates within the 2026 calendar.`,
            },
            { status: 400 },
          );
        numbers[i] = count;
      }
    }
    await writeMonthly(code, criterion, {
      first: numbers,
      second: second.slice(0, 10).map(toNum),
      dates,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("monthly save failed:", err);
    return NextResponse.json(
      { error: "Could not save. Check the database connection and try again." },
      { status: 500 },
    );
  }
}
