import { readCredentials, readTokens, saveTokens } from "@/lib/store";
import { fetchLinkedInProfile, LinkedInApiError, type LinkedInProfile } from "@/lib/providers/linkedin/api";
import { ensureFreshToken, OAuthError, refreshAccessToken } from "@/lib/providers/linkedin/oauth";

export async function loadLinkedInProfile(options: {
  userId: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<LinkedInProfile> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const accessToken = await freshAccessToken({ userId: options.userId, fetchImpl, now });
  try {
    return await fetchLinkedInProfile(accessToken, fetchImpl);
  } catch (error) {
    if (error instanceof LinkedInApiError && error.status === 401) {
      const retried = await refreshAfterUnauthorized({ userId: options.userId, fetchImpl, now });
      if (retried) return fetchLinkedInProfile(retried, fetchImpl);
      throw new OAuthError("refresh_missing");
    }
    throw error;
  }
}

async function freshAccessToken(options: { userId: string; fetchImpl: typeof fetch; now: number }): Promise<string> {
  const credentials = readCredentials("linkedin");
  if (!credentials?.clientId || !credentials.clientSecret) throw new OAuthError("needs_credentials");
  const stored = readTokens(options.userId, "linkedin");
  if (!stored?.accessToken) throw new OAuthError("not_connected");
  const fresh = await ensureFreshToken({
    credentials,
    tokens: stored,
    fetchImpl: options.fetchImpl,
    now: options.now,
  });
  if (fresh.refreshed) saveTokens(options.userId, "linkedin", fresh.tokens);
  return fresh.tokens.accessToken;
}

async function refreshAfterUnauthorized(options: {
  userId: string;
  fetchImpl: typeof fetch;
  now: number;
}): Promise<string | null> {
  const credentials = readCredentials("linkedin");
  const stored = readTokens(options.userId, "linkedin");
  if (!credentials?.clientId || !credentials.clientSecret || !stored?.refreshToken) return null;
  const refreshed = await refreshAccessToken({
    credentials,
    tokens: stored,
    fetchImpl: options.fetchImpl,
    now: options.now,
  });
  saveTokens(options.userId, "linkedin", refreshed);
  return refreshed.accessToken;
}
