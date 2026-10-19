export class XApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly resetAt: number | null;

  constructor(status: number, code: string, detail: string, resetAt: number | null = null) {
    super(detail || code || `HTTP ${status}`);
    this.name = "XApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.resetAt = resetAt;
  }
}

export type XPost = {
  id: string;
  text: string;
  createdAt: string | null;
  impressionCount: number | null;
  likeCount: number | null;
  replyCount: number | null;
  repostCount: number | null;
  quoteCount: number | null;
  bookmarkCount: number | null;
};

export type XAccount = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  description: string | null;
  verified: boolean;
  followersCount: number | null;
  followingCount: number | null;
  tweetCount: number | null;
  tweets: XPost[];
};

export type XTweetPage = {
  tweets: XPost[];
  nextToken: string | null;
};

const USER_FIELDS = "id,name,username,profile_image_url,description,verified,public_metrics";
const TWEET_FIELDS = "created_at,public_metrics,text";

export async function fetchXAccount(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<XAccount> {
  const url = new URL("https://api.x.com/2/users/me");
  url.searchParams.set("user.fields", USER_FIELDS);
  const payload = await xGet(url, accessToken, fetchImpl);
  const user = asObject(asObject(payload)?.data);
  if (!user) throw new XApiError(502, "user_missing", "X did not return a user.");
  const id = text(user.id);
  if (!id) throw new XApiError(502, "user_missing", "X did not return a user id.");
  const metrics = asObject(user.public_metrics);
  const username = text(user.username);
  return {
    id,
    name: text(user.name) || username || "X",
    username,
    avatarUrl: text(user.profile_image_url) || null,
    description: text(user.description) || null,
    verified: user.verified === true,
    followersCount: count(metrics?.followers_count),
    followingCount: count(metrics?.following_count),
    tweetCount: count(metrics?.tweet_count),
    tweets: [],
  };
}

export async function fetchXTweetPage(
  accessToken: string,
  userId: string,
  options: { startTime?: string; paginationToken?: string; maxResults?: number; fetchImpl?: typeof fetch } = {},
): Promise<XTweetPage> {
  const url = new URL(`https://api.x.com/2/users/${encodeURIComponent(userId)}/tweets`);
  url.searchParams.set("max_results", String(options.maxResults ?? 100));
  url.searchParams.set("tweet.fields", TWEET_FIELDS);
  url.searchParams.set("exclude", "retweets");
  if (options.startTime) url.searchParams.set("start_time", options.startTime);
  if (options.paginationToken) url.searchParams.set("pagination_token", options.paginationToken);
  const payload = await xGet(url, accessToken, options.fetchImpl ?? fetch);
  const body = asObject(payload);
  const meta = asObject(body?.meta);
  const next = text(meta?.next_token);
  return {
    tweets: parseTweets(Array.isArray(body?.data) ? body.data : []),
    nextToken: next || null,
  };
}

async function xGet(url: URL, accessToken: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw errorFrom(response, payload);
  return payload;
}

function errorFrom(response: Response, payload: unknown): XApiError {
  const body = asObject(payload);
  const type = text(body?.type);
  const title = text(body?.title);
  const detail = text(body?.detail);
  const reason = text(body?.reason);
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const first = asObject(errors[0]);
  const message = text(first?.message) || detail || title || `HTTP ${response.status}`;
  const code = reason || type || title || text(first?.code) || `http_${response.status}`;
  const resetHeader = response.headers.get("x-rate-limit-reset");
  const resetAt = resetHeader && /^\d+$/.test(resetHeader) ? Number(resetHeader) * 1000 : null;
  return new XApiError(response.status, code, message, resetAt);
}

export function parseTweets(rows: unknown[]): XPost[] {
  const tweets: XPost[] = [];
  for (const row of rows) {
    const tweet = asObject(row);
    if (!tweet) continue;
    const id = text(tweet.id);
    if (!id) continue;
    const metrics = asObject(tweet.public_metrics);
    const created = text(tweet.created_at);
    tweets.push({
      id,
      text: text(tweet.text) || "منشور",
      createdAt: created || null,
      impressionCount: count(metrics?.impression_count),
      likeCount: count(metrics?.like_count),
      replyCount: count(metrics?.reply_count),
      repostCount: count(metrics?.retweet_count),
      quoteCount: count(metrics?.quote_count),
      bookmarkCount: count(metrics?.bookmark_count),
    });
  }
  return tweets;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
