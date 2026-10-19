export class TikTokApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly logId: string;

  constructor(status: number, code: string, message: string, logId = "") {
    super(message);
    this.name = "TikTokApiError";
    this.status = status;
    this.code = code;
    this.logId = logId;
  }
}

export type TikTokVideo = {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  shareUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  createTime: string | null;
};

export type TikTokAccount = {
  openId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  profileUrl: string | null;
  verified: boolean;
  followerCount: number | null;
  followingCount: number | null;
  likesCount: number | null;
  videoCount: number | null;
  videos: TikTokVideo[];
};

const USER_FIELDS = [
  "open_id",
  "union_id",
  "avatar_url",
  "display_name",
  "bio_description",
  "profile_deep_link",
  "is_verified",
  "username",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
].join(",");

const VIDEO_FIELDS = [
  "id",
  "title",
  "video_description",
  "cover_image_url",
  "share_url",
  "duration",
  "create_time",
  "view_count",
  "like_count",
  "comment_count",
  "share_count",
].join(",");

type ErrorBody = { code?: unknown; message?: unknown; log_id?: unknown };

async function tiktokGet<T>(url: string, accessToken: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return readBody<T>(response);
}

async function tiktokPost<T>(
  url: string,
  accessToken: string,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<T> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return readBody<T>(response);
}

async function readBody<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    error?: ErrorBody;
  } | null;
  const code = typeof payload?.error?.code === "string" ? payload.error.code : "";
  const message = typeof payload?.error?.message === "string" ? payload.error.message : "";
  const logId = typeof payload?.error?.log_id === "string" ? payload.error.log_id : "";
  if (!response.ok || (code && code !== "ok") || !payload?.data) {
    throw new TikTokApiError(response.status, code || "http_error", message || `HTTP ${response.status}`, logId);
  }
  return payload.data;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function fetchTikTokAccount(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TikTokAccount> {
  const userUrl = new URL("https://open.tiktokapis.com/v2/user/info/");
  userUrl.searchParams.set("fields", USER_FIELDS);
  const userData = await tiktokGet<{ user?: Record<string, unknown> }>(userUrl.toString(), accessToken, fetchImpl);
  const user = userData.user ?? {};

  let videos: TikTokVideo[] = [];
  try {
    const page = await fetchTikTokVideoListPage(accessToken, { maxCount: 20, fetchImpl });
    videos = page.videos;
  } catch (error) {
    if (!(error instanceof TikTokApiError) || error.code !== "scope_not_authorized") throw error;
  }

  const username = text(user.username) || null;
  return {
    openId: text(user.open_id),
    displayName: text(user.display_name) || username || "TikTok",
    username,
    avatarUrl: text(user.avatar_url) || null,
    bio: text(user.bio_description) || null,
    profileUrl: text(user.profile_deep_link) || (username ? `https://www.tiktok.com/@${username}` : null),
    verified: user.is_verified === true,
    followerCount: count(user.follower_count),
    followingCount: count(user.following_count),
    likesCount: count(user.likes_count),
    videoCount: count(user.video_count),
    videos,
  };
}

export function parseTikTokVideos(rows: unknown[]): TikTokVideo[] {
  const videos: TikTokVideo[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const video = row as Record<string, unknown>;
    const id = text(video.id);
    if (!id) continue;
    const created = count(video.create_time);
    videos.push({
      id,
      title: text(video.title) || text(video.video_description) || "مقطع",
      description: text(video.video_description),
      coverUrl: text(video.cover_image_url) || null,
      shareUrl: text(video.share_url) || null,
      viewCount: count(video.view_count),
      likeCount: count(video.like_count),
      commentCount: count(video.comment_count),
      shareCount: count(video.share_count),
      createTime: created ? new Date(created * 1000).toISOString() : null,
    });
  }
  return videos;
}

export type TikTokVideoListPage = {
  videos: TikTokVideo[];
  cursor: number | null;
  hasMore: boolean;
};

export async function fetchTikTokVideoListPage(
  accessToken: string,
  options: { cursor?: number; maxCount?: number; fetchImpl?: typeof fetch } = {},
): Promise<TikTokVideoListPage> {
  const videoUrl = new URL("https://open.tiktokapis.com/v2/video/list/");
  videoUrl.searchParams.set("fields", VIDEO_FIELDS);
  const body: { max_count: number; cursor?: number } = { max_count: options.maxCount ?? 20 };
  if (options.cursor !== undefined) body.cursor = options.cursor;
  const data = await tiktokPost<{ videos?: unknown[]; cursor?: unknown; has_more?: unknown }>(
    videoUrl.toString(),
    accessToken,
    body,
    options.fetchImpl ?? fetch,
  );
  const cursor = typeof data.cursor === "number" && Number.isFinite(data.cursor) ? data.cursor : null;
  return {
    videos: parseTikTokVideos(data.videos ?? []),
    cursor,
    hasMore: data.has_more === true,
  };
}
