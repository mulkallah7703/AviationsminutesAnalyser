import type { AnalyticsPeriod } from "@/lib/providers/youtube/analytics";
import { periodRange, type PeriodRange } from "@/lib/providers/youtube/analytics";

export type LinkedInPreviewPost = {
  id: string;
  text: string;
  createdAt: string;
  impressions: number;
  reactions: number;
  comments: number;
  reshares: number;
};

export type LinkedInPreviewDay = {
  day: string;
  impressions: number;
  reactions: number;
};

export type LinkedInPreviewSummary = {
  totals: {
    impressions: number;
    reactions: number;
    comments: number;
    reshares: number;
    postCount: number;
  };
  days: LinkedInPreviewDay[];
  posts: LinkedInPreviewPost[];
};

const TEXTS = ["ملاحظة عن العمل هذا الأسبوع.", "مشاركة قصيرة مع الزملاء.", "رابط لمقالة مفيدة."];

/** Sample series for `/linkedin?preview=mock` only. A standard app cannot read these metrics. */
export function previewLinkedInSummary(now: Date, period: AnalyticsPeriod): LinkedInPreviewSummary {
  const year = periodRange("year", now);
  const posts = eachUtcDay(year).flatMap((day, index) => {
    if (index % 11 !== 0) return [];
    return [
      {
        id: `preview-${day}`,
        text: TEXTS[index % TEXTS.length] ?? TEXTS[0],
        createdAt: `${day}T09:00:00.000Z`,
        impressions: 80 + (index % 9) * 15,
        reactions: 3 + (index % 4),
        comments: index % 3,
        reshares: index % 2,
      },
    ];
  });
  return summarizePreview(posts, periodRange(period, now));
}

export function summarizePreview(posts: LinkedInPreviewPost[], range: PeriodRange): LinkedInPreviewSummary {
  const included = posts.filter((post) => {
    const day = post.createdAt.slice(0, 10);
    return day >= range.startDate && day <= range.endDate;
  });
  const byDay = new Map<string, LinkedInPreviewDay>();
  const totals = { impressions: 0, reactions: 0, comments: 0, reshares: 0, postCount: included.length };
  for (const post of included) {
    const day = post.createdAt.slice(0, 10);
    const current = byDay.get(day) ?? { day, impressions: 0, reactions: 0 };
    current.impressions += post.impressions;
    current.reactions += post.reactions;
    byDay.set(day, current);
    totals.impressions += post.impressions;
    totals.reactions += post.reactions;
    totals.comments += post.comments;
    totals.reshares += post.reshares;
  }
  return {
    totals,
    days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    posts: [...included].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
  };
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
