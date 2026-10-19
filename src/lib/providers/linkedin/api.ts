export class LinkedInApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;

  constructor(status: number, code: string, detail: string) {
    super(detail || code || `HTTP ${status}`);
    this.name = "LinkedInApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export type LinkedInProfile = {
  id: string;
  name: string;
  pictureUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  /** Present only when the payload actually includes it. Sign In userinfo does not. */
  headline: string | null;
  /** Present only when the payload actually includes a count. Sign In userinfo does not. */
  followersCount: number | null;
};

export const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export async function fetchLinkedInProfile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LinkedInProfile> {
  const response = await fetchImpl(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw errorFrom(response, payload);
  const profile = parseUserInfo(payload);
  if (!profile) throw new LinkedInApiError(502, "user_missing", "LinkedIn did not return a member id.");
  return profile;
}

export function parseUserInfo(payload: unknown): LinkedInProfile | null {
  const body = asObject(payload);
  if (!body) return null;
  const id = text(body.sub);
  if (!id) return null;
  const given = text(body.given_name);
  const family = text(body.family_name);
  const combined = [given, family].filter(Boolean).join(" ");
  const email = text(body.email);
  return {
    id,
    name: text(body.name) || combined || "LinkedIn",
    pictureUrl: text(body.picture) || null,
    email: email || null,
    emailVerified: body.email_verified === true,
    headline: text(body.headline) || null,
    followersCount: count(body.followersCount) ?? count(body.follower_count) ?? count(body.followers),
  };
}

function errorFrom(response: Response, payload: unknown): LinkedInApiError {
  const body = asObject(payload);
  const message = text(body?.message) || text(body?.error_description) || `HTTP ${response.status}`;
  const code = text(body?.code) || text(body?.error) || text(body?.serviceErrorCode) || `http_${response.status}`;
  return new LinkedInApiError(response.status, code, message);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
