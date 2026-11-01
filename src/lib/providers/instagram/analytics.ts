import {
  asObject,
  count,
  fetchMediaInsights,
  fetchMediaPage,
  graphGet,
  graphUrl,
  type GraphContext,
  InstagramApiError,
  text,
  type InstagramMedia,
  type InstagramMediaInsights,
} from "@/lib/providers/instagram/api";
import { followerReadout, publishDay, type FollowerReadout, type FollowerSnapshot } from "@/lib/providers/tiktok/analytics";
import { periodRange, type AnalyticsPeriod, type PeriodRange } from "@/lib/providers/youtube/analytics";

const DAY_SEC = 24 * 60 * 60;

/** Meta rejects account insight ranges longer than 30 days, so each request covers at most 29 days. */
export const INSIGHTS_CHUNK_DAYS = 29;
export const MEDIA_PAGE_SIZE = 50;
export const MEDIA_PAGE_CAP = 10;
/** Per-post insight requests are one call each, so only the newest posts in the period are read. */
export const MEDIA_INSIGHTS_CAP = 60;

export const ACCOUNT_METRICS = [
  "views",
  "reach",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
] as const;

export type AccountMetric = (typeof ACCOUNT_METRICS)[number];

export type InsightIssue = "permission" | "not_professional" | "unsupported" | "small_account" | "rate_limited";

export type AccountInsightsFetch = {
  totals: Partial<Record<AccountMetric, number>>;
  failed: Partial<Record<AccountMetric, InsightIssue>>;
  reachDaily: { day: string; value: number }[] | null;
  reachIssue: InsightIssue | null;
  follows: { gained: number; lost: number } | null;
  followsIssue: InsightIssue | null;
  chunks: number;
};

export type InstagramPostStat = InstagramMedia & { insights: InstagramMediaInsights | null };

export type MediaFetch = {
  posts: InstagramPostStat[];
  incomplete: boolean;
  insightsIssue: InsightIssue | null;
};

export type TotalSource = "account" | "posts";

export type MetricTotal = { value: number; source: TotalSource } | null;

export type InstagramTotals = {
  views: MetricTotal;
  reach: MetricTotal;
  likes: MetricTotal;
  comments: MetricTotal;
  shares: MetricTotal;
  saves: MetricTotal;
  interactions: MetricTotal;
  engaged: MetricTotal;
};

export type InstagramChartDay = {
  day: string;
  reach: number | null;
  views: number;
};

export type InstagramNotice = { code: string; textAr: string };

export type InstagramPeriodSummary = {
  range: PeriodRange;
  totals: InstagramTotals;
  followers: {
    current: number | null;
    gained: number | null;
    lost: number | null;
    snapshot: FollowerReadout;
  };
  days: InstagramChartDay[];
  posts: InstagramPostStat[];
  postCount: number;
  notices: InstagramNotice[];
  chunked: boolean;
};

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Unix-second windows covering the range, newest data included up to `now`. */
export function insightWindows(range: PeriodRange, now: Date, chunkDays = INSIGHTS_CHUNK_DAYS): { since: number; until: number }[] {
  const start = Math.floor(Date.parse(`${range.startDate}T00:00:00.000Z`) / 1000);
  const endOfRange = Math.floor(Date.parse(`${range.endDate}T00:00:00.000Z`) / 1000) + DAY_SEC;
  const end = Math.min(endOfRange, Math.floor(now.getTime() / 1000));
  const windows: { since: number; until: number }[] = [];
  let since = start;
  while (since < end) {
    const until = Math.min(since + chunkDays * DAY_SEC, end);
    windows.push({ since, until });
    since = until;
  }
  return windows;
}

export function classifyInsightError(error: unknown): InsightIssue {
  if (!(error instanceof InstagramApiError)) return "unsupported";
  if (error.rateLimited) return "rate_limited";
  const lower = error.message.toLowerCase();
  if (error.permissionMissing || lower.includes("manage_insights")) return "permission";
  if (
    lower.includes("professional account") ||
    lower.includes("business account") ||
    lower.includes("creator account") ||
    lower.includes("not a business")
  ) {
    return "not_professional";
  }
  if (lower.includes("100 followers") || lower.includes("fewer than")) return "small_account";
  return "unsupported";
}

function rethrowIfFatal(error: unknown): void {
  if (error instanceof InstagramApiError && (error.tokenInvalid || error.rateLimited)) throw error;
  if (!(error instanceof InstagramApiError)) throw error;
}

/** Sums `total_value.value` for each metric in a response. A metric left out of `data` counts as 0. */
export function parseTotalValues(rows: unknown, metrics: readonly string[]): Map<string, number> {
  const values = new Map<string, number>(metrics.map((metric) => [metric, 0]));
  if (!Array.isArray(rows)) return values;
  for (const row of rows) {
    const item = asObject(row);
    const name = text(item?.name);
    if (!name) continue;
    const value = count(asObject(item?.total_value)?.value);
    if (value !== null) values.set(name, value);
  }
  return values;
}

/** `period=day` rows end at the close of the day they describe. */
export function parseDailySeries(rows: unknown, metric: string): { day: string; value: number }[] {
  if (!Array.isArray(rows)) return [];
  const out: { day: string; value: number }[] = [];
  for (const row of rows) {
    const item = asObject(row);
    if (text(item?.name) !== metric || !Array.isArray(item?.values)) continue;
    for (const entry of item.values) {
      const point = asObject(entry);
      const value = count(point?.value);
      const end = text(point?.end_time).replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
      const time = Date.parse(end);
      if (value === null || Number.isNaN(time)) continue;
      out.push({ day: new Date(time - DAY_SEC * 1000).toISOString().slice(0, 10), value });
    }
  }
  return out;
}

export function parseFollowBreakdown(rows: unknown): { gained: number; lost: number } | null {
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    const item = asObject(row);
    if (text(item?.name) !== "follows_and_unfollows") continue;
    const total = asObject(item?.total_value);
    let gained = 0;
    let lost = 0;
    const breakdowns = Array.isArray(total?.breakdowns) ? total.breakdowns : [];
    for (const breakdown of breakdowns) {
      const results = asObject(breakdown)?.results;
      if (!Array.isArray(results)) continue;
      for (const result of results) {
        const entry = asObject(result);
        const kind = Array.isArray(entry?.dimension_values) ? text(entry.dimension_values[0]) : "";
        const value = count(entry?.value) ?? 0;
        if (kind === "FOLLOWER") gained += value;
        else if (kind === "NON_FOLLOWER") lost += value;
      }
    }
    return { gained, lost };
  }
  return { gained: 0, lost: 0 };
}

export async function fetchAccountInsights(input: {
  ctx: GraphContext;
  igUserId: string;
  range: PeriodRange;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<AccountInsightsFetch> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const windows = insightWindows(input.range, input.now);
  const result: AccountInsightsFetch = {
    totals: {},
    failed: {},
    reachDaily: [],
    reachIssue: null,
    follows: { gained: 0, lost: 0 },
    followsIssue: null,
    chunks: windows.length,
  };
  const path = `${input.igUserId}/insights`;
  let active: AccountMetric[] = [...ACCOUNT_METRICS];

  for (const window of windows) {
    const range = { since: String(window.since), until: String(window.until) };
    if (active.length > 0) {
      try {
        const { body } = await graphGet(
          graphUrl(input.ctx, path, { metric: active.join(","), period: "day", metric_type: "total_value", ...range }),
          fetchImpl,
        );
        addTotals(result, parseTotalValues(body.data, active));
      } catch (error) {
        rethrowIfFatal(error);
        const issue = classifyInsightError(error);
        if (issue === "permission" || issue === "not_professional") {
          for (const metric of active) result.failed[metric] = issue;
          active = [];
        } else {
          const working: AccountMetric[] = [];
          for (const metric of active) {
            try {
              const { body } = await graphGet(
                graphUrl(input.ctx, path, { metric, period: "day", metric_type: "total_value", ...range }),
                fetchImpl,
              );
              addTotals(result, parseTotalValues(body.data, [metric]));
              working.push(metric);
            } catch (single) {
              rethrowIfFatal(single);
              result.failed[metric] = classifyInsightError(single);
            }
          }
          active = working;
        }
      }
    }

    if (result.reachDaily) {
      try {
        const { body } = await graphGet(
          graphUrl(input.ctx, path, { metric: "reach", period: "day", metric_type: "time_series", ...range }),
          fetchImpl,
        );
        result.reachDaily.push(...parseDailySeries(body.data, "reach"));
      } catch (error) {
        rethrowIfFatal(error);
        result.reachDaily = null;
        result.reachIssue = classifyInsightError(error);
      }
    }

    if (result.follows) {
      try {
        const { body } = await graphGet(
          graphUrl(input.ctx, path, {
            metric: "follows_and_unfollows",
            period: "day",
            metric_type: "total_value",
            breakdown: "follow_type",
            ...range,
          }),
          fetchImpl,
        );
        const follows = parseFollowBreakdown(body.data);
        if (follows) {
          result.follows.gained += follows.gained;
          result.follows.lost += follows.lost;
        }
      } catch (error) {
        rethrowIfFatal(error);
        result.follows = null;
        const issue = classifyInsightError(error);
        result.followsIssue = issue === "unsupported" ? "small_account" : issue;
      }
    }
  }

  for (const metric of Object.keys(result.failed) as AccountMetric[]) delete result.totals[metric];
  if (result.reachDaily) {
    const byDay = new Map<string, number>();
    for (const point of result.reachDaily) byDay.set(point.day, point.value);
    result.reachDaily = [...byDay.entries()].map(([day, value]) => ({ day, value })).sort((a, b) => a.day.localeCompare(b.day));
  }
  return result;
}

function addTotals(result: AccountInsightsFetch, values: Map<string, number>): void {
  for (const [metric, value] of values) {
    const key = metric as AccountMetric;
    result.totals[key] = (result.totals[key] ?? 0) + value;
  }
}

export async function collectYearMedia(input: {
  ctx: GraphContext;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<MediaFetch> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const cutoff = periodRange("year", input.now).startDate;
  const posts: InstagramPostStat[] = [];
  const seen = new Set<string>();
  let next: string | null = null;
  let incomplete = true;
  for (let page = 0; page < MEDIA_PAGE_CAP; page += 1) {
    const result = await fetchMediaPage(input.ctx, { next, limit: MEDIA_PAGE_SIZE, fetchImpl });
    let oldest: string | null = null;
    for (const media of result.media) {
      if (seen.has(media.id)) continue;
      seen.add(media.id);
      const day = publishDay(media.timestamp);
      if (day && (oldest === null || day < oldest)) oldest = day;
      if (!day || day >= cutoff) posts.push({ ...media, insights: null });
    }
    if (!result.next || (oldest !== null && oldest < cutoff)) {
      incomplete = false;
      break;
    }
    next = result.next;
  }

  let insightsIssue: InsightIssue | null = null;
  const newest = [...posts].sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? "")).slice(0, MEDIA_INSIGHTS_CAP);
  for (const post of newest) {
    try {
      post.insights = await fetchMediaInsights(input.ctx, post.id, fetchImpl);
    } catch (error) {
      rethrowIfFatal(error);
      const issue = classifyInsightError(error);
      if (issue === "permission" || issue === "not_professional") {
        insightsIssue = issue;
        break;
      }
    }
  }
  return { posts, incomplete, insightsIssue };
}

export function buildInstagramPeriodSummary(input: {
  period: AnalyticsPeriod;
  now: Date;
  account: AccountInsightsFetch | null;
  accountIssue?: InsightIssue | null;
  media: MediaFetch;
  currentFollowers: number | null;
  snapshots: FollowerSnapshot[];
}): InstagramPeriodSummary {
  const range = periodRange(input.period, input.now);
  const posts = input.media.posts
    .filter((post) => {
      const day = publishDay(post.timestamp);
      return day !== null && day >= range.startDate && day <= range.endDate;
    })
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));

  const postSum = (pick: (post: InstagramPostStat) => number | null): MetricTotal => {
    let total: number | null = posts.length === 0 ? 0 : null;
    for (const post of posts) {
      const value = pick(post);
      if (value !== null) total = (total ?? 0) + value;
    }
    return total === null ? null : { value: total, source: "posts" };
  };
  const fromAccount = (metric: AccountMetric): MetricTotal => {
    const value = input.account?.totals[metric];
    return typeof value === "number" ? { value, source: "account" } : null;
  };

  const totals: InstagramTotals = {
    views: fromAccount("views") ?? postSum((post) => post.insights?.views ?? null),
    reach: fromAccount("reach") ?? postSum((post) => post.insights?.reach ?? null),
    likes: fromAccount("likes") ?? postSum((post) => post.insights?.likes ?? post.likeCount),
    comments: fromAccount("comments") ?? postSum((post) => post.insights?.comments ?? post.commentsCount),
    shares: fromAccount("shares") ?? postSum((post) => post.insights?.shares ?? null),
    saves: fromAccount("saves") ?? postSum((post) => post.insights?.saved ?? null),
    interactions: fromAccount("total_interactions") ?? postSum((post) => post.insights?.totalInteractions ?? null),
    engaged: fromAccount("accounts_engaged"),
  };

  const reachByDay = new Map((input.account?.reachDaily ?? []).map((point) => [point.day, point.value]));
  const viewsByDay = new Map<string, number>();
  for (const post of posts) {
    const day = publishDay(post.timestamp);
    if (!day) continue;
    viewsByDay.set(day, (viewsByDay.get(day) ?? 0) + (post.insights?.views ?? 0));
  }
  const hasReach = Boolean(input.account?.reachDaily && input.account.reachDaily.length > 0);
  const days: InstagramChartDay[] =
    hasReach || viewsByDay.size > 0
      ? eachDay(range).map((day) => ({
          day,
          reach: hasReach ? (reachByDay.get(day) ?? 0) : null,
          views: viewsByDay.get(day) ?? 0,
        }))
      : [];

  return {
    range,
    totals,
    followers: {
      current: input.currentFollowers,
      gained: input.account?.follows?.gained ?? null,
      lost: input.account?.follows?.lost ?? null,
      snapshot: followerReadout(input.snapshots, range),
    },
    days,
    posts,
    postCount: posts.length,
    notices: buildNotices(input, posts.length),
    chunked: (input.account?.chunks ?? 0) > 1,
  };
}

function buildNotices(
  input: { account: AccountInsightsFetch | null; accountIssue?: InsightIssue | null; media: MediaFetch },
  postCount: number,
): InstagramNotice[] {
  const notices: InstagramNotice[] = [];
  const issues = new Set<InsightIssue>();
  if (input.accountIssue) issues.add(input.accountIssue);
  for (const issue of Object.values(input.account?.failed ?? {})) if (issue) issues.add(issue);
  if (input.media.insightsIssue) issues.add(input.media.insightsIssue);
  if (input.account?.reachIssue) issues.add(input.account.reachIssue);

  if (issues.has("permission")) {
    notices.push({
      code: "insights_permission",
      textAr:
        "صلاحية الإحصاءات (instagram_manage_insights في Unified login، أو instagram_business_manage_insights في الإعداد القديم) غير ممنوحة لهذا الربط، فالمشاهدات والوصول والحفظ والمشاركات غير متاحة. اقطع الربط ثم اربط مجدداً ووافق على الإحصاءات، وتأكد أنها مضافة إلى إعداد config_id في Meta.",
    });
  }
  if (issues.has("not_professional")) {
    notices.push({
      code: "not_professional",
      textAr: "الإحصاءات متاحة لحسابات Instagram الاحترافية فقط. حوّل الحساب إلى أعمال أو صانع محتوى من إعدادات Instagram ثم أعد الربط.",
    });
  }
  if (issues.has("rate_limited")) {
    notices.push({ code: "rate_limited", textAr: "Meta حدّت الطلبات مؤقتاً، فبعض الأرقام ناقصة. حدّث الصفحة بعد قليل." });
  }
  const unsupported = Object.entries(input.account?.failed ?? {})
    .filter(([, issue]) => issue === "unsupported")
    .map(([metric]) => metric);
  if (unsupported.length > 0) {
    notices.push({
      code: "metric_unavailable",
      textAr: `لم تُعِد Meta هذه المقاييس على مستوى الحساب: ${unsupported.join("، ")}. يُعرض بدلها مجموع منشورات الفترة إن توفر.`,
    });
  }
  if (input.account && !input.account.follows) {
    notices.push({
      code: "follows_unavailable",
      textAr:
        input.account.followsIssue === "permission"
          ? "المتابعون الجدد يحتاجون صلاحية الإحصاءات."
          : "Meta لا تعيد المتابعين الجدد للحسابات التي لديها أقل من ١٠٠ متابع. يُعرض صافي التغيّر من لقطات يومية يحفظها التطبيق.",
    });
  }
  if (input.media.incomplete) {
    notices.push({ code: "media_incomplete", textAr: "المنشورات خلال السنة أكثر مما يُجلب دفعة واحدة، فمجاميع المنشورات تغطي الأحدث فقط." });
  }
  if (postCount > MEDIA_INSIGHTS_CAP) {
    notices.push({
      code: "media_insights_cap",
      textAr: `إحصاءات كل منشور تُقرأ لأحدث ${MEDIA_INSIGHTS_CAP} منشوراً فقط.`,
    });
  }
  return notices;
}

function eachDay(range: PeriodRange): string[] {
  const days: string[] = [];
  let cursor = Date.parse(`${range.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${range.endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += DAY_SEC * 1000;
  }
  return days;
}

export function previewInstagramSummary(now: Date, period: AnalyticsPeriod): InstagramPeriodSummary {
  const year = periodRange("year", now);
  const days = eachDay(year);
  const current = 4820;
  const snapshots: FollowerSnapshot[] = days.map((day, index) => ({ day, followers: current - (days.length - 1 - index) * 3 }));
  const posts: InstagramPostStat[] = days
    .filter((_, index) => index % 4 === 0)
    .map((day, index) => ({
      id: `preview-${day}`,
      caption: index % 2 === 0 ? "رحلة اليوم فوق الغيوم ✈️" : "لقطة من قمرة القيادة",
      mediaType: index % 3 === 0 ? "VIDEO" : "IMAGE",
      productType: index % 3 === 0 ? "REELS" : "FEED",
      permalink: null,
      thumbnailUrl: null,
      timestamp: `${day}T14:00:00.000Z`,
      likeCount: 40 + (index % 7) * 9,
      commentsCount: 2 + (index % 5),
      insights: {
        views: 900 + (index % 11) * 140,
        reach: 600 + (index % 9) * 70,
        likes: 40 + (index % 7) * 9,
        comments: 2 + (index % 5),
        shares: index % 6,
        saved: index % 4,
        totalInteractions: 50 + (index % 7) * 10,
      },
    }));
  const range = periodRange(period, now);
  const inRange = days.filter((day) => day >= range.startDate && day <= range.endDate);
  const account: AccountInsightsFetch = {
    totals: {
      views: inRange.length * 410,
      reach: inRange.length * 190,
      accounts_engaged: inRange.length * 22,
      total_interactions: inRange.length * 31,
      likes: inRange.length * 24,
      comments: inRange.length * 3,
      shares: inRange.length * 2,
      saves: inRange.length * 2,
    },
    failed: {},
    reachDaily: inRange.map((day, index) => ({ day, value: 150 + (index % 9) * 18 })),
    reachIssue: null,
    follows: { gained: inRange.length * 4, lost: inRange.length },
    followsIssue: null,
    chunks: Math.ceil(inRange.length / INSIGHTS_CHUNK_DAYS),
  };
  return buildInstagramPeriodSummary({
    period,
    now,
    account,
    media: { posts, incomplete: false, insightsIssue: null },
    currentFollowers: current,
    snapshots,
  });
}
