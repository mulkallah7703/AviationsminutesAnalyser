import { readCredentials, readTokens, saveTokens } from "@/lib/store";
import type { TokenSet, UserFacingError } from "@/lib/providers/types";
import { periodRange, type AnalyticsPeriod } from "@/lib/providers/youtube/analytics";
import { fetchInstagramAccount, InstagramApiError, type GraphContext, type InstagramAccount } from "@/lib/providers/instagram/api";
import {
  buildInstagramPeriodSummary,
  classifyInsightError,
  collectYearMedia,
  fetchAccountInsights,
  utcDay,
  type AccountInsightsFetch,
  type InsightIssue,
  type InstagramPeriodSummary,
  type MediaFetch,
} from "@/lib/providers/instagram/analytics";
import {
  listInstagramFollowers,
  readInstagramCache,
  recordInstagramFollowers,
  writeInstagramCache,
} from "@/lib/providers/instagram/cache";
import { INSTAGRAM_INSIGHTS_SCOPE, UNIFIED_INSIGHTS_SCOPE } from "@/lib/providers/instagram/config";
import { explainInstagramError } from "@/lib/providers/instagram/errors";
import { ensureFreshToken, isUnifiedToken, OAuthError } from "@/lib/providers/instagram/oauth";

async function freshContext(options: { userId: string; fetchImpl: typeof fetch; now: number }): Promise<{
  tokens: TokenSet;
  ctx: GraphContext;
}> {
  const credentials = readCredentials("instagram");
  if (!credentials?.clientId || !credentials.clientSecret) throw new OAuthError("needs_credentials");
  const stored = readTokens(options.userId, "instagram");
  if (!stored?.accessToken) throw new OAuthError("not_connected");
  const fresh = await ensureFreshToken({
    credentials,
    tokens: stored,
    fetchImpl: options.fetchImpl,
    now: options.now,
  });
  if (fresh.refreshed) saveTokens(options.userId, "instagram", fresh.tokens);
  const unified = isUnifiedToken(fresh.tokens);
  if (unified && !fresh.tokens.openId) throw new OAuthError("no_instagram_account");
  return {
    tokens: fresh.tokens,
    ctx: {
      accessToken: fresh.tokens.accessToken,
      unified,
      igUserId: fresh.tokens.openId,
      appSecret: unified ? credentials.clientSecret : undefined,
    },
  };
}

export function hasInsightsScope(scope: string | null | undefined): boolean {
  const granted = (scope ?? "").split(/[\s,]+/);
  return granted.includes(INSTAGRAM_INSIGHTS_SCOPE) || granted.includes(UNIFIED_INSIGHTS_SCOPE);
}

export async function loadInstagramAccount(options: {
  userId: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<InstagramAccount> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const { ctx } = await freshContext({ userId: options.userId, fetchImpl, now });
  try {
    return await fetchInstagramAccount(ctx, fetchImpl);
  } catch (error) {
    if (error instanceof InstagramApiError && error.tokenInvalid) throw new OAuthError("token_invalid", error.message);
    throw error;
  }
}

export async function loadInstagramPeriodSummary(options: {
  userId: string;
  account: InstagramAccount;
  period: AnalyticsPeriod;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<{ status: "ok"; summary: InstagramPeriodSummary } | { status: "error"; error: UserFacingError }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const igUserId = options.account.userId || options.account.id;
  try {
    if (typeof options.account.followersCount === "number") {
      recordInstagramFollowers(options.userId, igUserId, utcDay(now), options.account.followersCount);
    }
    const { tokens, ctx } = await freshContext({ userId: options.userId, fetchImpl, now: now.getTime() });
    const scopeKnown = Boolean(tokens.scope);
    const insightsGranted = !scopeKnown || hasInsightsScope(tokens.scope);

    let media = readInstagramCache<MediaFetch>(options.userId, igUserId, "media", now.getTime());
    if (!media) {
      media = await collectYearMedia({ ctx, now, fetchImpl });
      writeInstagramCache(options.userId, igUserId, "media", media, now.getTime());
    }

    let account: AccountInsightsFetch | null = null;
    let accountIssue: InsightIssue | null = insightsGranted ? null : "permission";
    if (insightsGranted) {
      const kind = `account:${options.period}`;
      account = readInstagramCache<AccountInsightsFetch>(options.userId, igUserId, kind, now.getTime());
      if (!account) {
        try {
          account = await fetchAccountInsights({
            ctx,
            igUserId,
            range: periodRange(options.period, now),
            now,
            fetchImpl,
          });
          writeInstagramCache(options.userId, igUserId, kind, account, now.getTime());
        } catch (error) {
          if (error instanceof InstagramApiError && error.rateLimited) {
            accountIssue = classifyInsightError(error);
          } else {
            throw error;
          }
        }
      }
    }

    return {
      status: "ok",
      summary: buildInstagramPeriodSummary({
        period: options.period,
        now,
        account,
        accountIssue,
        media,
        currentFollowers: options.account.followersCount,
        snapshots: listInstagramFollowers(options.userId, igUserId),
      }),
    };
  } catch (error) {
    return { status: "error", error: explainInstagramError(error) };
  }
}
