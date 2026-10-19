import { readCredentials, readTokens, saveTokens } from "@/lib/store";
import type { UserFacingError } from "@/lib/providers/types";
import type { AnalyticsPeriod } from "@/lib/providers/youtube/analytics";
import { fetchTikTokAccount, TikTokApiError, type TikTokAccount } from "@/lib/providers/tiktok/api";
import {
  buildTikTokPeriodSummary,
  collectYearVideoStats,
  utcDayStamp,
  type TikTokPeriodSummary,
} from "@/lib/providers/tiktok/analytics";
import { listFollowerSnapshots, readVideoCache, recordFollowerSnapshot, writeVideoCache } from "@/lib/providers/tiktok/cache";
import { explainTikTokError } from "@/lib/providers/tiktok/errors";
import { ensureFreshToken, OAuthError, refreshAccessToken } from "@/lib/providers/tiktok/oauth";

export async function loadTikTokAccount(options: {
  userId: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<TikTokAccount> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const credentials = readCredentials("tiktok");
  if (!credentials?.clientKey || !credentials.clientSecret) {
    throw new OAuthError("needs_credentials");
  }
  const stored = readTokens(options.userId, "tiktok");
  if (!stored?.accessToken) throw new OAuthError("not_connected");

  const fresh = await ensureFreshToken({ credentials, tokens: stored, fetchImpl, now });
  if (fresh.refreshed) saveTokens(options.userId, "tiktok", fresh.tokens);

  try {
    return await fetchTikTokAccount(fresh.tokens.accessToken, fetchImpl);
  } catch (error) {
    if (
      error instanceof TikTokApiError &&
      error.status === 401 &&
      !fresh.refreshed &&
      fresh.tokens.refreshToken
    ) {
      const refreshed = await refreshAccessToken({ credentials, tokens: fresh.tokens, fetchImpl, now });
      saveTokens(options.userId, "tiktok", refreshed);
      return fetchTikTokAccount(refreshed.accessToken, fetchImpl);
    }
    throw error;
  }
}

export async function loadTikTokPeriodSummary(options: {
  userId: string;
  openId: string;
  followerCount: number | null;
  period: AnalyticsPeriod;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<{ status: "ok"; summary: TikTokPeriodSummary } | { status: "error"; error: UserFacingError }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  try {
    if (options.openId && typeof options.followerCount === "number") {
      recordFollowerSnapshot(options.userId, options.openId, utcDayStamp(now), options.followerCount);
    }
    const cached = readVideoCache(options.userId, options.openId, now.getTime());
    const fetched =
      cached ??
      (await fetchYearVideos({
        userId: options.userId,
        openId: options.openId,
        fetchImpl,
        now,
      }));
    return {
      status: "ok",
      summary: buildTikTokPeriodSummary({
        videos: fetched.videos,
        snapshots: listFollowerSnapshots(options.userId, options.openId),
        period: options.period,
        now,
        currentFollowers: options.followerCount,
        incomplete: fetched.incomplete,
      }),
    };
  } catch (error) {
    return { status: "error", error: explainTikTokError(error) };
  }
}

async function fetchYearVideos(options: {
  userId: string;
  openId: string;
  fetchImpl: typeof fetch;
  now: Date;
}) {
  const credentials = readCredentials("tiktok");
  if (!credentials?.clientKey || !credentials.clientSecret) throw new OAuthError("needs_credentials");
  const stored = readTokens(options.userId, "tiktok");
  if (!stored?.accessToken) throw new OAuthError("not_connected");
  const fresh = await ensureFreshToken({
    credentials,
    tokens: stored,
    fetchImpl: options.fetchImpl,
    now: options.now.getTime(),
  });
  if (fresh.refreshed) saveTokens(options.userId, "tiktok", fresh.tokens);
  try {
    const fetched = await collectYearVideoStats({
      accessToken: fresh.tokens.accessToken,
      fetchImpl: options.fetchImpl,
      now: options.now,
    });
    writeVideoCache(options.userId, options.openId, fetched, options.now.getTime());
    return fetched;
  } catch (error) {
    if (
      error instanceof TikTokApiError &&
      error.status === 401 &&
      !fresh.refreshed &&
      fresh.tokens.refreshToken
    ) {
      const refreshed = await refreshAccessToken({
        credentials,
        tokens: fresh.tokens,
        fetchImpl: options.fetchImpl,
        now: options.now.getTime(),
      });
      saveTokens(options.userId, "tiktok", refreshed);
      const fetched = await collectYearVideoStats({
        accessToken: refreshed.accessToken,
        fetchImpl: options.fetchImpl,
        now: options.now,
      });
      writeVideoCache(options.userId, options.openId, fetched, options.now.getTime());
      return fetched;
    }
    throw error;
  }
}
