"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { formatCount, formatPublished } from "@/lib/format";
import type { LinkedInPreviewDay, LinkedInPreviewSummary } from "@/lib/providers/linkedin/preview";
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "@/lib/providers/youtube/analytics";

export function LinkedInPreviewAnalytics({
  period,
  summary,
}: {
  period: AnalyticsPeriod;
  summary: LinkedInPreviewSummary;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">ملخص الفترة — بيانات تجريبية</h2>
          <p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
            هذه البطاقات والرسم لعرض شكل الشهر و٣ أشهر والسنة. حساب مربوط عبر Sign in with LinkedIn لا يستلم الظهور
            ولا التفاعل ولا عدد المنشورات، لذلك لا تُعرض أرقام مكانها في الصفحة الحقيقية.
          </p>
        </div>
        <PeriodSwitch period={period} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="الظهور" value={formatCount(summary.totals.impressions)} />
        <Stat label="التفاعلات" value={formatCount(summary.totals.reactions)} />
        <Stat label="التعليقات" value={formatCount(summary.totals.comments)} />
        <Stat label="إعادات المشاركة" value={formatCount(summary.totals.reshares)} />
        <Stat label="منشورات الفترة" value={formatCount(summary.totals.postCount)} note="عيّنة مولَّدة للمعاينة" />
      </div>
      <DailyChart days={summary.days} />
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">منشورات تجريبية</h3>
        {summary.posts.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-sm leading-7 text-muted-foreground ring-1 ring-foreground/10">
            لا توجد منشورات تجريبية في هذه الفترة.
          </p>
        ) : (
          <ul className="space-y-3">
            {summary.posts.map((post) => (
              <li key={post.id} className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
                <p className="text-sm leading-7">{post.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatPublished(post.createdAt)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatCount(post.impressions)} ظهور · {formatCount(post.reactions)} تفاعل · {formatCount(post.comments)}{" "}
                  تعليق · {formatCount(post.reshares)} إعادة مشاركة
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
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

function DailyChart({ days }: { days: LinkedInPreviewDay[] }) {
  if (days.length === 0) {
    return (
      <p className="rounded-2xl bg-card p-5 text-sm leading-7 text-muted-foreground ring-1 ring-foreground/10">
        لا توجد نقاط تجريبية في هذه الفترة.
      </p>
    );
  }
  const width = 640;
  const height = 168;
  const maxImpressions = Math.max(...days.map((day) => day.impressions), 1);
  const maxReactions = Math.max(...days.map((day) => day.reactions), 1);
  const step = width / Math.max(days.length - 1, 1);
  const line = (value: (day: LinkedInPreviewDay) => number, max: number) =>
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
        <h3 className="text-sm font-medium">الظهور والتفاعلات حسب يوم النشر</h3>
        <p className="flex gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#0a66c2]" />
            ظهور
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#70b5f9]" />
            تفاعلات
          </span>
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="ظهور وتفاعلات تجريبية حسب يوم النشر">
        <polyline fill="none" stroke="#0a66c2" strokeWidth="2.5" points={line((day) => day.impressions, maxImpressions)} />
        <polyline fill="none" stroke="#70b5f9" strokeWidth="2.5" points={line((day) => day.reactions, maxReactions)} />
      </svg>
      <p className="text-xs leading-6 text-muted-foreground" dir="ltr">
        {days[0]?.day} — {days[days.length - 1]?.day}
        <span className="px-2" dir="rtl">
          يوم النشر · كل خط بمقياسه
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
