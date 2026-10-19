import type { ProviderModule } from "@/lib/providers/types";
import { youtubeMeta, youtubeRedirectUri } from "@/lib/providers/youtube/config";
import { explainYouTubeError } from "@/lib/providers/youtube/errors";
import {
  buildGoogleAuthorizationUrl,
  exchangeAuthorizationCode,
  readGoogleClient,
  refreshAccessToken,
  revokeToken,
} from "@/lib/providers/youtube/oauth";

export const youtubeProvider: ProviderModule = {
  meta: youtubeMeta,
  explainError: explainYouTubeError,
  oauth: {
    resolveRedirectUri: () => youtubeRedirectUri(),
    buildAuthorizationUrl({ credentials, redirectUri, state }) {
      const { clientId } = readGoogleClient(credentials);
      return buildGoogleAuthorizationUrl({ clientId, redirectUri, state });
    },
    exchangeAuthorizationCode,
    refreshAccessToken,
    revokeToken,
  },
};
