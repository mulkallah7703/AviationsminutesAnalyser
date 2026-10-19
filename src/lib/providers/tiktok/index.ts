import type { ProviderModule } from "@/lib/providers/types";
import { tiktokMeta } from "@/lib/providers/tiktok/config";
import { explainTikTokError } from "@/lib/providers/tiktok/errors";
import { OAuthError } from "@/lib/auth/oauth-error";
import {
  buildTikTokAuthorizationUrl,
  createCodeVerifier,
  exchangeAuthorizationCode,
  readTikTokClient,
  refreshAccessToken,
  resolveTikTokRedirectUri,
  revokeToken,
} from "@/lib/providers/tiktok/oauth";
import { isLoopbackHost, prepareTikTokCredentials } from "@/lib/providers/tiktok/redirect";

export const tiktokProvider: ProviderModule = {
  meta: tiktokMeta,
  prepareCredentials: prepareTikTokCredentials,
  explainError: explainTikTokError,
  oauth: {
    resolveRedirectUri: resolveTikTokRedirectUri,
    usesPkce: () => true,
    createCodeVerifier,
    buildAuthorizationUrl({ credentials, redirectUri, state, codeVerifier }) {
      const { clientKey } = readTikTokClient(credentials);
      if (!codeVerifier) throw new OAuthError("pkce_unavailable");
      const url = new URL(redirectUri);
      const allowed =
        url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost(url.hostname));
      if (!allowed) throw new OAuthError("redirect_uri_mismatch", redirectUri);
      return buildTikTokAuthorizationUrl({ clientKey, redirectUri, state, codeVerifier });
    },
    exchangeAuthorizationCode,
    refreshAccessToken,
    revokeToken,
  },
};
