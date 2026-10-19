import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth/accounts";
import { isSameOrigin, resolvePublicOrigin } from "@/lib/origin";
import { getProviderModule } from "@/lib/providers/registry";
import { StorageError } from "@/lib/crypto/seal";
import { explainYouTubeError } from "@/lib/providers/youtube/errors";
import { youtubeRedirectUri } from "@/lib/providers/youtube/config";
import { resolveLinkedInRedirectUri } from "@/lib/providers/linkedin/redirect";
import { resolveXRedirectUri } from "@/lib/providers/x/redirect";
import { describeCredentials, readCredentials, upsertCredentials } from "@/lib/store";

type Context = { params: Promise<{ platform: string }> };

function storageFailure(error: unknown) {
  if (!(error instanceof StorageError)) return null;
  const explained = explainYouTubeError(error);
  return NextResponse.json(
    { message: explained.bodyAr, code: explained.code },
    { status: 500 },
  );
}

function denied() {
  return NextResponse.json({ message: "هذه الصفحة للمسؤول فقط." }, { status: 401 });
}

export async function GET(request: Request, context: Context) {
  if (!adminFromRequest(request)) return denied();
  const { platform } = await context.params;
  const provider = getProviderModule(platform);
  if (!provider || provider.meta.availability !== "ready") {
    return NextResponse.json({ message: "هذه المنصة غير جاهزة." }, { status: 404 });
  }
  try {
    const status = describeCredentials(platform, provider.meta.credentialFields);
    if (platform === "youtube") {
      return NextResponse.json({ ...status, redirectUri: youtubeRedirectUri() });
    }
    if (platform === "x") {
      const origin = resolvePublicOrigin(request);
      const credentials = readCredentials("x") ?? {};
      return NextResponse.json({
        ...status,
        redirectUri: resolveXRedirectUri({ credentials, origin }),
        redirectLocked: Boolean(process.env.X_REDIRECT_URI?.trim()),
        sharedPublicBase: process.env.PUBLIC_BASE_URL?.trim() || null,
      });
    }
    if (platform === "linkedin") {
      const origin = resolvePublicOrigin(request);
      const credentials = readCredentials("linkedin") ?? {};
      return NextResponse.json({
        ...status,
        redirectUri: resolveLinkedInRedirectUri({ credentials, origin }),
        sharedPublicBase: process.env.PUBLIC_BASE_URL?.trim() || null,
      });
    }
    return NextResponse.json(status);
  } catch (error) {
    const failure = storageFailure(error);
    if (failure) return failure;
    throw error;
  }
}

export async function PUT(request: Request, context: Context) {
  if (!adminFromRequest(request)) return denied();
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "الطلب ليس من نفس الأصل." }, { status: 403 });
  }
  const { platform } = await context.params;
  const provider = getProviderModule(platform);
  if (!provider || provider.meta.availability !== "ready") {
    return NextResponse.json({ message: "هذه المنصة غير جاهزة." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "تعذّر قراءة النموذج." }, { status: 400 });
  }
  try {
    const result = upsertCredentials(
      platform,
      body,
      provider.meta.credentialFields,
      provider.prepareCredentials,
    );
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }
    return NextResponse.json(result.status);
  } catch (error) {
    const failure = storageFailure(error);
    if (failure) return failure;
    throw error;
  }
}
