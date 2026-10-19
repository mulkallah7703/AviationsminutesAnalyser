import { headers } from "next/headers";
import { LinkedInView } from "@/components/linkedin-view";
import { currentUser } from "@/lib/auth/current";
import { describeCredentials, readCredentials } from "@/lib/store";
import type { LinkedInProfile } from "@/lib/providers/linkedin/api";
import { linkedinMeta } from "@/lib/providers/linkedin/config";
import { explainLinkedInCode, explainLinkedInError } from "@/lib/providers/linkedin/errors";
import { linkedInPreviewProfile } from "@/lib/providers/linkedin/fixture";
import { OAuthError } from "@/lib/providers/linkedin/oauth";
import { previewLinkedInSummary, type LinkedInPreviewSummary } from "@/lib/providers/linkedin/preview";
import { resolveLinkedInRedirectUri } from "@/lib/providers/linkedin/redirect";
import { loadLinkedInProfile } from "@/lib/providers/linkedin/session";
import type { UserFacingError } from "@/lib/providers/types";
import { parseAnalyticsPeriod } from "@/lib/providers/youtube/analytics";

export async function LinkedInScreen({
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
  let profile: LinkedInProfile | null = null;
  let failure: UserFacingError | null = null;
  let previewSummary: LinkedInPreviewSummary | null = null;
  let redirectUri = `${origin}${linkedinMeta.callbackPath}`;
  try {
    const credentials = readCredentials("linkedin") ?? {};
    enabled = describeCredentials("linkedin", linkedinMeta.credentialFields).configured;
    redirectUri = resolveLinkedInRedirectUri({ credentials, origin });
  } catch (error) {
    failure = explainLinkedInError(error, redirectUri);
  }

  if (preview) {
    profile = linkedInPreviewProfile;
    previewSummary = previewLinkedInSummary(new Date(), period);
  } else if (user && enabled && !failure) {
    try {
      profile = await loadLinkedInProfile({ userId: user.id });
    } catch (error) {
      if (error instanceof OAuthError && (error.code === "not_connected" || error.code === "needs_credentials")) {
        profile = null;
      } else {
        failure = explainLinkedInError(error, redirectUri);
      }
    }
  }

  if (!profile && !failure && query.error) {
    failure = explainLinkedInCode(query.error, "", redirectUri);
  }

  return (
    <LinkedInView
      meta={linkedinMeta}
      profile={profile}
      failure={failure}
      justConnected={!preview && query.connected === "1" && Boolean(profile) && !failure}
      preview={preview}
      enabled={preview || enabled}
      signedIn={preview || Boolean(user)}
      period={period}
      previewSummary={previewSummary}
    />
  );
}
