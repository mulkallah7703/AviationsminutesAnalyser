import { getDb } from "@/lib/db";
import type { FollowerSnapshot } from "@/lib/providers/tiktok/analytics";
import type { XPostStat, YearPostFetch } from "@/lib/providers/x/analytics";

export const X_POST_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheRow = { payload: string; fetched_at: number };
type SnapshotRow = { day: string; followers: number };

export function readPostCache(userId: string, xUserId: string, nowMs: number): YearPostFetch | null {
  return readPostCacheAt(userId, xUserId, nowMs, X_POST_CACHE_TTL_MS);
}

export function readPostCacheAt(
  userId: string,
  xUserId: string,
  nowMs: number,
  maxAgeMs: number,
): YearPostFetch | null {
  if (!userId || !xUserId) return null;
  const row = getDb()
    .prepare("SELECT payload, fetched_at FROM x_post_cache WHERE user_id = ? AND x_user_id = ?")
    .get(userId, xUserId) as CacheRow | undefined;
  if (!row) return null;
  if (nowMs - row.fetched_at >= maxAgeMs) return null;
  return parseCache(row.payload);
}

export function writePostCache(userId: string, xUserId: string, fetchResult: YearPostFetch, nowMs: number): void {
  if (!userId || !xUserId) return;
  getDb()
    .prepare(
      `INSERT INTO x_post_cache (user_id, x_user_id, payload, fetched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, x_user_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    )
    .run(userId, xUserId, JSON.stringify(fetchResult), nowMs);
}

export function recordFollowerSnapshot(userId: string, xUserId: string, day: string, followers: number): void {
  if (!userId || !xUserId || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(followers)) return;
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO x_follower_snapshots (user_id, x_user_id, day, followers)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, xUserId, day, Math.trunc(followers));
}

export function listFollowerSnapshots(userId: string, xUserId: string): FollowerSnapshot[] {
  if (!userId || !xUserId) return [];
  const rows = getDb()
    .prepare(
      `SELECT day, followers FROM x_follower_snapshots
       WHERE user_id = ? AND x_user_id = ?
       ORDER BY day ASC`,
    )
    .all(userId, xUserId) as SnapshotRow[];
  return rows.map((row) => ({ day: row.day, followers: row.followers }));
}

function parseCache(payload: string): YearPostFetch | null {
  try {
    const parsed = JSON.parse(payload) as { posts?: unknown; incomplete?: unknown };
    if (!Array.isArray(parsed.posts)) return null;
    const posts: XPostStat[] = [];
    for (const row of parsed.posts) {
      if (!row || typeof row !== "object") return null;
      const post = row as Record<string, unknown>;
      if (typeof post.id !== "string" || !post.id) return null;
      posts.push({
        id: post.id,
        text: typeof post.text === "string" ? post.text : "",
        createdAt: typeof post.createdAt === "string" ? post.createdAt : null,
        impressionCount: finiteOrNull(post.impressionCount),
        likeCount: finiteOrNull(post.likeCount),
        replyCount: finiteOrNull(post.replyCount),
        repostCount: finiteOrNull(post.repostCount),
        quoteCount: finiteOrNull(post.quoteCount),
        bookmarkCount: finiteOrNull(post.bookmarkCount),
      });
    }
    return { posts, incomplete: parsed.incomplete === true };
  } catch {
    return null;
  }
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
