"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ErrorNotice } from "@/components/error-notice";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { navigateTopLevel } from "@/lib/navigate";
import {
  ANALYTICS_PERIODS,
  type AnalyticsDay,
  type AnalyticsPeriod,
  type AnalyticsSummary,
} from "@/lib/providers/youtube/analytics";
import type { UserFacingError } from "@/lib/providers/types";

export function YouTubeAnalytics({
  period,
  summary,
  days,
  currentSubscribers,
  hiddenSubscribers,
  needsScope,
  failure,
}: {
  period: AnalyticsPeriod;
  summary: AnalyticsSummary | null;
  days: AnalyticsDay[];
  currentSubscribers: number | null;
  hiddenSubscribers: boolean;
  needsScope: boolean;
  failure: UserFacingError | null;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">ملخص الفترة</h2>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">
            المشاهدات والإعجابات والتعليقات والمشاركات، مع تغيّر المشتركين، من YouTube Analytics.
          </p>
        </div>
        <PeriodSwitch period={period} />
      </div>

      {needsScope ? (
        <div className="space-y-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
          <p className="text-sm leading-7">
            الربط الحالي لا يشمل صلاحية تحليلات YouTube. أعد الربط مرة واحدة لتظهر شاشة موافقة Google وتمنح قراءة
            التقارير.
          </p>
          <Button type="button" className="h-10" onClick={() => navigateTopLevel("/api/auth/youtube/start")}>
            إعادة الربط والموافقة
          </Button>
        </div>
      ) : null}

      {failure ? <ErrorNotice error={failure} /> : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="المشاهدات" value={formatCount(summary.views)} />
            <Stat label="الإعجابات" value={formatCount(summary.likes)} />
            <Stat label="التعليقات" value={formatCount(summary.comments)} />
            <Stat label="المشاركات" value={formatCount(summary.shares)} />
            <Stat
              label="المشتركون الآن"
              value={formatCount(currentSubscribers, hiddenSubscribers)}
              note={hiddenSubscribers ? "صاحب القناة أخفى العدد" : "الإجمالي الحالي للقناة"}
            />
            <Stat label="مشتركون جدد" value={formatCount(summary.subscribersGained)} />
            <Stat label="مشتركون غادروا" value={formatCount(summary.subscribersLost)} />
            <Stat label="صافي المشتركين" value={formatNet(summary.subscribersNet)} note="المكتسبون ناقص من غادر" />
          </div>
          <DailyChart days={days} />
        </>
      ) : null}
    </section>
  );
}

function PeriodSwitch({ period }: { period: AnalyticsPeriod }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div className="flex rounded-xl bg-muted p-1">
      {ANALYTICS_PERIODS.map((item) => {
        const next = new URLSearchParams(params);
        next.set("period", item.id);
        const active = item.id === period;
        return (
          <Link
            key={item.id}
            href={`${pathname}?${next.toString()}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${active ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function DailyChart({ days }: { days: AnalyticsDay[] }) {
  if (days.length === 0) {
    return (
      <p className="rounded-2xl bg-card p-5 text-sm leading-7 text-muted-foreground ring-1 ring-foreground/10">
        لا توجد أيام مسجّلة في هذه الفترة.
      </p>
    );
  }
  const width = 640;
  const height = 168;
  const maxViews = Math.max(...days.map((day) => day.views), 1);
  const maxLikes = Math.max(...days.map((day) => day.likes), 1);
  const step = width / Math.max(days.length - 1, 1);
  const line = (value: (day: AnalyticsDay) => number, max: number) =>
    days
      .map((day, index) => {
        const x = days.length === 1 ? width / 2 : index * step;
        const y = height - 12 - (value(day) / max) * (height - 24);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">المشاهدات والإعجابات يومياً</h3>
        <p className="flex gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#d0121a]" />
            مشاهدات
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#1f6f54]" />
            إعجابات
          </span>
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="مشاهدات وإعجابات يومية">
        <polyline fill="none" stroke="#d0121a" strokeWidth="2.5" points={line((day) => day.views, maxViews)} />
        <polyline fill="none" stroke="#1f6f54" strokeWidth="2.5" points={line((day) => day.likes, maxLikes)} />
      </svg>
      <p className="text-xs leading-6 text-muted-foreground" dir="ltr">
        {days[0]?.day} — {days[days.length - 1]?.day}
        <span className="px-2" dir="rtl">
          كل خط بمقياسه
        </span>
      </p>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {note ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function formatNet(value: number): string {
  const text = formatCount(Math.abs(value));
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return text;
}
