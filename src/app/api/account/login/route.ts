import { NextResponse } from "next/server";
import { USER_COOKIE, createSession, loginUser, sessionCookie } from "@/lib/auth/accounts";
import { isSameOrigin } from "@/lib/origin";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "الطلب ليس من نفس الأصل." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    displayName?: string;
    password?: string;
  } | null;
  if (!body) return NextResponse.json({ message: "تعذّر قراءة النموذج." }, { status: 400 });
  const result = loginUser(String(body.displayName ?? ""), String(body.password ?? ""));
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  const token = createSession("user", result.user.id);
  const response = NextResponse.json({ ok: true, displayName: result.user.displayName });
  response.cookies.set(USER_COOKIE, token, sessionCookie(request, 30 * 24 * 60 * 60));
  return response;
}
