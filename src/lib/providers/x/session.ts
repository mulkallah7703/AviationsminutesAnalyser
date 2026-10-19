import { readCredentials, readTokens, saveTokens } from "@/lib/store";
import type { UserFacingError } from "@/lib/providers/types";
import type { AnalyticsPeriod } from "@/lib/providers/youtube/analytics";
import { fetchXAccount, XApiError, type XAccount } from "@/lib/providers/x/api";
import {
  buildXPeriodSummary,
  collectYearPosts,
  recentPosts,
  utcDayStamp,
  type XPeriodSummary,
} from "@/lib/providers/x/analytics";
import {
  listFollowerSnapshots,
  readPostCache,
  readPostCacheAt,
  recordFollowerSnapshot,
  writePostCache,
} from "@/lib/providers/x/cache";
import { explainXError } from "@/lib/providers/x/errors";
import { ensureFreshToken, OAuthError, refreshAccessToken } from "@/lib/providers/x/oauth";

export async function loadXAccount(options: {
  userId: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<XAccount> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const accessToken = await freshAccessToken({ userId: options.userId, fetchImpl, now });
  try {
    return await fetchXAccount(accessToken, fetchImpl);
  } catch (error) {
    if (error instanceof XApiError && error.status === 401) {
      const retried = await refreshAfterUnauthorized({ userId: options.userId, fetchImpl, now });
      if (retried) return fetchXAccount(retried, fetchImpl);
    }
    throw error;
  }
}

export async function loadXPeriodSummary(options: {
  userId: string;
  xUserId: string;
  followerCount: number | null;
  period: AnalyticsPeriod;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<{ status: "ok"; summary: XPeriodSummary } | { status: "error"; error: UserFacingError }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  try {
    if (options.xUserId && typeof options.followerCount === "number") {
      recordFollowerSnapshot(options.userId, options.xUserId, utcDayStamp(now), options.followerCount);
    }
    const cached = readPostCache(options.userId, options.xUserId, now.getTime());
    let fetched = cached;
    let rateLimited = false;
    if (!fetched) {
      try {
        const accessToken = await freshAccessToken({ userId: options.userId, fetchImpl, now: now.getTime() });
        fetched = await collectYearPosts({
          accessToken,
          userId: options.xUserId,
          fetchImpl,
          now,
        });
        writePostCache(options.userId, options.xUserId, fetched, now.getTime());
      } catch (error) {
        if (error instanceof XApiError && error.status === 429) {
          const stale = readPostCacheAt(options.userId, options.xUserId, now.getTime(), Number.MAX_SAFE_INTEGER);
          if (stale) {
            fetched = stale;
            rateLimited = true;
          } else {
            throw error;
          }
        } else if (error instanceof XApiError && error.status === 401) {
          const retried = await refreshAfterUnauthorized({ userId: options.userId, fetchImpl, now: now.getTime() });
          if (!retried) throw error;
          fetched = await collectYearPosts({ accessToken: retried, userId: options.xUserId, fetchImpl, now });
          writePostCache(options.userId, options.xUserId, fetched, now.getTime());
        } else {
          throw error;
        }
      }
    }
    if (!fetched) throw new OAuthError("unknown");
    return {
      status: "ok",
      summary: buildXPeriodSummary({
        posts: fetched.posts,
        snapshots: listFollowerSnapshots(options.userId, options.xUserId),
        period: options.period,
        now,
        currentFollowers: options.followerCount,
        incomplete: fetched.incomplete,
        rateLimited,
      }),
    };
  } catch (error) {
    return { status: "error", error: explainXError(error) };
  }
}

export function postsForAccount(summary: XPeriodSummary): XAccount["tweets"] {
  return recentPosts(summary.posts);
}

async function freshAccessToken(options: { userId: string; fetchImpl: typeof fetch; now: number }): Promise<string> {
  const credentials = readCredentials("x");
  if (!credentials?.clientId || !credentials.clientSecret) throw new OAuthError("needs_credentials");
  const stored = readTokens(options.userId, "x");
  if (!stored?.accessToken) throw new OAuthError("not_connected");
  const fresh = await ensureFreshToken({
    credentials,
    tokens: stored,
    fetchImpl: options.fetchImpl,
    now: options.now,
  });
  if (fresh.refreshed) saveTokens(options.userId, "x", fresh.tokens);
  return fresh.tokens.accessToken;
}

async function refreshAfterUnauthorized(options: {
  userId: string;
  fetchImpl: typeof fetch;
  now: number;
}): Promise<string | null> {
  const credentials = readCredentials("x");
  const stored = readTokens(options.userId, "x");
  if (!credentials?.clientId || !credentials.clientSecret || !stored?.refreshToken) return null;
  const refreshed = await refreshAccessToken({
    credentials,
    tokens: stored,
    fetchImpl: options.fetchImpl,
    now: options.now,
  });
  saveTokens(options.userId, "x", refreshed);
  return refreshed.accessToken;
}
