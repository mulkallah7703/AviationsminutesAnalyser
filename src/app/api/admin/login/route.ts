import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createSession,
  sessionCookie,
  verifyAdminPassword,
} from "@/lib/auth/accounts";
import { isSameOrigin } from "@/lib/origin";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "الطلب ليس من نفس الأصل." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body) return NextResponse.json({ message: "تعذّر قراءة النموذج." }, { status: 400 });
  if (!verifyAdminPassword(String(body.password ?? ""))) {
    return NextResponse.json({ message: "كلمة المرور غير صحيحة." }, { status: 401 });
  }
  const token = createSession("admin", null);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, sessionCookie(request, 7 * 24 * 60 * 60));
  return response;
}
