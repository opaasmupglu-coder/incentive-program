import { NextResponse } from "next/server";
import { runSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

// POST /api/seed — one-time database seed from the deployed app.
// Protected by the app's password gate (middleware) like every other route.
// Safe to run more than once: it never touches monthly inputs or scores.
export async function POST() {
  try {
    const counts = await runSeed();
    return NextResponse.json({ seeded: true, counts });
  } catch (err) {
    console.error("seed failed:", err);
    return NextResponse.json(
      { error: "Seed failed. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    hint: "POST to this endpoint (while logged in) to create the tables and load the reference data: offices, settings, previous validator scores, prizes.",
  });
}
