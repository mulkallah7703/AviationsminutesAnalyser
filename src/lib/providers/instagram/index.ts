import { OAuthError } from "@/lib/auth/oauth-error";
import { instagramMeta } from "@/lib/providers/instagram/config";
import { explainInstagramError } from "@/lib/providers/instagram/errors";
import {
  buildInstagramAuthorizationUrl,
  exchangeAuthorizationCode,
  readInstagramClient,
  refreshAccessToken,
  resolveInstagramRedirect,
  usesPkce,
} from "@/lib/providers/instagram/oauth";
import { instagramRedirectAllowed, prepareInstagramCredentials } from "@/lib/providers/instagram/redirect";
import type { ProviderModule } from "@/lib/providers/types";

/** Business Login for Instagram. Instagram has no token revoke endpoint, so disconnect clears the local token. */
export const instagramProvider: ProviderModule = {
  meta: instagramMeta,
  prepareCredentials: prepareInstagramCredentials,
  explainError: explainInstagramError,
  oauth: {
    resolveRedirectUri: resolveInstagramRedirect,
    usesPkce,
    buildAuthorizationUrl({ credentials, redirectUri, state }) {
      const { clientId } = readInstagramClient(credentials);
      if (!instagramRedirectAllowed(redirectUri)) throw new OAuthError("redirect_uri_mismatch", redirectUri);
      return buildInstagramAuthorizationUrl({ clientId, redirectUri, state });
    },
    exchangeAuthorizationCode,
    refreshAccessToken,
  },
};
