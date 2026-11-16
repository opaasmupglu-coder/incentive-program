import { NextRequest, NextResponse } from "next/server";
import { calendarSource, getCalendar } from "@/lib/calendar";
import { getTurso } from "@/lib/turso";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const days = await getCalendar();
    const office = req.nextUrl.searchParams.get("office");
    const dates = office
      ? (
          await getTurso()!.execute({
            sql: "SELECT month, released, received FROM timeliness_dates WHERE office_code = ?",
            args: [office],
          })
        ).rows
      : [];
    return NextResponse.json({
      days,
      dates,
      source: calendarSource.source,
      importedOn: calendarSource.importedOn,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not load the working-day calendar. Check the database connection and try again.",
      },
      { status: 503 },
    );
  }
}
