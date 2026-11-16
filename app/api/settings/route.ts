import { NextRequest, NextResponse } from "next/server";
import { SETTINGS_KEY_MAP, writeSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept either { cells: [{ key, value }] } (what the Settings page sends)
    // or a flat { key: value } object.
    let entries: { key: string; value: string | number }[] = [];
    if (Array.isArray(body.cells)) {
      entries = body.cells;
    } else if (body && typeof body === "object") {
      entries = Object.entries(body).map(([key, value]) => ({
        key,
        value: value as string | number,
      }));
    }
    if (entries.length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    const cleaned: { key: string; value: string | number }[] = [];
    for (const c of entries) {
      const key = String(c.key || "");
      if (!SETTINGS_KEY_MAP[key]) return NextResponse.json({ error: `Not an editable setting: ${key}` }, { status: 400 });
      cleaned.push({ key, value: typeof c.value === "number" ? c.value : String(c.value ?? "") });
    }
    await writeSettings(cleaned);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("settings save failed:", err);
    return NextResponse.json({ error: "Could not save. Check the database connection and try again." }, { status: 500 });
  }
}
