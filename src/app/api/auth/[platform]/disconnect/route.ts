import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth/accounts";
import { disconnectPlatform } from "@/lib/auth/service";
import { isSameOrigin } from "@/lib/origin";
import { StorageError } from "@/lib/crypto/seal";
import { explainYouTubeError } from "@/lib/providers/youtube/errors";

type Context = { params: Promise<{ platform: string }> };

export async function POST(request: Request, context: Context) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "الطلب ليس من نفس الأصل." }, { status: 403 });
  }
  const { platform } = await context.params;
  const user = userFromRequest(request);
  if (!user) {
    return NextResponse.json({ message: "ادخل بحسابك المحلي أولاً." }, { status: 401 });
  }
  try {
    const result = await disconnectPlatform(platform, user.id);
    if (!result.ok) {
      return NextResponse.json({ message: result.error.bodyAr, code: result.error.code }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const explained = explainYouTubeError(error);
    const status = error instanceof StorageError ? 500 : 500;
    return NextResponse.json({ message: explained.bodyAr, code: explained.code }, { status });
  }
}
