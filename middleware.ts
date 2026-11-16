import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, appPasswordSet, cookieValue } from "@/lib/auth";

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(req: NextRequest) {
  if (!appPasswordSet()) return NextResponse.next();
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie === (await cookieValue())) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}
