import type { ProviderModule } from "@/lib/providers/types";
import { OAuthError } from "@/lib/auth/oauth-error";
import { xMeta } from "@/lib/providers/x/config";
import { explainXError } from "@/lib/providers/x/errors";
import {
  buildXAuthorizationUrl,
  createCodeVerifier,
  exchangeAuthorizationCode,
  readXClient,
  refreshAccessToken,
  resolveXRedirect,
  revokeToken,
  usesPkce,
} from "@/lib/providers/x/oauth";
import { prepareXCredentials, xRedirectAllowed } from "@/lib/providers/x/redirect";

export const xProvider: ProviderModule = {
  meta: xMeta,
  prepareCredentials: prepareXCredentials,
  explainError: explainXError,
  oauth: {
    resolveRedirectUri: resolveXRedirect,
    usesPkce,
    createCodeVerifier,
    buildAuthorizationUrl({ credentials, redirectUri, state, codeVerifier }) {
      const { clientId } = readXClient(credentials);
      if (!codeVerifier) throw new OAuthError("pkce_unavailable");
      if (!xRedirectAllowed(redirectUri)) throw new OAuthError("redirect_uri_mismatch", redirectUri);
      return buildXAuthorizationUrl({ clientId, redirectUri, state, codeVerifier });
    },
    exchangeAuthorizationCode,
    refreshAccessToken,
    revokeToken,
  },
};
