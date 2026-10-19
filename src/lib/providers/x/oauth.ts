import { createHash, randomBytes } from "node:crypto";
import { OAuthError } from "@/lib/auth/oauth-error";
import type { TokenSet } from "@/lib/providers/types";
import { X_SCOPE } from "@/lib/providers/x/config";
import { resolveXRedirectUri, xRedirectAllowed } from "@/lib/providers/x/redirect";

export { OAuthError } from "@/lib/auth/oauth-error";

export const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_REVOKE_URL = "https://api.x.com/2/oauth2/revoke";

export const REFRESH_SKEW_MS = 60_000;

type XTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export function readXClient(credentials: Record<string, string>): { clientId: string; clientSecret: string } {
  const clientId = credentials.clientId?.trim() ?? "";
  const clientSecret = credentials.clientSecret?.trim() ?? "";
  if (!clientId || !clientSecret) throw new OAuthError("needs_credentials");
  return { clientId, clientSecret };
}

export function createCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** X expects the SHA-256 digest as base64url, not hex. */
export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function usesPkce(): boolean {
  return true;
}

export function resolveXRedirect(input: { credentials: Record<string, string>; origin: string }): string {
  return resolveXRedirectUri(input);
}

export function buildXAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
  scope?: string;
}): string {
  if (!xRedirectAllowed(input.redirectUri)) throw new OAuthError("redirect_uri_mismatch", input.redirectUri);
  const url = new URL(X_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scope ?? X_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", codeChallenge(input.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function postToken(body: URLSearchParams, clientId: string, clientSecret: string, fetchImpl: typeof fetch): Promise<XTokenResponse> {
  const response = await fetchImpl(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await response.json().catch(() => null)) as XTokenResponse | null;
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

function toTokenSet(data: XTokenResponse, previous: TokenSet | null, now: number): TokenSet {
  if (typeof data.access_token !== "string" || !data.access_token) throw new OAuthError("token_missing");
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 0;
  const refreshToken =
    typeof data.refresh_token === "string" && data.refresh_token ? data.refresh_token : (previous?.refreshToken ?? null);
  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: now + Math.max(0, expiresIn) * 1000,
    scope: typeof data.scope === "string" && data.scope ? data.scope : (previous?.scope ?? X_SCOPE),
    tokenType: typeof data.token_type === "string" && data.token_type ? data.token_type : "bearer",
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
  const { clientId, clientSecret } = readXClient(input.credentials);
  if (!input.codeVerifier) throw new OAuthError("pkce_unavailable");
  const body = new URLSearchParams({
    code: input.code,
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const data = await postToken(body, clientId, clientSecret, input.fetchImpl ?? fetch);
  return toTokenSet(data, null, input.now ?? Date.now());
}

export async function refreshAccessToken(input: {
  credentials: Record<string, string>;
  tokens: TokenSet;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TokenSet> {
  if (!input.tokens.refreshToken) throw new OAuthError("refresh_missing");
  const { clientId, clientSecret } = readXClient(input.credentials);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.tokens.refreshToken,
    client_id: clientId,
  });
  const data = await postToken(body, clientId, clientSecret, input.fetchImpl ?? fetch);
  return toTokenSet(data, input.tokens, input.now ?? Date.now());
}

export async function revokeToken(input: {
  accessToken: string;
  refreshToken: string | null;
  credentials: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const token = input.refreshToken || input.accessToken;
  if (!token) return;
  const { clientId, clientSecret } = readXClient(input.credentials);
  const body = new URLSearchParams({
    token,
    token_type_hint: input.refreshToken ? "refresh_token" : "access_token",
    client_id: clientId,
  });
  const response = await (input.fetchImpl ?? fetch)(X_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
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
