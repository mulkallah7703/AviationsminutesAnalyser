import { headers } from "next/headers";
import { TikTokView } from "@/components/tiktok-view";
import { currentUser } from "@/lib/auth/current";
import { describeCredentials, readCredentials } from "@/lib/store";
import type { TikTokAccount } from "@/lib/providers/tiktok/api";
import { previewTikTokSummary, type TikTokPeriodSummary } from "@/lib/providers/tiktok/analytics";
import { tiktokMeta } from "@/lib/providers/tiktok/config";
import { explainTikTokCode, explainTikTokError } from "@/lib/providers/tiktok/errors";
import { tiktokPreviewAccount } from "@/lib/providers/tiktok/fixture";
import { OAuthError, resolveTikTokRedirectUri } from "@/lib/providers/tiktok/oauth";
import { loadTikTokAccount, loadTikTokPeriodSummary } from "@/lib/providers/tiktok/session";
import type { UserFacingError } from "@/lib/providers/types";
import { parseAnalyticsPeriod } from "@/lib/providers/youtube/analytics";

export async function TikTokScreen({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; preview?: string; period?: string }>;
}) {
  const query = await searchParams;
  const preview = query.preview === "mock" && process.env.NODE_ENV !== "production";
  const period = parseAnalyticsPeriod(query.period);
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:5050";
  const proto = (headerList.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  const origin = `${proto}://${host}`;

  const user = await currentUser();
  let enabled = false;
  let account: TikTokAccount | null = null;
  let failure: UserFacingError | null = null;
  let analyticsSummary: TikTokPeriodSummary | null = null;
  let analyticsFailure: UserFacingError | null = null;
  let redirectUri = `${origin}${tiktokMeta.callbackPath}`;
  try {
    const credentials = readCredentials("tiktok") ?? {};
    enabled = describeCredentials("tiktok", tiktokMeta.credentialFields).configured;
    redirectUri = resolveTikTokRedirectUri({ credentials, origin });
  } catch (error) {
    failure = explainTikTokError(error, redirectUri);
  }

  if (preview) {
    account = tiktokPreviewAccount;
    analyticsSummary = previewTikTokSummary(new Date(), period);
  } else if (user && enabled && !failure) {
    try {
      account = await loadTikTokAccount({ userId: user.id });
    } catch (error) {
      if (error instanceof OAuthError && (error.code === "not_connected" || error.code === "needs_credentials")) {
        account = null;
      } else {
        failure = explainTikTokError(error, redirectUri);
      }
    }
    if (account) {
      const analytics = await loadTikTokPeriodSummary({
        userId: user.id,
        openId: account.openId,
        followerCount: account.followerCount,
        period,
      });
      if (analytics.status === "ok") analyticsSummary = analytics.summary;
      else analyticsFailure = analytics.error;
    }
  }

  if (!account && !failure && query.error) {
    failure = explainTikTokCode(query.error, "", redirectUri);
  }

  return (
    <TikTokView
      meta={tiktokMeta}
      account={account}
      failure={failure}
      justConnected={!preview && query.connected === "1" && Boolean(account) && !failure}
      preview={preview}
      enabled={preview || enabled}
      signedIn={preview || Boolean(user)}
      period={period}
      analyticsSummary={analyticsSummary}
      analyticsFailure={analyticsFailure}
    />
  );
}
