import { createHash, randomBytes } from "node:crypto";
import { OAuthError } from "@/lib/auth/oauth-error";
import type { TokenSet } from "@/lib/providers/types";
import { TIKTOK_SCOPE } from "@/lib/providers/tiktok/config";
import { isLoopbackHost, tiktokRedirectUri } from "@/lib/providers/tiktok/redirect";

export { OAuthError } from "@/lib/auth/oauth-error";

export const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";

export const REFRESH_SKEW_MS = 60_000;

type TikTokTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  refresh_expires_in?: unknown;
  open_id?: unknown;
  scope?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
  log_id?: unknown;
};

export function readTikTokClient(credentials: Record<string, string>): {
  clientKey: string;
  clientSecret: string;
} {
  const clientKey = credentials.clientKey?.trim() ?? "";
  const clientSecret = credentials.clientSecret?.trim() ?? "";
  if (!clientKey || !clientSecret) throw new OAuthError("needs_credentials");
  return { clientKey, clientSecret };
}

export function createCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** TikTok expects the SHA-256 digest as hex, not base64url. */
export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("hex");
}

export function usesPkce(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

export function resolveTikTokRedirectUri(input: {
  credentials: Record<string, string>;
  origin: string;
}): string {
  return tiktokRedirectUri({ origin: input.origin, publicBaseUrl: input.credentials.publicBaseUrl });
}

export function buildTikTokAuthorizationUrl(input: {
  clientKey: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
  scope?: string;
}): string {
  const url = new URL(TIKTOK_AUTH_URL);
  url.searchParams.set("client_key", input.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scope ?? TIKTOK_SCOPE);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", codeChallenge(input.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function postForm(
  url: string,
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<TikTokTokenResponse> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json().catch(() => null)) as TikTokTokenResponse | null;
  if (!response.ok || !data) {
    throw new OAuthError("token_http", `HTTP ${response.status}`);
  }
  if (typeof data.error === "string" && data.error && data.error !== "ok") {
    throw new OAuthError(data.error, typeof data.error_description === "string" ? data.error_description : "");
  }
  return data;
}

function toTokenSet(data: TikTokTokenResponse, previous: TokenSet | null, now: number): TokenSet {
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new OAuthError("token_missing");
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 0;
  const refreshExpiresIn = typeof data.refresh_expires_in === "number" ? data.refresh_expires_in : undefined;
  const refreshToken =
    typeof data.refresh_token === "string" && data.refresh_token
      ? data.refresh_token
      : (previous?.refreshToken ?? null);
  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: now + Math.max(0, expiresIn) * 1000,
    scope: typeof data.scope === "string" ? data.scope : (previous?.scope ?? TIKTOK_SCOPE),
    tokenType: typeof data.token_type === "string" ? data.token_type : "Bearer",
    openId: typeof data.open_id === "string" ? data.open_id : previous?.openId,
    refreshExpiresAt:
      refreshExpiresIn !== undefined ? now + Math.max(0, refreshExpiresIn) * 1000 : previous?.refreshExpiresAt,
  };
}

export async function exchangeAuthorizationCode(input: {
  credentials: Record<string, string>;
  redirectUri: string;
  code: string;
  codeVerifier?: string | null;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TokenSet> {
  const { clientKey, clientSecret } = readTikTokClient(input.credentials);
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
  });
  if (input.codeVerifier) body.set("code_verifier", input.codeVerifier);
  const data = await postForm(TIKTOK_TOKEN_URL, body, input.fetchImpl ?? fetch);
  return toTokenSet(data, null, input.now ?? Date.now());
}

export async function refreshAccessToken(input: {
  credentials: Record<string, string>;
  tokens: TokenSet;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TokenSet> {
  if (!input.tokens.refreshToken) throw new OAuthError("refresh_missing");
  const { clientKey, clientSecret } = readTikTokClient(input.credentials);
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: input.tokens.refreshToken,
  });
  const data = await postForm(TIKTOK_TOKEN_URL, body, input.fetchImpl ?? fetch);
  return toTokenSet(data, input.tokens, input.now ?? Date.now());
}

export async function revokeToken(input: {
  accessToken: string;
  refreshToken: string | null;
  credentials: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const token = input.accessToken || input.refreshToken;
  if (!token) return;
  const { clientKey, clientSecret } = readTikTokClient(input.credentials);
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    token,
  });
  const response = await (input.fetchImpl ?? fetch)(TIKTOK_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new OAuthError("revoke_failed", `HTTP ${response.status}`);
}

export async function ensureFreshToken(input: {
  credentials: Record<string, string>;
  tokens: TokenSet;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<{ tokens: TokenSet; refreshed: boolean }> {
  const now = input.now ?? Date.now();
  if (input.tokens.expiresAt - REFRESH_SKEW_MS > now) {
    return { tokens: input.tokens, refreshed: false };
  }
  const tokens = await refreshAccessToken({ ...input, now });
  return { tokens, refreshed: true };
}
