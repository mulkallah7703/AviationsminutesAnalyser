import { headers } from "next/headers";
import { XView } from "@/components/x-view";
import { currentUser } from "@/lib/auth/current";
import { describeCredentials, readCredentials } from "@/lib/store";
import type { XAccount } from "@/lib/providers/x/api";
import { previewXSummary, type XPeriodSummary } from "@/lib/providers/x/analytics";
import { xMeta } from "@/lib/providers/x/config";
import { explainXCode, explainXError } from "@/lib/providers/x/errors";
import { xPreviewAccount } from "@/lib/providers/x/fixture";
import { OAuthError } from "@/lib/providers/x/oauth";
import { resolveXRedirectUri } from "@/lib/providers/x/redirect";
import { loadXAccount, loadXPeriodSummary, postsForAccount } from "@/lib/providers/x/session";
import type { UserFacingError } from "@/lib/providers/types";
import { parseAnalyticsPeriod } from "@/lib/providers/youtube/analytics";

export async function XScreen({
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
  let account: XAccount | null = null;
  let failure: UserFacingError | null = null;
  let analyticsSummary: XPeriodSummary | null = null;
  let analyticsFailure: UserFacingError | null = null;
  let redirectUri = `${origin}${xMeta.callbackPath}`;
  try {
    const credentials = readCredentials("x") ?? {};
    enabled = describeCredentials("x", xMeta.credentialFields).configured;
    redirectUri = resolveXRedirectUri({ credentials, origin });
  } catch (error) {
    failure = explainXError(error, redirectUri);
  }

  if (preview) {
    account = xPreviewAccount;
    analyticsSummary = previewXSummary(new Date(), period);
  } else if (user && enabled && !failure) {
    try {
      account = await loadXAccount({ userId: user.id });
    } catch (error) {
      if (error instanceof OAuthError && (error.code === "not_connected" || error.code === "needs_credentials")) {
        account = null;
      } else {
        failure = explainXError(error, redirectUri);
      }
    }
    if (account) {
      const analytics = await loadXPeriodSummary({
        userId: user.id,
        xUserId: account.id,
        followerCount: account.followersCount,
        period,
      });
      if (analytics.status === "ok") {
        analyticsSummary = analytics.summary;
        account = { ...account, tweets: postsForAccount(analytics.summary) };
      } else {
        analyticsFailure = analytics.error;
      }
    }
  }

  if (!account && !failure && query.error) {
    failure = explainXCode(query.error, "", redirectUri);
  }

  return (
    <XView
      meta={xMeta}
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
