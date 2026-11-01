import { getDb } from "@/lib/db";
import type { FollowerSnapshot } from "@/lib/providers/tiktok/analytics";

export const INSTAGRAM_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheRow = { payload: string; fetched_at: number };
type SnapshotRow = { day: string; followers: number };

export function readInstagramCache<T>(userId: string, igUserId: string, kind: string, nowMs: number): T | null {
  if (!userId || !igUserId) return null;
  const row = getDb()
    .prepare("SELECT payload, fetched_at FROM instagram_cache WHERE user_id = ? AND ig_user_id = ? AND kind = ?")
    .get(userId, igUserId, kind) as CacheRow | undefined;
  if (!row || nowMs - row.fetched_at >= INSTAGRAM_CACHE_TTL_MS) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export function writeInstagramCache(userId: string, igUserId: string, kind: string, payload: unknown, nowMs: number): void {
  if (!userId || !igUserId) return;
  getDb()
    .prepare(
      `INSERT INTO instagram_cache (user_id, ig_user_id, kind, payload, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, ig_user_id, kind) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    )
    .run(userId, igUserId, kind, JSON.stringify(payload), nowMs);
}

export function clearInstagramCache(userId: string): void {
  getDb().prepare("DELETE FROM instagram_cache WHERE user_id = ?").run(userId);
}

export function recordInstagramFollowers(userId: string, igUserId: string, day: string, followers: number): void {
  if (!userId || !igUserId || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(followers)) return;
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO instagram_follower_snapshots (user_id, ig_user_id, day, followers)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, igUserId, day, Math.trunc(followers));
}

export function listInstagramFollowers(userId: string, igUserId: string): FollowerSnapshot[] {
  if (!userId || !igUserId) return [];
  const rows = getDb()
    .prepare(
      `SELECT day, followers FROM instagram_follower_snapshots
       WHERE user_id = ? AND ig_user_id = ?
       ORDER BY day ASC`,
    )
    .all(userId, igUserId) as SnapshotRow[];
  return rows.map((row) => ({ day: row.day, followers: row.followers }));
}
