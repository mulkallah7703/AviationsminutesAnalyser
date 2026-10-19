export const PLATFORM_IDS = ["youtube", "tiktok", "x", "instagram", "linkedin"] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

export type CredentialField = {
  key: string;
  label: string;
  labelAr: string;
  helpAr: string;
  secret: boolean;
  placeholder?: string;
  /** Empty input clears a saved value. Required fields keep the saved value when left blank. */
  optional?: boolean;
  /** Return the full saved value to the browser. Never set this on secrets. */
  reveal?: boolean;
};

export type SetupStep = {
  titleAr: string;
  bodyAr: string;
};

export type ProviderLink = {
  href: string;
  labelAr: string;
};

export type ScopeInfo = {
  value: string;
  descriptionAr: string;
};

export type ProviderMeta = {
  id: PlatformId;
  name: string;
  summaryAr: string;
  availability: "ready" | "coming_soon";
  comingSoonNoteAr?: string;
  accent: string;
  credentialFields: CredentialField[];
  setupSteps: SetupStep[];
  scopes: ScopeInfo[];
  consoleUrl?: string;
  consoleLinkLabel?: string;
  extraLinks: ProviderLink[];
  callbackPath: string;
  pagePath: string;
  redirectHelpAr?: string;
  /** HTTPS, or http only on localhost. TikTok, X, and LinkedIn use this rule. */
  redirectPolicy?: "tiktok" | "x" | "linkedin";
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scope: string;
  tokenType: string;
  openId?: string;
  refreshExpiresAt?: number;
};

export type UserFacingError = {
  code: string;
  titleAr: string;
  bodyAr: string;
  links?: ProviderLink[];
};

export type OAuthAdapter = {
  resolveRedirectUri?(input: { credentials: Record<string, string>; origin: string }): string;
  usesPkce?(redirectUri: string): boolean;
  createCodeVerifier?(): string;
  buildAuthorizationUrl(input: {
    credentials: Record<string, string>;
    redirectUri: string;
    state: string;
    codeVerifier?: string;
  }): string;
  exchangeAuthorizationCode(input: {
    credentials: Record<string, string>;
    redirectUri: string;
    code: string;
    codeVerifier?: string | null;
    fetchImpl?: typeof fetch;
    now?: number;
  }): Promise<TokenSet>;
  refreshAccessToken(input: {
    credentials: Record<string, string>;
    tokens: TokenSet;
    fetchImpl?: typeof fetch;
    now?: number;
  }): Promise<TokenSet>;
  revokeToken?(input: {
    accessToken: string;
    refreshToken: string | null;
    credentials: Record<string, string>;
    fetchImpl?: typeof fetch;
  }): Promise<void>;
};

export type ProviderModule = {
  meta: ProviderMeta;
  oauth?: OAuthAdapter;
  explainError?: (error: unknown, redirectUri?: string) => UserFacingError;
  prepareCredentials?(fields: Record<string, string>):
    | { ok: true; fields: Record<string, string> }
    | { ok: false; message: string };
};

export type ReadyProvider = ProviderModule & {
  meta: ProviderMeta & { availability: "ready" };
  oauth: OAuthAdapter;
  explainError: (error: unknown, redirectUri?: string) => UserFacingError;
};

export function isPlatformId(value: string): value is PlatformId {
  return (PLATFORM_IDS as readonly string[]).includes(value);
}

export function asReadyProvider(provider: ProviderModule | null): ReadyProvider | null {
  if (!provider) return null;
  if (provider.meta.availability !== "ready" || !provider.oauth || !provider.explainError) {
    return null;
  }
  return provider as ReadyProvider;
}
