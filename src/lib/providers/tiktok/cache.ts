import { getDb } from "@/lib/db";
import type { FollowerSnapshot, TikTokVideoStat, YearVideoFetch } from "@/lib/providers/tiktok/analytics";

export const TIKTOK_VIDEO_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheRow = { payload: string; fetched_at: number };
type SnapshotRow = { day: string; followers: number };

export function readVideoCache(userId: string, openId: string, nowMs: number): YearVideoFetch | null {
  if (!userId || !openId) return null;
  const row = getDb()
    .prepare("SELECT payload, fetched_at FROM tiktok_video_cache WHERE user_id = ? AND open_id = ?")
    .get(userId, openId) as CacheRow | undefined;
  if (!row) return null;
  if (nowMs - row.fetched_at >= TIKTOK_VIDEO_CACHE_TTL_MS) return null;
  return parseCache(row.payload);
}

export function writeVideoCache(userId: string, openId: string, fetchResult: YearVideoFetch, nowMs: number): void {
  if (!userId || !openId) return;
  getDb()
    .prepare(
      `INSERT INTO tiktok_video_cache (user_id, open_id, payload, fetched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, open_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    )
    .run(userId, openId, JSON.stringify(fetchResult), nowMs);
}

export function recordFollowerSnapshot(userId: string, openId: string, day: string, followers: number): void {
  if (!userId || !openId || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(followers)) return;
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO tiktok_follower_snapshots (user_id, open_id, day, followers)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, openId, day, Math.trunc(followers));
}

export function listFollowerSnapshots(userId: string, openId: string): FollowerSnapshot[] {
  if (!userId || !openId) return [];
  const rows = getDb()
    .prepare(
      `SELECT day, followers FROM tiktok_follower_snapshots
       WHERE user_id = ? AND open_id = ?
       ORDER BY day ASC`,
    )
    .all(userId, openId) as SnapshotRow[];
  return rows.map((row) => ({ day: row.day, followers: row.followers }));
}

function parseCache(payload: string): YearVideoFetch | null {
  try {
    const parsed = JSON.parse(payload) as { videos?: unknown; incomplete?: unknown };
    if (!Array.isArray(parsed.videos)) return null;
    const videos: TikTokVideoStat[] = [];
    for (const row of parsed.videos) {
      if (!row || typeof row !== "object") return null;
      const video = row as Record<string, unknown>;
      if (typeof video.id !== "string" || !video.id) return null;
      videos.push({
        id: video.id,
        createTime: typeof video.createTime === "string" ? video.createTime : null,
        viewCount: finiteOrNull(video.viewCount),
        likeCount: finiteOrNull(video.likeCount),
        commentCount: finiteOrNull(video.commentCount),
        shareCount: finiteOrNull(video.shareCount),
      });
    }
    return { videos, incomplete: parsed.incomplete === true };
  } catch {
    return null;
  }
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
