import { OAuthError } from "@/lib/auth/oauth-error";
import { fetchAssignedInstagramAccounts, InstagramApiError } from "@/lib/providers/instagram/api";
import {
  FACEBOOK_GRAPH_BASE,
  INSTAGRAM_API_VERSION,
  INSTAGRAM_SCOPE,
  UNIFIED_TOKEN_TYPE,
} from "@/lib/providers/instagram/config";
import { instagramRedirectAllowed, resolveInstagramRedirectUri } from "@/lib/providers/instagram/redirect";
import type { TokenSet } from "@/lib/providers/types";

export { OAuthError } from "@/lib/auth/oauth-error";

export const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const INSTAGRAM_EXCHANGE_URL = "https://graph.instagram.com/access_token";
export const INSTAGRAM_REFRESH_URL = "https://graph.instagram.com/refresh_access_token";

/** Unified login: Facebook Login for Business dialog and code exchange (Meta app ID and secret). */
export const FACEBOOK_DIALOG_URL = `https://www.facebook.com/${INSTAGRAM_API_VERSION}/dialog/oauth`;
export const FACEBOOK_TOKEN_URL = `${FACEBOOK_GRAPH_BASE}/oauth/access_token`;
export const FACEBOOK_DEBUG_TOKEN_URL = `${FACEBOOK_GRAPH_BASE}/debug_token`;

/** A System-user token configured to never expire has no expires_in. Treat it as valid for 50 years. */
const NEVER_EXPIRES_MS = 50 * 365 * 24 * 60 * 60 * 1000;

export function isUnifiedSetup(credentials: Record<string, string>): boolean {
  return Boolean(credentials.configId?.trim());
}

export function isUnifiedToken(tokens: Pick<TokenSet, "tokenType">): boolean {
  return tokens.tokenType === UNIFIED_TOKEN_TYPE;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Documented long-lived token lifetime when the response omits expires_in. */
export const LONG_LIVED_TTL_SEC = 60 * 24 * 60 * 60;

/**
 * A long-lived token can be refreshed once it is at least 24 hours old. Refresh as soon as that is true,
 * so an account opened at least once every 60 days never expires.
 */
export const REFRESH_WHEN_REMAINING_MS = LONG_LIVED_TTL_SEC * 1000 - DAY_MS - 60 * 60 * 1000;

export function readInstagramClient(credentials: Record<string, string>): { clientId: string; clientSecret: string } {
  const clientId = credentials.clientId?.trim() ?? "";
  const clientSecret = credentials.clientSecret?.trim() ?? "";
  if (!clientId || !clientSecret) throw new OAuthError("needs_credentials");
  return { clientId, clientSecret };
}

export function usesPkce(): boolean {
  return false;
}

export function resolveInstagramRedirect(input: { credentials: Record<string, string>; origin: string }): string {
  return resolveInstagramRedirectUri(input);
}

export function buildInstagramAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
  configId?: string;
  loginDialog?: string;
}): string {
  if (!instagramRedirectAllowed(input.redirectUri)) throw new OAuthError("redirect_uri_mismatch", input.redirectUri);
  const configId = input.configId?.trim();
  if (configId) {
    // Unified login: config_id replaces scope. prompt=login always offers both Instagram and Facebook sign-in.
    const base = input.loginDialog?.trim().toLowerCase() === "instagram" ? INSTAGRAM_AUTHORIZE_URL : FACEBOOK_DIALOG_URL;
    const unified = new URL(base);
    unified.searchParams.set("client_id", input.clientId);
    unified.searchParams.set("config_id", configId);
    unified.searchParams.set("redirect_uri", input.redirectUri);
    unified.searchParams.set("response_type", "code");
    unified.searchParams.set("state", input.state);
    unified.searchParams.set("prompt", "login");
    return unified.toString();
  }
  const url = new URL(INSTAGRAM_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scope ?? INSTAGRAM_SCOPE);
  url.searchParams.set("state", input.state);
  return url.toString();
}

/** Instagram appends `#_` to the redirect. Browsers drop fragments, but strip it if it ever arrives. */
export function cleanAuthorizationCode(code: string): string {
  return code.trim().replace(/#_?(=_)?$/, "");
}

type ShortLived = { accessToken: string; userId: string; permissions: string };

/** Ids can exceed 2^53, so read user_id from the raw text instead of the parsed number. */
export function parseShortLivedToken(raw: string): ShortLived | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  const root = asObject(body);
  const entry = asObject(Array.isArray(root?.data) ? root?.data[0] : root);
  const accessToken = typeof entry?.access_token === "string" ? entry.access_token : "";
  if (!accessToken) return null;
  const idMatch = /"user_id"\s*:\s*"?(\d+)"?/.exec(raw);
  const permissions = Array.isArray(entry?.permissions)
    ? entry.permissions.filter((item): item is string => typeof item === "string").join(",")
    : typeof entry?.permissions === "string"
      ? entry.permissions
      : "";
  return { accessToken, userId: idMatch?.[1] ?? "", permissions };
}

export function oauthErrorFrom(status: number, raw: string): OAuthError {
  let body: Record<string, unknown> | null = null;
  try {
    body = asObject(JSON.parse(raw));
  } catch {
    body = null;
  }
  const nested = asObject(body?.error);
  const message =
    text(body?.error_message) || text(nested?.message) || text(body?.error_description) || `HTTP ${status}`;
  const lower = message.toLowerCase();
  let code = text(body?.error) || text(nested?.type) || text(body?.error_type) || "token_http";
  if (lower.includes("invalid platform app") || lower.includes("invalid client") || lower.includes("client secret")) {
    code = "invalid_client";
  } else if (lower.includes("redirect")) {
    code = "redirect_uri_mismatch";
  } else if (
    lower.includes("verification code") ||
    (lower.includes("code") && (lower.includes("matching") || lower.includes("expired") || lower.includes("used")))
  ) {
    code = "invalid_grant";
  } else if (nested?.code === 190 || lower.includes("session has expired") || lower.includes("access token")) {
    code = "refresh_expired";
  }
  return new OAuthError(code, message);
}

async function readText(response: Response): Promise<string> {
  return response.text().catch(() => "");
}

export async function exchangeAuthorizationCode(input: {
  credentials: Record<string, string>;
  redirectUri: string;
  code: string;
  codeVerifier?: string | null;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TokenSet> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? Date.now();
  const { clientId, clientSecret } = readInstagramClient(input.credentials);
  if (isUnifiedSetup(input.credentials)) {
    return exchangeUnifiedCode({ clientId, clientSecret, redirectUri: input.redirectUri, code: input.code, fetchImpl, now });
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    code: cleanAuthorizationCode(input.code),
  });
  const response = await fetchImpl(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const raw = await readText(response);
  if (!response.ok) throw oauthErrorFrom(response.status, raw);
  const short = parseShortLivedToken(raw);
  if (!short) throw new OAuthError("token_missing");

  const exchange = new URL(INSTAGRAM_EXCHANGE_URL);
  exchange.searchParams.set("grant_type", "ig_exchange_token");
  exchange.searchParams.set("client_secret", clientSecret);
  exchange.searchParams.set("access_token", short.accessToken);
  const longResponse = await fetchImpl(exchange.toString());
  const longRaw = await readText(longResponse);
  if (!longResponse.ok) throw oauthErrorFrom(longResponse.status, longRaw);
  return toTokenSet(longRaw, { scope: short.permissions || INSTAGRAM_SCOPE, openId: short.userId }, now);
}

export async function refreshAccessToken(input: {
  credentials: Record<string, string>;
  tokens: TokenSet;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TokenSet> {
  const now = input.now ?? Date.now();
  if (!input.tokens.accessToken) throw new OAuthError("refresh_missing");
  if (input.tokens.expiresAt <= now) throw new OAuthError("refresh_expired");
  // System-user tokens are not refreshed with ig_refresh_token. They last as the configuration says.
  if (isUnifiedToken(input.tokens)) return input.tokens;
  const url = new URL(INSTAGRAM_REFRESH_URL);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", input.tokens.accessToken);
  const response = await (input.fetchImpl ?? fetch)(url.toString());
  const raw = await readText(response);
  if (!response.ok) throw oauthErrorFrom(response.status, raw);
  return toTokenSet(raw, { scope: input.tokens.scope, openId: input.tokens.openId }, now);
}

function toTokenSet(raw: string, previous: { scope: string; openId?: string }, now: number): TokenSet {
  let body: Record<string, unknown> | null = null;
  try {
    body = asObject(JSON.parse(raw));
  } catch {
    body = null;
  }
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  if (!accessToken) throw new OAuthError("token_missing");
  const expiresIn = typeof body?.expires_in === "number" && body.expires_in > 0 ? body.expires_in : LONG_LIVED_TTL_SEC;
  return {
    accessToken,
    refreshToken: null,
    expiresAt: now + expiresIn * 1000,
    scope: previous.scope,
    tokenType: typeof body?.token_type === "string" ? body.token_type : "bearer",
    openId: previous.openId,
  };
}

/**
 * Refreshes once the token is over a day old. A failed refresh keeps the current token while it is valid.
 */
export async function ensureFreshToken(input: {
  credentials: Record<string, string>;
  tokens: TokenSet;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<{ tokens: TokenSet; refreshed: boolean }> {
  const now = input.now ?? Date.now();
  if (input.tokens.expiresAt <= now) throw new OAuthError("refresh_expired");
  if (isUnifiedToken(input.tokens) || input.tokens.expiresAt - now > REFRESH_WHEN_REMAINING_MS) {
    return { tokens: input.tokens, refreshed: false };
  }
  try {
    const tokens = await refreshAccessToken({ ...input, now });
    return { tokens, refreshed: true };
  } catch {
    return { tokens: input.tokens, refreshed: false };
  }
}

/**
 * Unified login: GET graph.facebook.com/oauth/access_token with the Meta app ID and secret, then read the
 * shared Instagram account from /me/assigned_instagram_accounts. The token is a Business Integration
 * System User access token.
 */
async function exchangeUnifiedCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  fetchImpl: typeof fetch;
  now: number;
}): Promise<TokenSet> {
  const url = new URL(FACEBOOK_TOKEN_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("client_secret", input.clientSecret);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", cleanAuthorizationCode(input.code));
  const response = await input.fetchImpl(url.toString());
  const raw = await readText(response);
  if (!response.ok) throw oauthErrorFrom(response.status, raw);
  let body: Record<string, unknown> | null = null;
  try {
    body = asObject(JSON.parse(raw));
  } catch {
    body = null;
  }
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  if (!accessToken) throw new OAuthError("token_missing");
  const expiresIn = typeof body?.expires_in === "number" && body.expires_in > 0 ? body.expires_in : null;
  const ctx = { accessToken, unified: true, appSecret: input.clientSecret };

  let accounts: { id: string; username: string }[];
  try {
    accounts = await fetchAssignedInstagramAccounts(ctx, input.fetchImpl);
  } catch (error) {
    if (error instanceof InstagramApiError && error.permissionMissing) throw new OAuthError("permission", error.message);
    throw new OAuthError("token_http", error instanceof Error ? error.message : "");
  }
  const account = accounts[0];
  if (!account) throw new OAuthError("no_instagram_account");

  return {
    accessToken,
    refreshToken: null,
    expiresAt: input.now + (expiresIn ? expiresIn * 1000 : NEVER_EXPIRES_MS),
    scope: await grantedScopes(accessToken, input),
    tokenType: UNIFIED_TOKEN_TYPE,
    openId: account.id,
  };
}

/** Best effort: the permissions on the token, from debug_token with the app access token. Empty when unknown. */
async function grantedScopes(
  accessToken: string,
  input: { clientId: string; clientSecret: string; fetchImpl: typeof fetch },
): Promise<string> {
  try {
    const url = new URL(FACEBOOK_DEBUG_TOKEN_URL);
    url.searchParams.set("input_token", accessToken);
    url.searchParams.set("access_token", `${input.clientId}|${input.clientSecret}`);
    const response = await input.fetchImpl(url.toString());
    if (!response.ok) return "";
    const data = asObject(asObject(JSON.parse(await readText(response)))?.data);
    const scopes = Array.isArray(data?.scopes) ? data.scopes.filter((item): item is string => typeof item === "string") : [];
    return scopes.join(",");
  } catch {
    return "";
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}
