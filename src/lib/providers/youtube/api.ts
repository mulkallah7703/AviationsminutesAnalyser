export type YouTubeVideo = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
};

export type YouTubeAccount = {
  channelId: string;
  title: string;
  avatarUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  viewCount: number | null;
  videoCount: number | null;
  videos: YouTubeVideo[];
};

export class YouTubeApiError extends Error {
  constructor(
    public status: number,
    public reason: string,
    public description: string,
  ) {
    super(reason || description || `youtube_${status}`);
    this.name = "YouTubeApiError";
  }
}

const API = "https://www.googleapis.com/youtube/v3";

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function thumbnailUrl(thumbnails: unknown): string | null {
  const bag = asObject(thumbnails);
  if (!bag) return null;
  for (const key of ["high", "medium", "default"]) {
    const url = asObject(bag[key])?.url;
    if (typeof url === "string" && url) return url;
  }
  return null;
}

async function youtubeGet(
  path: string,
  accessToken: string,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  const url = new URL(`${API}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new YouTubeApiError(0, "network", "YouTube Data API unreachable");
  }

  const json = asObject(await response.json().catch(() => null));
  if (!response.ok || !json) {
    const error = asObject(json?.error);
    const errors = asArray(error?.errors);
    const first = asObject(errors[0]);
    const reason = typeof first?.reason === "string" ? first.reason : "";
    const message = typeof error?.message === "string" ? error.message : "";
    throw new YouTubeApiError(response.status, reason, message);
  }
  return json;
}

export async function fetchYouTubeAccount(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<YouTubeAccount> {
  const channelJson = await youtubeGet(
    "channels",
    accessToken,
    { part: "snippet,statistics,contentDetails", mine: "true" },
    fetchImpl,
  );
  const channel = asObject(asArray(channelJson.items)[0]);
  if (!channel || typeof channel.id !== "string") {
    throw new YouTubeApiError(404, "noChannel", "No channel for this account");
  }

  const snippet = asObject(channel.snippet);
  const statistics = asObject(channel.statistics);
  const related = asObject(asObject(channel.contentDetails)?.relatedPlaylists);
  const uploads = typeof related?.uploads === "string" ? related.uploads : "";
  const hidden = statistics?.hiddenSubscriberCount === true;

  const account: YouTubeAccount = {
    channelId: channel.id,
    title: typeof snippet?.title === "string" && snippet.title ? snippet.title : "قناة YouTube",
    avatarUrl: thumbnailUrl(snippet?.thumbnails),
    subscriberCount: hidden ? null : parseCount(statistics?.subscriberCount),
    hiddenSubscriberCount: hidden,
    viewCount: parseCount(statistics?.viewCount),
    videoCount: parseCount(statistics?.videoCount),
    videos: [],
  };

  if (!uploads) return account;

  const playlistJson = await youtubeGet(
    "playlistItems",
    accessToken,
    {
      part: "snippet,contentDetails",
      playlistId: uploads,
      maxResults: "12",
    },
    fetchImpl,
  );

  const items: YouTubeVideo[] = [];
  for (const item of asArray(playlistJson.items)) {
    const row = asObject(item);
    if (!row) continue;
    const itemSnippet = asObject(row.snippet);
    const content = asObject(row.contentDetails);
    const resource = asObject(itemSnippet?.resourceId);
    const id =
      (typeof content?.videoId === "string" && content.videoId) ||
      (typeof resource?.videoId === "string" && resource.videoId) ||
      "";
    if (!id) continue;
    const published =
      (typeof content?.videoPublishedAt === "string" && content.videoPublishedAt) ||
      (typeof itemSnippet?.publishedAt === "string" && itemSnippet.publishedAt) ||
      "";
    items.push({
      id,
      title:
        typeof itemSnippet?.title === "string" && itemSnippet.title ? itemSnippet.title : "مقطع",
      publishedAt: published,
      thumbnailUrl: thumbnailUrl(itemSnippet?.thumbnails),
      viewCount: null,
      likeCount: null,
      commentCount: null,
    });
  }

  if (items.length === 0) return account;

  const statsJson = await youtubeGet(
    "videos",
    accessToken,
    { part: "statistics", id: items.map((video) => video.id).join(",") },
    fetchImpl,
  );
  const statsById = new Map<string, Record<string, unknown>>();
  for (const item of asArray(statsJson.items)) {
    const row = asObject(item);
    if (row && typeof row.id === "string") statsById.set(row.id, row);
  }

  account.videos = items.map((video) => {
    const statisticsForVideo = asObject(statsById.get(video.id)?.statistics);
    return {
      id: video.id,
      title: video.title,
      publishedAt: video.publishedAt,
      thumbnailUrl: video.thumbnailUrl,
      viewCount: parseCount(statisticsForVideo?.viewCount),
      likeCount: parseCount(statisticsForVideo?.likeCount),
      commentCount: parseCount(statisticsForVideo?.commentCount),
    };
  });
  return account;
}
