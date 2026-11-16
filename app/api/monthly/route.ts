import { NextRequest, NextResponse } from "next/server";
import { writeMonthly, type Criterion } from "@/lib/db";

export const dynamic = "force-dynamic";

const CRITERIA: Criterion[] = ["resolution", "collection", "gpr", "timeliness"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code || "");
    const criterion = String(body.criterion || "") as Criterion;
    if (!code) return NextResponse.json({ error: "Office code is required." }, { status: 400 });
    if (!CRITERIA.includes(criterion))
      return NextResponse.json({ error: "Unknown criterion." }, { status: 400 });
    const first = Array.isArray(body.first) ? body.first : [];
    const second = Array.isArray(body.second) ? body.second : [];
    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };
    await writeMonthly(code, criterion, {
      first: first.slice(0, 10).map(toNum),
      second: second.slice(0, 10).map(toNum),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("monthly save failed:", err);
    return NextResponse.json({ error: "Could not save. Check the database connection and try again." }, { status: 500 });
  }
}
