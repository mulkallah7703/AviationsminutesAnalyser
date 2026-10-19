import { fetchTikTokVideoListPage, type TikTokVideo } from "@/lib/providers/tiktok/api";
import { periodRange, type AnalyticsPeriod, type PeriodRange } from "@/lib/providers/youtube/analytics";

export const TIKTOK_VIDEO_PAGE_SIZE = 20;
export const TIKTOK_VIDEO_PAGE_CAP = 50;

export type TikTokVideoStat = {
  id: string;
  createTime: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
};

export type TikTokChartDay = {
  day: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type TikTokPeriodTotals = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  videoCount: number;
};

export type FollowerSnapshot = {
  day: string;
  followers: number;
};

export type FollowerReadout =
  | { covered: true; net: number }
  | { covered: false; since: string | null };

export type TikTokPeriodSummary = {
  range: PeriodRange;
  totals: TikTokPeriodTotals;
  days: TikTokChartDay[];
  followers: FollowerReadout;
  currentFollowers: number | null;
  incomplete: boolean;
};

export type YearVideoFetch = {
  videos: TikTokVideoStat[];
  incomplete: boolean;
};

export function utcDayStamp(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function publishDay(createTime: string | null): string | null {
  if (!createTime) return null;
  const date = new Date(createTime);
  if (Number.isNaN(date.getTime())) return null;
  return utcDayStamp(date);
}

export function toVideoStat(video: TikTokVideo): TikTokVideoStat {
  return {
    id: video.id,
    createTime: video.createTime,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    shareCount: video.shareCount,
  };
}

export function aggregatePublishedVideos(
  videos: TikTokVideoStat[],
  range: PeriodRange,
): { totals: TikTokPeriodTotals; days: TikTokChartDay[] } {
  const totals: TikTokPeriodTotals = { views: 0, likes: 0, comments: 0, shares: 0, videoCount: 0 };
  const byDay = new Map<string, TikTokChartDay>();
  for (const video of videos) {
    const day = publishDay(video.createTime);
    if (!day || day < range.startDate || day > range.endDate) continue;
    totals.videoCount += 1;
    totals.views += countOrZero(video.viewCount);
    totals.likes += countOrZero(video.likeCount);
    totals.comments += countOrZero(video.commentCount);
    totals.shares += countOrZero(video.shareCount);
    const point = byDay.get(day) ?? { day, views: 0, likes: 0, comments: 0, shares: 0 };
    point.views += countOrZero(video.viewCount);
    point.likes += countOrZero(video.likeCount);
    point.comments += countOrZero(video.commentCount);
    point.shares += countOrZero(video.shareCount);
    byDay.set(day, point);
  }
  return { totals, days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)) };
}

export function followerReadout(snapshots: FollowerSnapshot[], range: PeriodRange): FollowerReadout {
  const sorted = snapshots
    .filter((snapshot) => /^\d{4}-\d{2}-\d{2}$/.test(snapshot.day) && Number.isFinite(snapshot.followers))
    .sort((a, b) => a.day.localeCompare(b.day));
  if (sorted.length === 0) return { covered: false, since: null };
  const since = sorted[0]?.day ?? null;
  let baseline: FollowerSnapshot | null = null;
  let latest: FollowerSnapshot | null = null;
  for (const snapshot of sorted) {
    if (snapshot.day <= range.startDate) baseline = snapshot;
    if (snapshot.day >= range.startDate && snapshot.day <= range.endDate) latest = snapshot;
  }
  if (!baseline || !latest || latest.day <= baseline.day) return { covered: false, since };
  return { covered: true, net: latest.followers - baseline.followers };
}

export function buildTikTokPeriodSummary(input: {
  videos: TikTokVideoStat[];
  snapshots: FollowerSnapshot[];
  period: AnalyticsPeriod;
  now: Date;
  currentFollowers: number | null;
  incomplete?: boolean;
}): TikTokPeriodSummary {
  const range = periodRange(input.period, input.now);
  const { totals, days } = aggregatePublishedVideos(input.videos, range);
  return {
    range,
    totals,
    days,
    followers: followerReadout(input.snapshots, range),
    currentFollowers: input.currentFollowers,
    incomplete: input.incomplete === true,
  };
}

export async function collectYearVideoStats(input: {
  accessToken: string;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<YearVideoFetch> {
  const cutoff = periodRange("year", input.now ?? new Date()).startDate;
  const videos: TikTokVideoStat[] = [];
  const seen = new Set<string>();
  let cursor: number | undefined;
  for (let page = 0; page < TIKTOK_VIDEO_PAGE_CAP; page += 1) {
    const result = await fetchTikTokVideoListPage(input.accessToken, {
      cursor,
      maxCount: TIKTOK_VIDEO_PAGE_SIZE,
      fetchImpl: input.fetchImpl,
    });
    let oldest: string | null = null;
    for (const video of result.videos) {
      if (seen.has(video.id)) continue;
      seen.add(video.id);
      const day = publishDay(video.createTime);
      if (day && (oldest === null || day < oldest)) oldest = day;
      if (!day || day >= cutoff) videos.push(toVideoStat(video));
    }
    if (!result.hasMore || (oldest !== null && oldest < cutoff)) {
      return { videos, incomplete: false };
    }
    if (result.cursor === null) return { videos, incomplete: true };
    cursor = result.cursor;
  }
  return { videos, incomplete: true };
}

export function previewTikTokSeries(now: Date): { videos: TikTokVideoStat[]; snapshots: FollowerSnapshot[] } {
  const year = periodRange("year", now);
  const days = eachUtcDay(year);
  const current = 12840;
  const videos: TikTokVideoStat[] = [];
  const snapshots: FollowerSnapshot[] = [];
  days.forEach((day, index) => {
    const fromEnd = days.length - 1 - index;
    snapshots.push({ day, followers: current - fromEnd * 4 });
    videos.push({
      id: `preview-${day}`,
      createTime: `${day}T12:00:00.000Z`,
      viewCount: 30 + (index % 9) * 20,
      likeCount: 2 + (index % 5),
      commentCount: index % 4,
      shareCount: index % 3,
    });
  });
  return { videos, snapshots };
}

export function previewTikTokSummary(now: Date, period: AnalyticsPeriod): TikTokPeriodSummary {
  const series = previewTikTokSeries(now);
  const current = series.snapshots[series.snapshots.length - 1]?.followers ?? null;
  return buildTikTokPeriodSummary({
    videos: series.videos,
    snapshots: series.snapshots,
    period,
    now,
    currentFollowers: current,
  });
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
