import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await getSnapshot();
    return NextResponse.json(snap);
  } catch (err) {
    console.error("snapshot failed:", err);
    return NextResponse.json(
      { error: "Could not read the database. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN." },
      { status: 500 }
    );
  }
}
