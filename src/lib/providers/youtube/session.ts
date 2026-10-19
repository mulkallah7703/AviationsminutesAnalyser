import { readCredentials, readTokens, saveTokens } from "@/lib/store";
import {
  fetchYouTubeAnalytics,
  hasAnalyticsScope,
  type AnalyticsDay,
  type AnalyticsPeriod,
  type AnalyticsSummary,
  type PeriodRange,
} from "@/lib/providers/youtube/analytics";
import { fetchYouTubeAccount, YouTubeApiError, type YouTubeAccount } from "@/lib/providers/youtube/api";
import { ensureFreshToken, OAuthError, refreshAccessToken } from "@/lib/providers/youtube/oauth";
import type { UserFacingError } from "@/lib/providers/types";
import { explainYouTubeError } from "@/lib/providers/youtube/errors";

export type YouTubeAnalyticsResult =
  | { status: "ok"; range: PeriodRange; days: AnalyticsDay[]; summary: AnalyticsSummary }
  | { status: "needs_scope" }
  | { status: "error"; error: UserFacingError };

export async function loadYouTubeAccount(options: {
  userId: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<YouTubeAccount> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const credentials = readCredentials("youtube");
  if (!credentials?.clientId || !credentials.clientSecret) {
    throw new OAuthError("needs_credentials");
  }
  const stored = readTokens(options.userId, "youtube");
  if (!stored?.accessToken) {
    throw new OAuthError("not_connected");
  }

  const fresh = await ensureFreshToken({ credentials, tokens: stored, fetchImpl, now });
  if (fresh.refreshed) saveTokens(options.userId, "youtube", fresh.tokens);

  try {
    return await fetchYouTubeAccount(fresh.tokens.accessToken, fetchImpl);
  } catch (error) {
    if (
      error instanceof YouTubeApiError &&
      error.status === 401 &&
      !fresh.refreshed &&
      fresh.tokens.refreshToken
    ) {
      const refreshed = await refreshAccessToken({
        credentials,
        tokens: fresh.tokens,
        fetchImpl,
        now,
      });
      saveTokens(options.userId, "youtube", refreshed);
      return fetchYouTubeAccount(refreshed.accessToken, fetchImpl);
    }
    throw error;
  }
}

export async function loadYouTubeAnalytics(options: {
  userId: string;
  period: AnalyticsPeriod;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<YouTubeAnalyticsResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const credentials = readCredentials("youtube");
  if (!credentials?.clientId || !credentials.clientSecret) {
    return { status: "error", error: explainYouTubeError(new OAuthError("needs_credentials")) };
  }
  const stored = readTokens(options.userId, "youtube");
  if (!stored?.accessToken) {
    return { status: "error", error: explainYouTubeError(new OAuthError("not_connected")) };
  }
  if (!hasAnalyticsScope(stored.scope)) return { status: "needs_scope" };

  try {
    const fresh = await ensureFreshToken({ credentials, tokens: stored, fetchImpl, now });
    if (fresh.refreshed) saveTokens(options.userId, "youtube", fresh.tokens);
    const report = await fetchYouTubeAnalytics({
      accessToken: fresh.tokens.accessToken,
      period: options.period,
      fetchImpl,
      now: new Date(now),
    });
    return { status: "ok", ...report };
  } catch (error) {
    if (
      error instanceof YouTubeApiError &&
      error.status === 401 &&
      stored.refreshToken
    ) {
      try {
        const refreshed = await refreshAccessToken({ credentials, tokens: stored, fetchImpl, now });
        saveTokens(options.userId, "youtube", refreshed);
        if (!hasAnalyticsScope(refreshed.scope)) return { status: "needs_scope" };
        const report = await fetchYouTubeAnalytics({
          accessToken: refreshed.accessToken,
          period: options.period,
          fetchImpl,
          now: new Date(now),
        });
        return { status: "ok", ...report };
      } catch (retryError) {
        return { status: "error", error: explainYouTubeError(retryError) };
      }
    }
    return { status: "error", error: explainYouTubeError(error) };
  }
}
