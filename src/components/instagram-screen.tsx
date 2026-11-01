import { headers } from "next/headers";
import { InstagramView } from "@/components/instagram-view";
import { currentUser } from "@/lib/auth/current";
import { describeCredentials, readCredentials } from "@/lib/store";
import type { InstagramAccount } from "@/lib/providers/instagram/api";
import { previewInstagramSummary, type InstagramPeriodSummary } from "@/lib/providers/instagram/analytics";
import { instagramMeta } from "@/lib/providers/instagram/config";
import { explainInstagramCode, explainInstagramError } from "@/lib/providers/instagram/errors";
import { instagramPreviewAccount } from "@/lib/providers/instagram/fixture";
import { OAuthError } from "@/lib/providers/instagram/oauth";
import { resolveInstagramRedirectUri } from "@/lib/providers/instagram/redirect";
import { loadInstagramAccount, loadInstagramPeriodSummary } from "@/lib/providers/instagram/session";
import type { UserFacingError } from "@/lib/providers/types";
import { parseAnalyticsPeriod } from "@/lib/providers/youtube/analytics";

export async function InstagramScreen({
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
  let account: InstagramAccount | null = null;
  let failure: UserFacingError | null = null;
  let analyticsSummary: InstagramPeriodSummary | null = null;
  let analyticsFailure: UserFacingError | null = null;
  let redirectUri = `${origin}${instagramMeta.callbackPath}`;
  try {
    const credentials = readCredentials("instagram") ?? {};
    enabled = describeCredentials("instagram", instagramMeta.credentialFields).configured;
    redirectUri = resolveInstagramRedirectUri({ credentials, origin });
  } catch (error) {
    failure = explainInstagramError(error, redirectUri);
  }

  if (preview) {
    account = instagramPreviewAccount;
    analyticsSummary = previewInstagramSummary(new Date(), period);
  } else if (user && enabled && !failure) {
    try {
      account = await loadInstagramAccount({ userId: user.id });
    } catch (error) {
      if (error instanceof OAuthError && (error.code === "not_connected" || error.code === "needs_credentials")) {
        account = null;
      } else {
        failure = explainInstagramError(error, redirectUri);
      }
    }
    if (account) {
      const analytics = await loadInstagramPeriodSummary({ userId: user.id, account, period });
      if (analytics.status === "ok") analyticsSummary = analytics.summary;
      else analyticsFailure = analytics.error;
    }
  }

  if (!account && !failure && query.error) {
    failure = explainInstagramCode(query.error, "", redirectUri);
  }

  return (
    <InstagramView
      meta={instagramMeta}
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
