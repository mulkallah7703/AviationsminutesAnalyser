/** Environment variable names. A set variable overrides the value saved by the admin. */
export const CREDENTIAL_ENV: Record<string, Record<string, string>> = {
  youtube: {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  },
  tiktok: {
    clientKey: "TIKTOK_CLIENT_KEY",
    clientSecret: "TIKTOK_CLIENT_SECRET",
    publicBaseUrl: "TIKTOK_PUBLIC_BASE_URL",
  },
  x: {
    clientId: "X_CLIENT_ID",
    clientSecret: "X_CLIENT_SECRET",
    publicBaseUrl: "X_PUBLIC_BASE_URL",
  },
  linkedin: {
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
    publicBaseUrl: "LINKEDIN_PUBLIC_BASE_URL",
  },
};

export function envVarName(platform: string, key: string): string | null {
  return CREDENTIAL_ENV[platform]?.[key] ?? null;
}

export function envCredentialValue(platform: string, key: string): string | null {
  const name = envVarName(platform, key);
  const value = name ? process.env[name]?.trim() : "";
  return value ? value : null;
}
