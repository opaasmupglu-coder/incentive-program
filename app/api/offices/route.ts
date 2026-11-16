import { NextRequest, NextResponse } from "next/server";
import { writeOfficeFocals } from "@/lib/db";

export const dynamic = "force-dynamic";

// Update focal persons for one or more offices.
// Accepts either a single office { code, focal, focalPosition } or a batch
// { offices: [{ code, focal, focalPosition }, ...] }. Empty strings clear
// a field (blank = no focal person assigned yet).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let rows: { code: string; focal: string; focalPosition: string }[] = [];
    if (Array.isArray(body.offices)) {
      rows = body.offices;
    } else if (body && typeof body.code === "string") {
      rows = [{ code: body.code, focal: body.focal ?? "", focalPosition: body.focalPosition ?? "" }];
    }
    if (rows.length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    const cleaned: { code: string; focal: string; focalPosition: string }[] = [];
    for (const r of rows) {
      const code = String(r.code || "").trim();
      if (!code) return NextResponse.json({ error: "An office code is missing." }, { status: 400 });
      cleaned.push({
        code,
        focal: String(r.focal ?? "").trim(),
        focalPosition: String(r.focalPosition ?? "").trim(),
      });
    }
    await writeOfficeFocals(cleaned);
    return NextResponse.json({ ok: true, updated: cleaned.length });
  } catch (err) {
    console.error("offices save failed:", err);
    return NextResponse.json({ error: "Could not save. Check the database connection and try again." }, { status: 500 });
  }
}
