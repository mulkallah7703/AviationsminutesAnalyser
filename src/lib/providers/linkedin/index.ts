import { OAuthError } from "@/lib/auth/oauth-error";
import type { ProviderModule } from "@/lib/providers/types";
import { linkedinMeta } from "@/lib/providers/linkedin/config";
import { explainLinkedInError } from "@/lib/providers/linkedin/errors";
import {
  buildLinkedInAuthorizationUrl,
  exchangeAuthorizationCode,
  readLinkedInClient,
  refreshAccessToken,
  resolveLinkedInRedirect,
  revokeToken,
  usesPkce,
} from "@/lib/providers/linkedin/oauth";
import { linkedInRedirectAllowed, prepareLinkedInCredentials } from "@/lib/providers/linkedin/redirect";

export const linkedinProvider: ProviderModule = {
  meta: linkedinMeta,
  prepareCredentials: prepareLinkedInCredentials,
  explainError: explainLinkedInError,
  oauth: {
    resolveRedirectUri: resolveLinkedInRedirect,
    usesPkce,
    buildAuthorizationUrl({ credentials, redirectUri, state }) {
      const { clientId } = readLinkedInClient(credentials);
      if (!linkedInRedirectAllowed(redirectUri)) throw new OAuthError("redirect_uri_mismatch", redirectUri);
      return buildLinkedInAuthorizationUrl({ clientId, redirectUri, state });
    },
    exchangeAuthorizationCode,
    refreshAccessToken,
    revokeToken,
  },
};
