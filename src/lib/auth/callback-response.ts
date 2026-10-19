import { NextResponse } from "next/server";
import { completeOAuthCallback } from "@/lib/auth/service";
import { resolvePublicOrigin } from "@/lib/origin";
import { StorageError } from "@/lib/crypto/seal";

export async function oauthCallbackResponse(request: Request, platform: string) {
  const origin = resolvePublicOrigin(request);
  const url = new URL(request.url);

  try {
    const result = await completeOAuthCallback({
      platform,
      code: url.searchParams.get("code"),
      error: url.searchParams.get("error"),
      errorDescription: url.searchParams.get("error_description"),
      state: url.searchParams.get("state"),
    });
    const dest = new URL(result.pagePath, origin);
    if (!result.ok) {
      dest.searchParams.set("error", result.error.code);
      return NextResponse.redirect(dest);
    }
    dest.searchParams.set("connected", "1");
    return NextResponse.redirect(dest);
  } catch (error) {
    const dest = new URL("/", origin);
    dest.searchParams.set("error", error instanceof StorageError ? error.code : "unknown");
    return NextResponse.redirect(dest);
  }
}
