import { YouTubeView } from "@/components/youtube-view";
import { currentUser } from "@/lib/auth/current";
import { describeCredentials } from "@/lib/store";
import {
  parseAnalyticsPeriod,
  periodRange,
  previewAnalyticsDays,
  summarizeDays,
  type AnalyticsDay,
  type AnalyticsSummary,
} from "@/lib/providers/youtube/analytics";
import { youtubeMeta, youtubeRedirectUri } from "@/lib/providers/youtube/config";
import { explainYouTubeCode, explainYouTubeError } from "@/lib/providers/youtube/errors";
import { youtubePreviewAccount } from "@/lib/providers/youtube/fixture";
import { OAuthError } from "@/lib/providers/youtube/oauth";
import { loadYouTubeAccount, loadYouTubeAnalytics } from "@/lib/providers/youtube/session";
import type { YouTubeAccount } from "@/lib/providers/youtube/api";
import type { UserFacingError } from "@/lib/providers/types";

export async function YouTubeScreen({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; preview?: string; period?: string }>;
}) {
  const query = await searchParams;
  const preview = query.preview === "mock" && process.env.NODE_ENV !== "production";
  const period = parseAnalyticsPeriod(query.period);
  const redirectUri = youtubeRedirectUri();

  const user = await currentUser();
  let enabled = false;
  let account: YouTubeAccount | null = null;
  let failure: UserFacingError | null = null;
  let analyticsSummary: AnalyticsSummary | null = null;
  let analyticsDays: AnalyticsDay[] = [];
  let needsAnalyticsScope = false;
  let analyticsFailure: UserFacingError | null = null;
  try {
    enabled = describeCredentials("youtube", youtubeMeta.credentialFields).configured;
  } catch (error) {
    failure = explainYouTubeError(error, redirectUri);
  }

  if (preview) {
    account = youtubePreviewAccount;
    const now = new Date();
    const range = periodRange(period, now);
    analyticsDays = previewAnalyticsDays(now).filter((day) => day.day >= range.startDate && day.day <= range.endDate);
    analyticsSummary = summarizeDays(analyticsDays);
  } else if (user && enabled) {
    try {
      account = await loadYouTubeAccount({ userId: user.id });
    } catch (error) {
      if (error instanceof OAuthError && (error.code === "not_connected" || error.code === "needs_credentials")) {
        account = null;
      } else {
        failure = explainYouTubeError(error, redirectUri);
      }
    }
    if (account) {
      const analytics = await loadYouTubeAnalytics({ userId: user.id, period });
      if (analytics.status === "ok") {
        analyticsSummary = analytics.summary;
        analyticsDays = analytics.days;
      } else if (analytics.status === "needs_scope") {
        needsAnalyticsScope = true;
      } else {
        analyticsFailure = analytics.error;
      }
    }
  }

  if (!account && !failure && query.error) {
    failure = explainYouTubeCode(query.error, "", redirectUri);
  }

  return (
    <YouTubeView
      meta={youtubeMeta}
      account={account}
      failure={failure}
      justConnected={!preview && query.connected === "1" && Boolean(account) && !failure}
      preview={preview}
      enabled={preview || enabled}
      signedIn={preview || Boolean(user)}
      period={period}
      analyticsSummary={analyticsSummary}
      analyticsDays={analyticsDays}
      needsAnalyticsScope={needsAnalyticsScope}
      analyticsFailure={analyticsFailure}
    />
  );
}
