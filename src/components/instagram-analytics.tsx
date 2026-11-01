"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ErrorNotice } from "@/components/error-notice";
import { formatCount, formatUtcDay } from "@/lib/format";
import type { InstagramChartDay, InstagramPeriodSummary, MetricTotal } from "@/lib/providers/instagram/analytics";
import type { UserFacingError } from "@/lib/providers/types";
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "@/lib/providers/youtube/analytics";

const UNAVAILABLE = "غير متاح من Meta لهذا الحساب أو هذه الصلاحيات.";

export function InstagramAnalytics({
  period,
  summary,
  failure,
}: {
  period: AnalyticsPeriod;
  summary: InstagramPeriodSummary | null;
  failure: UserFacingError | null;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">ملخص الفترة</h2>
          <p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
            الأرقام من إحصاءات حساب Instagram خلال الفترة، وإن لم تتوفر فمن مجموع منشورات الفترة. قد تتأخر بيانات Meta حتى
            ٤٨ ساعة.
          </p>
        </div>
        <PeriodSwitch period={period} />
      </div>

      {failure ? <ErrorNotice error={failure} /> : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricStat label="المشاهدات" total={summary.totals.views} />
            <MetricStat
              label="الوصول"
              total={summary.totals.reach}
              extra={summary.chunked && summary.totals.reach?.source === "account" ? "تقريبي: مجموع فترات من ٢٩ يوماً." : undefined}
            />
            <MetricStat label="الإعجابات" total={summary.totals.likes} />
            <MetricStat label="التعليقات" total={summary.totals.comments} />
            <MetricStat label="المشاركات" total={summary.totals.shares} />
            <MetricStat label="الحفظ" total={summary.totals.saves} />
            <MetricStat label="إجمالي التفاعلات" total={summary.totals.interactions} />
            <MetricStat label="الحسابات المتفاعلة" total={summary.totals.engaged} />
            <Stat label="المتابعون الآن" value={formatCount(summary.followers.current)} note="العدد الحالي من Instagram" />
            <NewFollowers summary={summary} />
            <Stat label="منشورات الفترة" value={formatCount(summary.postCount)} note="نُشرت خلال الفترة المحددة" />
          </div>
          {summary.notices.length > 0 ? (
            <ul className="space-y-2 rounded-2xl bg-muted/50 p-4 text-sm leading-7 text-muted-foreground">
              {summary.notices.map((notice) => (
                <li key={notice.code}>• {notice.textAr}</li>
              ))}
            </ul>
          ) : null}
          <DailyChart days={summary.days} />
        </>
      ) : null}
    </section>
  );
}

function MetricStat({ label, total, extra }: { label: string; total: MetricTotal; extra?: string }) {
  if (!total) return <Stat label={label} value="—" note={UNAVAILABLE} />;
  const source = total.source === "account" ? "من إحصاءات الحساب" : "مجموع منشورات الفترة";
  return <Stat label={label} value={formatCount(total.value)} note={extra ? `${source} · ${extra}` : source} />;
}

function NewFollowers({ summary }: { summary: InstagramPeriodSummary }) {
  const { gained, lost, snapshot } = summary.followers;
  if (gained !== null) {
    return (
      <Stat
        label="المتابعون الجدد"
        value={formatCount(gained)}
        note={lost !== null ? `ألغى المتابعة ${formatCount(lost)} · الصافي ${formatNet(gained - lost)}` : "من إحصاءات الحساب"}
      />
    );
  }
  if (snapshot.covered) {
    return (
      <Stat
        label="صافي المتابعين"
        value={formatNet(snapshot.net)}
        note="من لقطات يومية يحفظها التطبيق. Meta لا تعيد المتابعين الجدد لهذا الحساب."
      />
    );
  }
  const since = snapshot.since ? formatUtcDay(snapshot.since) : null;
  return (
    <Stat
      label="المتابعون الجدد"
      value="—"
      note={
        since
          ? `غير متاح من Meta. يُجمع سجل المتابعين منذ ${since}، ويظهر الصافي عندما يغطي بداية الفترة.`
          : "غير متاح من Meta. ستُحفظ لقطة يومية لعدد المتابعين لحساب الصافي."
      }
    />
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

function DailyChart({ days }: { days: InstagramChartDay[] }) {
  if (days.length === 0) {
    return (
      <p className="rounded-2xl bg-card p-5 text-sm leading-7 text-muted-foreground ring-1 ring-foreground/10">
        لا توجد بيانات يومية لهذه الفترة بعد.
      </p>
    );
  }
  const width = 640;
  const height = 168;
  const hasReach = days.some((day) => day.reach !== null);
  const maxReach = Math.max(...days.map((day) => day.reach ?? 0), 1);
  const maxViews = Math.max(...days.map((day) => day.views), 1);
  const step = width / Math.max(days.length - 1, 1);
  const line = (value: (day: InstagramChartDay) => number, max: number) =>
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
        <h3 className="text-sm font-medium">الوصول اليومي ومشاهدات المنشورات</h3>
        <p className="flex gap-3 text-xs text-muted-foreground">
          {hasReach ? (
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#c13584]" />
              وصول الحساب يومياً
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#1f6f54]" />
            مشاهدات حسب يوم النشر
          </span>
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="الوصول اليومي ومشاهدات المنشورات">
        {hasReach ? (
          <polyline fill="none" stroke="#c13584" strokeWidth="2.5" points={line((day) => day.reach ?? 0, maxReach)} />
        ) : null}
        <polyline fill="none" stroke="#1f6f54" strokeWidth="2.5" points={line((day) => day.views, maxViews)} />
      </svg>
      <p className="text-xs leading-6 text-muted-foreground" dir="ltr">
        {days[0]?.day} — {days[days.length - 1]?.day}
        <span className="px-2" dir="rtl">
          {hasReach ? "كل خط بمقياسه" : "الوصول اليومي غير متاح · كل خط بمقياسه"}
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
