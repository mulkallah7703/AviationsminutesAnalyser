import { fetchXTweetPage, type XPost } from "@/lib/providers/x/api";
import { followerReadout, type FollowerReadout, type FollowerSnapshot } from "@/lib/providers/tiktok/analytics";
import { periodRange, type AnalyticsPeriod, type PeriodRange } from "@/lib/providers/youtube/analytics";

export const X_TWEET_PAGE_SIZE = 100;
export const X_TWEET_PAGE_CAP = 10;

export type XPostStat = {
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

export type XChartDay = {
  day: string;
  views: number;
  likes: number;
};

export type XPeriodTotals = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  postCount: number;
};

export type XPeriodSummary = {
  range: PeriodRange;
  totals: XPeriodTotals;
  days: XChartDay[];
  followers: FollowerReadout;
  currentFollowers: number | null;
  incomplete: boolean;
  rateLimited: boolean;
  posts: XPostStat[];
};

export type YearPostFetch = {
  posts: XPostStat[];
  incomplete: boolean;
};

export function utcDayStamp(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function publishDay(createdAt: string | null): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return utcDayStamp(date);
}

export function toPostStat(post: XPost): XPostStat {
  return {
    id: post.id,
    text: post.text,
    createdAt: post.createdAt,
    impressionCount: post.impressionCount,
    likeCount: post.likeCount,
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    quoteCount: post.quoteCount,
    bookmarkCount: post.bookmarkCount,
  };
}

export function aggregatePosts(posts: XPostStat[], range: PeriodRange): { totals: XPeriodTotals; days: XChartDay[] } {
  const totals: XPeriodTotals = { views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0, postCount: 0 };
  const byDay = new Map<string, XChartDay>();
  for (const post of posts) {
    const day = publishDay(post.createdAt);
    if (!day || day < range.startDate || day > range.endDate) continue;
    const views = countOrZero(post.impressionCount);
    const likes = countOrZero(post.likeCount);
    const comments = countOrZero(post.replyCount);
    const shares = countOrZero(post.repostCount) + countOrZero(post.quoteCount);
    const bookmarks = countOrZero(post.bookmarkCount);
    totals.postCount += 1;
    totals.views += views;
    totals.likes += likes;
    totals.comments += comments;
    totals.shares += shares;
    totals.bookmarks += bookmarks;
    const point = byDay.get(day) ?? { day, views: 0, likes: 0 };
    point.views += views;
    point.likes += likes;
    byDay.set(day, point);
  }
  return { totals, days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)) };
}

export function buildXPeriodSummary(input: {
  posts: XPostStat[];
  snapshots: FollowerSnapshot[];
  period: AnalyticsPeriod;
  now: Date;
  currentFollowers: number | null;
  incomplete?: boolean;
  rateLimited?: boolean;
}): XPeriodSummary {
  const range = periodRange(input.period, input.now);
  const { totals, days } = aggregatePosts(input.posts, range);
  return {
    range,
    totals,
    days,
    followers: followerReadout(input.snapshots, range),
    currentFollowers: input.currentFollowers,
    incomplete: input.incomplete === true,
    rateLimited: input.rateLimited === true,
    posts: input.posts,
  };
}

export function yearStartTime(now: Date): string {
  return `${periodRange("year", now).startDate}T00:00:00Z`;
}

export async function collectYearPosts(input: {
  accessToken: string;
  userId: string;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<YearPostFetch> {
  const now = input.now ?? new Date();
  const startTime = yearStartTime(now);
  const posts: XPostStat[] = [];
  const seen = new Set<string>();
  let paginationToken: string | undefined;
  for (let page = 0; page < X_TWEET_PAGE_CAP; page += 1) {
    const result = await fetchXTweetPage(input.accessToken, input.userId, {
      startTime,
      paginationToken,
      maxResults: X_TWEET_PAGE_SIZE,
      fetchImpl: input.fetchImpl,
    });
    for (const tweet of result.tweets) {
      if (seen.has(tweet.id)) continue;
      seen.add(tweet.id);
      posts.push(toPostStat(tweet));
    }
    if (!result.nextToken) return { posts, incomplete: false };
    paginationToken = result.nextToken;
  }
  return { posts, incomplete: true };
}

export function previewXSeries(now: Date): { posts: XPostStat[]; snapshots: FollowerSnapshot[] } {
  const year = periodRange("year", now);
  const days = eachUtcDay(year);
  const current = 4820;
  const posts: XPostStat[] = [];
  const snapshots: FollowerSnapshot[] = [];
  days.forEach((day, index) => {
    const fromEnd = days.length - 1 - index;
    snapshots.push({ day, followers: current - fromEnd * 3 });
    posts.push({
      id: `preview-${day}`,
      text: "منشور تجريبي",
      createdAt: `${day}T12:00:00.000Z`,
      impressionCount: 40 + (index % 8) * 15,
      likeCount: 1 + (index % 4),
      replyCount: index % 3,
      repostCount: index % 2,
      quoteCount: index % 2,
      bookmarkCount: index % 5,
    });
  });
  return { posts, snapshots };
}

export function previewXSummary(now: Date, period: AnalyticsPeriod): XPeriodSummary {
  const series = previewXSeries(now);
  const current = series.snapshots[series.snapshots.length - 1]?.followers ?? null;
  return buildXPeriodSummary({
    posts: series.posts,
    snapshots: series.snapshots,
    period,
    now,
    currentFollowers: current,
  });
}

export function recentPosts(posts: XPostStat[], limit = 8): XPost[] {
  return [...posts]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, limit)
    .map((post) => ({
      id: post.id,
      text: post.text,
      createdAt: post.createdAt,
      impressionCount: post.impressionCount,
      likeCount: post.likeCount,
      replyCount: post.replyCount,
      repostCount: post.repostCount,
      quoteCount: post.quoteCount,
      bookmarkCount: post.bookmarkCount,
    }));
}

function countOrZero(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function eachUtcDay(range: PeriodRange): string[] {
  const days: string[] = [];
  let cursor = Date.parse(`${range.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${range.endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 24 * 60 * 60 * 1000;
  }
  return days;
}
