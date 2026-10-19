import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth/accounts";
import { beginOAuth } from "@/lib/auth/service";
import { resolvePublicOrigin } from "@/lib/origin";
import { getProviderModule } from "@/lib/providers/registry";
import { StorageError } from "@/lib/crypto/seal";

type Context = { params: Promise<{ platform: string }> };

export async function GET(request: Request, context: Context) {
  const { platform } = await context.params;
  const origin = resolvePublicOrigin(request);
  const provider = getProviderModule(platform);
  const pagePath = provider?.meta.pagePath ?? "/";

  try {
    const user = userFromRequest(request);
    const result = beginOAuth(platform, origin, user?.id ?? null);
    if (result.type === "redirect") {
      return NextResponse.redirect(result.url);
    }
    if (result.type === "needs_account") {
      const signIn = new URL("/", origin);
      signIn.searchParams.set("needAccount", "1");
      return NextResponse.redirect(signIn);
    }
    if (result.type === "needs_credentials") {
      const disabled = new URL("/", origin);
      disabled.searchParams.set("disabled", platform);
      return NextResponse.redirect(disabled);
    }
    if (result.type === "unavailable") {
      return NextResponse.redirect(new URL(pagePath, origin));
    }
    const failed = new URL(pagePath, origin);
    failed.searchParams.set("error", result.error.code);
    return NextResponse.redirect(failed);
  } catch (error) {
    const failed = new URL(pagePath, origin);
    failed.searchParams.set("error", error instanceof StorageError ? error.code : "unknown");
    return NextResponse.redirect(failed);
  }
}
