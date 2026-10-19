import { OAuthError } from "@/lib/auth/oauth-error";
import { LINKEDIN_SCOPE } from "@/lib/providers/linkedin/config";
import { linkedInRedirectAllowed, resolveLinkedInRedirectUri } from "@/lib/providers/linkedin/redirect";
import type { TokenSet } from "@/lib/providers/types";

export { OAuthError } from "@/lib/auth/oauth-error";

export const LINKEDIN_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_REVOKE_URL = "https://www.linkedin.com/oauth/v2/revoke";

/** Documented access-token lifetime when the token response omits expires_in. */
export const DEFAULT_ACCESS_TTL_SEC = 60 * 24 * 60 * 60;

export const REFRESH_SKEW_MS = 60_000;

type LinkedInTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  refresh_token_expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export function readLinkedInClient(credentials: Record<string, string>): { clientId: string; clientSecret: string } {
  const clientId = credentials.clientId?.trim() ?? "";
  const clientSecret = credentials.clientSecret?.trim() ?? "";
  if (!clientId || !clientSecret) throw new OAuthError("needs_credentials");
  return { clientId, clientSecret };
}

export function usesPkce(): boolean {
  return false;
}

export function resolveLinkedInRedirect(input: { credentials: Record<string, string>; origin: string }): string {
  return resolveLinkedInRedirectUri(input);
}

export function buildLinkedInAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  if (!linkedInRedirectAllowed(input.redirectUri)) throw new OAuthError("redirect_uri_mismatch", input.redirectUri);
  const url = new URL(LINKEDIN_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", input.scope ?? LINKEDIN_SCOPE);
  return url.toString();
}

async function postToken(
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<LinkedInTokenResponse> {
  const response = await fetchImpl(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json().catch(() => null)) as LinkedInTokenResponse | null;
  if (!response.ok || !data) {
    const description = data && typeof data.error_description === "string" ? data.error_description : `HTTP ${response.status}`;
    const code = data && typeof data.error === "string" && data.error ? data.error : "token_http";
    throw new OAuthError(code, description);
  }
  if (typeof data.error === "string" && data.error) {
    throw new OAuthError(data.error, typeof data.error_description === "string" ? data.error_description : "");
  }
  return data;
}

function toTokenSet(data: LinkedInTokenResponse, previous: TokenSet | null, now: number): TokenSet {
  if (typeof data.access_token !== "string" || !data.access_token) throw new OAuthError("token_missing");
  const expiresIn =
    typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : DEFAULT_ACCESS_TTL_SEC;
  const refreshToken =
    typeof data.refresh_token === "string" && data.refresh_token ? data.refresh_token : (previous?.refreshToken ?? null);
  const refreshExpiresIn = typeof data.refresh_token_expires_in === "number" ? data.refresh_token_expires_in : null;
  const refreshExpiresAt =
    refreshToken && refreshExpiresIn !== null
      ? now + Math.max(0, refreshExpiresIn) * 1000
      : refreshToken
        ? previous?.refreshExpiresAt
        : undefined;
  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: now + expiresIn * 1000,
    scope: typeof data.scope === "string" && data.scope ? data.scope : (previous?.scope ?? LINKEDIN_SCOPE),
    tokenType: typeof data.token_type === "string" && data.token_type ? data.token_type : "Bearer",
    refreshExpiresAt,
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
  const { clientId, clientSecret } = readLinkedInClient(input.credentials);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const data = await postToken(body, input.fetchImpl ?? fetch);
  return toTokenSet(data, null, input.now ?? Date.now());
}

export async function refreshAccessToken(input: {
  credentials: Record<string, string>;
  tokens: TokenSet;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TokenSet> {
  if (!input.tokens.refreshToken) throw new OAuthError("refresh_missing");
  const now = input.now ?? Date.now();
  if (input.tokens.refreshExpiresAt && input.tokens.refreshExpiresAt <= now) {
    throw new OAuthError("refresh_expired");
  }
  const { clientId, clientSecret } = readLinkedInClient(input.credentials);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.tokens.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const data = await postToken(body, input.fetchImpl ?? fetch);
  return toTokenSet(data, input.tokens, now);
}

export async function revokeToken(input: {
  accessToken: string;
  refreshToken: string | null;
  credentials: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const token = input.accessToken || input.refreshToken;
  if (!token) return;
  const { clientId, clientSecret } = readLinkedInClient(input.credentials);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token,
  });
  const response = await (input.fetchImpl ?? fetch)(LINKEDIN_REVOKE_URL, {
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
