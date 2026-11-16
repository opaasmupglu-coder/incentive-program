import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, appPasswordSet, cookieValue } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!appPasswordSet()) return NextResponse.json({ ok: true, gated: false });
  try {
    const body = await req.json();
    if (!verifyPassword(String(body.password || ""))) {
      return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, gated: true });
    res.cookies.set(AUTH_COOKIE, await cookieValue(), {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
