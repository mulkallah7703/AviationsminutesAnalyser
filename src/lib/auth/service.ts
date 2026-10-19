import { OAuthError } from "@/lib/auth/oauth-error";
import { resolvePublicOrigin } from "@/lib/origin";
import { getReadyProvider } from "@/lib/providers/registry";
import type { UserFacingError } from "@/lib/providers/types";
import {
  consumeOAuthState,
  createOAuthState,
  deleteTokens,
  readCredentials,
  readTokens,
  saveTokens,
} from "@/lib/store";

export type BeginResult =
  | { type: "redirect"; url: string }
  | { type: "needs_credentials" }
  | { type: "needs_account" }
  | { type: "unavailable" }
  | { type: "error"; error: UserFacingError };

export function beginOAuth(platform: string, origin: string, userId: string | null): BeginResult {
  const provider = getReadyProvider(platform);
  if (!provider) return { type: "unavailable" };
  if (!userId) return { type: "needs_account" };
  const credentials = readCredentials(platform) ?? {};
  const missingField = provider.meta.credentialFields.some(
    (field) => !field.optional && !credentials[field.key],
  );
  if (missingField) {
    return { type: "needs_credentials" };
  }
  try {
    const redirectUri =
      provider.oauth.resolveRedirectUri?.({ credentials, origin }) ??
      `${origin}${provider.meta.callbackPath}`;
    const codeVerifier = provider.oauth.usesPkce?.(redirectUri)
      ? provider.oauth.createCodeVerifier?.()
      : undefined;
    if (provider.oauth.usesPkce?.(redirectUri) && !codeVerifier) {
      return {
        type: "error",
        error: provider.explainError(new OAuthError("pkce_unavailable"), redirectUri),
      };
    }
    const state = createOAuthState(platform, redirectUri, userId, Date.now(), codeVerifier);
    const url = provider.oauth.buildAuthorizationUrl({
      credentials,
      redirectUri,
      state,
      codeVerifier,
    });
    return { type: "redirect", url };
  } catch (error) {
    const redirectUri = `${origin}${provider.meta.callbackPath}`;
    const explained = provider.explainError(error, redirectUri);
    return { type: "error", error: explained };
  }
}

export async function completeOAuthCallback(input: {
  platform: string;
  code?: string | null;
  error?: string | null;
  errorDescription?: string | null;
  state?: string | null;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<{ ok: true; pagePath: string } | { ok: false; pagePath: string; error: UserFacingError }> {
  const provider = getReadyProvider(input.platform);
  const pagePath = provider?.meta.pagePath ?? "/";
  if (!provider) {
    return {
      ok: false,
      pagePath,
      error: {
        code: "unsupported_platform",
        titleAr: "هذه المنصة غير جاهزة",
        bodyAr: "الربط لهذه المنصة لم يُضف بعد.",
      },
    };
  }

  if (input.error) {
    const pending = input.state ? consumeOAuthState(input.state, input.now) : null;
    return {
      ok: false,
      pagePath,
      error: provider.explainError(
        new OAuthError(input.error, input.errorDescription ?? ""),
        pending?.redirectUri,
      ),
    };
  }

  if (!input.code || !input.state) {
    return {
      ok: false,
      pagePath,
      error: provider.explainError(new OAuthError("state_mismatch")),
    };
  }

  const pending = consumeOAuthState(input.state, input.now);
  if (!pending || pending.platform !== input.platform) {
    return {
      ok: false,
      pagePath,
      error: provider.explainError(new OAuthError("state_mismatch"), pending?.redirectUri),
    };
  }

  const credentials = readCredentials(input.platform);
  if (!credentials) {
    return {
      ok: false,
      pagePath,
      error: provider.explainError(new OAuthError("needs_credentials"), pending.redirectUri),
    };
  }

  try {
    const tokens = await provider.oauth.exchangeAuthorizationCode({
      credentials,
      redirectUri: pending.redirectUri,
      code: input.code,
      codeVerifier: pending.codeVerifier,
      fetchImpl: input.fetchImpl,
      now: input.now,
    });
    if (!pending.userId) {
      return {
        ok: false,
        pagePath,
        error: provider.explainError(new OAuthError("state_mismatch"), pending.redirectUri),
      };
    }
    saveTokens(pending.userId, input.platform, tokens);
    return { ok: true, pagePath };
  } catch (error) {
    return {
      ok: false,
      pagePath,
      error: provider.explainError(error, pending.redirectUri),
    };
  }
}

export async function disconnectPlatform(
  platform: string,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; error: UserFacingError }> {
  const provider = getReadyProvider(platform);
  if (!provider) {
    return {
      ok: false,
      error: {
        code: "unsupported_platform",
        titleAr: "هذه المنصة غير جاهزة",
        bodyAr: "لا يوجد اتصال يمكن قطعه.",
      },
    };
  }
  const tokens = readTokens(userId, platform);
  const credentials = readCredentials(platform) ?? {};
  if (tokens && provider.oauth.revokeToken) {
    try {
      await provider.oauth.revokeToken({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        credentials,
        fetchImpl,
      });
    } catch {
      // Clearing the local token is the part the user asked for.
    }
  }
  deleteTokens(userId, platform);
  return { ok: true };
}

export function redirectUriFor(request: { url: string; headers: Headers }, callbackPath: string): string {
  return `${resolvePublicOrigin(request)}${callbackPath}`;
}
