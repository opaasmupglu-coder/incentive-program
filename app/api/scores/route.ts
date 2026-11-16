import { NextRequest, NextResponse } from "next/server";
import { writeScores } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const track = String(body.track || "");
    const rank = parseInt(String(body.rank || ""), 10);
    const validator = String(body.validator || "");
    if (track !== "Frontline" && track !== "Non-frontline")
      return NextResponse.json(
        { error: "Track is required." },
        { status: 400 },
      );
    if (!Number.isFinite(rank) || rank < 1 || rank > 5)
      return NextResponse.json({ error: "Rank must be 1–5." }, { status: 400 });
    if (!validator)
      return NextResponse.json(
        { error: "Validator is required." },
        { status: 400 },
      );
    const toScore = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      if (!Number.isFinite(n) || n < 1 || n > 5) return null;
      return n;
    };
    const officeScores = (
      Array.isArray(body.officeScores) ? body.officeScores : []
    )
      .slice(0, 4)
      .map(toScore);
    const focalScores = (
      Array.isArray(body.focalScores) ? body.focalScores : []
    )
      .slice(0, 5)
      .map(toScore);
    while (officeScores.length < 4) officeScores.push(null);
    while (focalScores.length < 5) focalScores.push(null);
    await writeScores({
      track,
      rank,
      validator,
      officeScores,
      focalScores,
      code: typeof body.code === "string" ? body.code : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "RANK_CHANGED")
      return NextResponse.json(
        {
          error:
            "The rankings changed while you were editing. Reload the page before saving this office.",
        },
        { status: 409 },
      );
    console.error("scores save failed:", err);
    return NextResponse.json(
      { error: "Could not save. Check the database connection and try again." },
      { status: 500 },
    );
  }
}
