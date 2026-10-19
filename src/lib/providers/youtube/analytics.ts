import { YouTubeApiError } from "@/lib/providers/youtube/api";
import { YOUTUBE_ANALYTICS_SCOPE } from "@/lib/providers/youtube/config";

export const ANALYTICS_METRICS = [
  "views",
  "likes",
  "comments",
  "shares",
  "subscribersGained",
  "subscribersLost",
] as const;

export type AnalyticsPeriod = "month" | "quarter" | "year";

export const ANALYTICS_PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: "month", label: "شهر" },
  { id: "quarter", label: "3 أشهر" },
  { id: "year", label: "سنة" },
];

export type AnalyticsDay = {
  day: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
};

export type AnalyticsSummary = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
  subscribersNet: number;
};

export type PeriodRange = {
  startDate: string;
  endDate: string;
};

const METRIC_KEYS = new Set<string>(ANALYTICS_METRICS);

export function parseAnalyticsPeriod(value: string | undefined): AnalyticsPeriod {
  if (value === "quarter" || value === "year" || value === "month") return value;
  return "month";
}

export function hasAnalyticsScope(scope: string | null | undefined): boolean {
  return (scope ?? "").split(/[\s,]+/).includes(YOUTUBE_ANALYTICS_SCOPE);
}

export function periodRange(period: AnalyticsPeriod, now: Date): PeriodRange {
  const end = utcMidnight(now);
  const months = period === "month" ? -1 : period === "quarter" ? -3 : -12;
  return { startDate: formatDay(addUtcMonths(end, months)), endDate: formatDay(end) };
}

export function summarizeDays(days: AnalyticsDay[], range?: PeriodRange): AnalyticsSummary {
  const included = range ? days.filter((day) => day.day >= range.startDate && day.day <= range.endDate) : days;
  const summary: AnalyticsSummary = {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    subscribersGained: 0,
    subscribersLost: 0,
    subscribersNet: 0,
  };
  for (const day of included) {
    summary.views += day.views;
    summary.likes += day.likes;
    summary.comments += day.comments;
    summary.shares += day.shares;
    summary.subscribersGained += day.subscribersGained;
    summary.subscribersLost += day.subscribersLost;
  }
  summary.subscribersNet = summary.subscribersGained - summary.subscribersLost;
  return summary;
}

export function parseAnalyticsReport(payload: unknown): AnalyticsDay[] {
  const body = asObject(payload);
  const headers = asArray(body?.columnHeaders)
    .map((header) => asObject(header)?.name)
    .map((name) => (typeof name === "string" ? name : ""));
  const dayIndex = headers.indexOf("day");
  if (dayIndex < 0) return [];
  const metricIndex = new Map<string, number>();
  headers.forEach((name, index) => {
    if (METRIC_KEYS.has(name)) metricIndex.set(name, index);
  });

  const days: AnalyticsDay[] = [];
  for (const row of asArray(body?.rows)) {
    if (!Array.isArray(row)) continue;
    const day = typeof row[dayIndex] === "string" ? row[dayIndex] : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    days.push({
      day,
      views: cell(row, metricIndex.get("views")),
      likes: cell(row, metricIndex.get("likes")),
      comments: cell(row, metricIndex.get("comments")),
      shares: cell(row, metricIndex.get("shares")),
      subscribersGained: cell(row, metricIndex.get("subscribersGained")),
      subscribersLost: cell(row, metricIndex.get("subscribersLost")),
    });
  }
  days.sort((a, b) => a.day.localeCompare(b.day));
  return days;
}

export function analyticsReportUrl(range: PeriodRange): string {
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", range.startDate);
  url.searchParams.set("endDate", range.endDate);
  url.searchParams.set("metrics", ANALYTICS_METRICS.join(","));
  url.searchParams.set("dimensions", "day");
  url.searchParams.set("sort", "day");
  return url.toString();
}

export async function fetchYouTubeAnalytics(input: {
  accessToken: string;
  period: AnalyticsPeriod;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<{ range: PeriodRange; days: AnalyticsDay[]; summary: AnalyticsSummary }> {
  const range = periodRange(input.period, input.now ?? new Date());
  const response = await (input.fetchImpl ?? fetch)(analyticsReportUrl(range), {
    headers: { Authorization: `Bearer ${input.accessToken}`, Accept: "application/json" },
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = asObject(asObject(payload)?.error);
    const details = asArray(error?.errors);
    const reason = asObject(details[0])?.reason;
    const message = typeof error?.message === "string" ? error.message : "";
    throw new YouTubeApiError(
      response.status,
      typeof reason === "string" ? reason : "",
      message || `HTTP ${response.status}`,
    );
  }
  const days = parseAnalyticsReport(payload);
  return { range, days, summary: summarizeDays(days, range) };
}

export function previewAnalyticsDays(now: Date): AnalyticsDay[] {
  const year = periodRange("year", now);
  const days: AnalyticsDay[] = [];
  let cursor = parseDay(year.startDate);
  const end = parseDay(year.endDate);
  let index = 0;
  while (cursor.getTime() <= end.getTime()) {
    days.push({
      day: formatDay(cursor),
      views: 80 + (index % 13) * 25,
      likes: 4 + (index % 7),
      comments: index % 5,
      shares: index % 3,
      subscribersGained: index % 6 === 0 ? 3 : 1,
      subscribersLost: index % 9 === 0 ? 1 : 0,
    });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    index += 1;
  }
  return days;
}

function cell(row: unknown[], index: number | undefined): number {
  if (index === undefined) return 0;
  const value = row[index];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcMonths(date: Date, months: number): Date {
  const monthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

function parseDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

function formatDay(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}
