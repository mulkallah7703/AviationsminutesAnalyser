import { INSTAGRAM_GRAPH_BASE } from "@/lib/providers/instagram/config";

export class InstagramApiError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly subcode: number | null;
  readonly type: string;

  constructor(status: number, code: number | null, subcode: number | null, type: string, message: string) {
    super(message || type || `HTTP ${status}`);
    this.name = "InstagramApiError";
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.type = type;
  }

  get tokenInvalid(): boolean {
    return this.code === 190 || this.status === 401;
  }

  get permissionMissing(): boolean {
    const lower = this.message.toLowerCase();
    return this.code === 10 || (this.code !== null && this.code >= 200 && this.code < 300) || lower.includes("permission");
  }

  get rateLimited(): boolean {
    return this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613 || this.status === 429;
  }
}

export type InstagramAccount = {
  id: string;
  userId: string;
  username: string;
  name: string;
  accountType: string | null;
  pictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
};

export type InstagramMedia = {
  id: string;
  caption: string;
  mediaType: string;
  productType: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string | null;
  likeCount: number | null;
  commentsCount: number | null;
};

export type InstagramMediaInsights = {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  totalInteractions: number | null;
};

const PROFILE_FIELDS = [
  "id",
  "user_id",
  "username",
  "name",
  "account_type",
  "profile_picture_url",
  "followers_count",
  "follows_count",
  "media_count",
].join(",");

const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_product_type",
  "permalink",
  "thumbnail_url",
  "media_url",
  "timestamp",
  "like_count",
  "comments_count",
].join(",");

export const MEDIA_INSIGHT_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"] as const;

export function graphUrl(path: string, params: Record<string, string>, accessToken: string): string {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken);
  return url.toString();
}

export async function graphGet(url: string, fetchImpl: typeof fetch): Promise<{ body: Record<string, unknown>; raw: string }> {
  const response = await fetchImpl(url);
  const raw = await response.text().catch(() => "");
  let body: Record<string, unknown> | null = null;
  try {
    body = asObject(JSON.parse(raw));
  } catch {
    body = null;
  }
  const error = asObject(body?.error);
  if (!response.ok || error || !body) {
    throw new InstagramApiError(
      response.status,
      typeof error?.code === "number" ? error.code : null,
      typeof error?.error_subcode === "number" ? error.error_subcode : null,
      text(error?.type),
      text(error?.message) || `HTTP ${response.status}`,
    );
  }
  return { body, raw };
}

export async function fetchInstagramAccount(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<InstagramAccount> {
  const { body, raw } = await graphGet(graphUrl("me", { fields: PROFILE_FIELDS }, accessToken), fetchImpl);
  return parseAccount(body, raw);
}

export function parseAccount(body: Record<string, unknown>, raw = ""): InstagramAccount {
  const rawUserId = /"user_id"\s*:\s*"?(\d+)"?/.exec(raw)?.[1];
  const rawId = /"id"\s*:\s*"?(\d+)"?/.exec(raw)?.[1];
  const id = rawId ?? text(body.id);
  const userId = rawUserId ?? (text(body.user_id) || id);
  const username = text(body.username);
  return {
    id,
    userId,
    username,
    name: text(body.name) || username || "Instagram",
    accountType: text(body.account_type) || null,
    pictureUrl: text(body.profile_picture_url) || null,
    followersCount: count(body.followers_count),
    followsCount: count(body.follows_count),
    mediaCount: count(body.media_count),
  };
}

export function parseMediaList(rows: unknown): InstagramMedia[] {
  if (!Array.isArray(rows)) return [];
  const media: InstagramMedia[] = [];
  for (const row of rows) {
    const item = asObject(row);
    const id = text(item?.id);
    if (!item || !id) continue;
    const mediaType = text(item.media_type) || "IMAGE";
    const mediaUrl = text(item.media_url);
    media.push({
      id,
      caption: text(item.caption),
      mediaType,
      productType: text(item.media_product_type) || null,
      permalink: text(item.permalink) || null,
      thumbnailUrl: text(item.thumbnail_url) || (mediaType === "VIDEO" ? null : mediaUrl || null),
      timestamp: normalizeTimestamp(text(item.timestamp)),
      likeCount: count(item.like_count),
      commentsCount: count(item.comments_count),
    });
  }
  return media;
}

export type MediaPage = { media: InstagramMedia[]; next: string | null };

export async function fetchMediaPage(
  accessToken: string,
  options: { next?: string | null; limit?: number; fetchImpl?: typeof fetch } = {},
): Promise<MediaPage> {
  const url = options.next ?? graphUrl("me/media", { fields: MEDIA_FIELDS, limit: String(options.limit ?? 50) }, accessToken);
  if (!url.startsWith("https://graph.instagram.com/")) return { media: [], next: null };
  const { body } = await graphGet(url, options.fetchImpl ?? fetch);
  const paging = asObject(body.paging);
  const next = text(paging?.next);
  return { media: parseMediaList(body.data), next: next || null };
}

export async function fetchMediaInsights(
  mediaId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InstagramMediaInsights> {
  const { body } = await graphGet(
    graphUrl(`${mediaId}/insights`, { metric: MEDIA_INSIGHT_METRICS.join(",") }, accessToken),
    fetchImpl,
  );
  const values = parseMetricValues(body.data);
  return {
    views: values.get("views") ?? null,
    reach: values.get("reach") ?? null,
    likes: values.get("likes") ?? null,
    comments: values.get("comments") ?? null,
    shares: values.get("shares") ?? null,
    saved: values.get("saved") ?? null,
    totalInteractions: values.get("total_interactions") ?? null,
  };
}

/** Lifetime media insight rows: `{ name, values: [{ value }] }` or `{ name, total_value: { value } }`. */
export function parseMetricValues(rows: unknown): Map<string, number> {
  const values = new Map<string, number>();
  if (!Array.isArray(rows)) return values;
  for (const row of rows) {
    const item = asObject(row);
    const name = text(item?.name);
    if (!item || !name) continue;
    const total = count(asObject(item.total_value)?.value);
    if (total !== null) {
      values.set(name, total);
      continue;
    }
    const list = Array.isArray(item.values) ? item.values : [];
    let sum: number | null = null;
    for (const entry of list) {
      const value = count(asObject(entry)?.value);
      if (value !== null) sum = (sum ?? 0) + value;
    }
    if (sum !== null) values.set(name, sum);
  }
  return values;
}

function normalizeTimestamp(value: string): string | null {
  if (!value) return null;
  const fixed = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(fixed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

export function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
