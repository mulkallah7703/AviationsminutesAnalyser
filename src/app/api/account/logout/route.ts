import { NextResponse } from "next/server";
import { USER_COOKIE, destroySession, readCookieValue, sessionCookie } from "@/lib/auth/accounts";
import { isSameOrigin } from "@/lib/origin";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "الطلب ليس من نفس الأصل." }, { status: 403 });
  }
  const token = readCookieValue(request.headers.get("cookie"), USER_COOKIE);
  if (token) destroySession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_COOKIE, "", sessionCookie(request, 0));
  return response;
}
