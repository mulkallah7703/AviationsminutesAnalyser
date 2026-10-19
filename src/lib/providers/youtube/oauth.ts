import { OAuthError } from "@/lib/auth/oauth-error";
import type { TokenSet } from "@/lib/providers/types";
import { YOUTUBE_SCOPES } from "@/lib/providers/youtube/config";

export { OAuthError } from "@/lib/auth/oauth-error";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export const REFRESH_SKEW_MS = 60_000;

type GoogleTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export function readGoogleClient(credentials: Record<string, string>): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = credentials.clientId?.trim() ?? "";
  const clientSecret = credentials.clientSecret?.trim() ?? "";
  if (!clientId || !clientSecret) {
    throw new OAuthError("needs_credentials");
  }
  return { clientId, clientSecret };
}

export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scope ?? YOUTUBE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  return url.toString();
}

function toTokenSet(
  json: GoogleTokenResponse,
  previousRefresh: string | null,
  now: number,
  requireRefresh: boolean,
): TokenSet {
  if (typeof json.access_token !== "string" || !json.access_token) {
    throw new OAuthError("invalid_response", "Missing access_token");
  }
  const refresh =
    typeof json.refresh_token === "string" && json.refresh_token
      ? json.refresh_token
      : previousRefresh;
  if (requireRefresh && !refresh) {
    throw new OAuthError(
      "missing_refresh_token",
      "Google did not return a refresh token",
    );
  }
  const expiresIn =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? json.expires_in
      : 3600;
  return {
    accessToken: json.access_token,
    refreshToken: refresh,
    expiresAt: now + expiresIn * 1000,
    scope: typeof json.scope === "string" ? json.scope : YOUTUBE_SCOPES,
    tokenType: typeof json.token_type === "string" ? json.token_type : "Bearer",
  };
}

async function requestToken(
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<GoogleTokenResponse> {
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new OAuthError("network", "Token endpoint unreachable");
  }

  const json = (await response.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!response.ok || !json) {
    const code = typeof json?.error === "string" ? json.error : "token_request_failed";
    const description = typeof json?.error_description === "string" ? json.error_description : "";
    throw new OAuthError(code, description);
  }
  return json;
}

export async function exchangeAuthorizationCode(input: {
  credentials: Record<string, string>;
  redirectUri: string;
  code: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TokenSet> {
  const { clientId, clientSecret } = readGoogleClient(input.credentials);
  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const json = await requestToken(body, input.fetchImpl ?? fetch);
  return toTokenSet(json, null, input.now ?? Date.now(), true);
}

export async function refreshAccessToken(input: {
  credentials: Record<string, string>;
  tokens: TokenSet;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TokenSet> {
  if (!input.tokens.refreshToken) {
    throw new OAuthError("missing_refresh_token");
  }
  const { clientId, clientSecret } = readGoogleClient(input.credentials);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: input.tokens.refreshToken,
    grant_type: "refresh_token",
  });
  const json = await requestToken(body, input.fetchImpl ?? fetch);
  return toTokenSet(json, input.tokens.refreshToken, input.now ?? Date.now(), true);
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

export async function revokeToken(input: {
  accessToken: string;
  refreshToken: string | null;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const token = input.refreshToken || input.accessToken;
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({ token });
  await fetchImpl(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
}
