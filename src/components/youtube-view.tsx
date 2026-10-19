import Image from "next/image";
import Link from "next/link";
import { ConnectActions } from "@/components/connect-actions";
import { DisconnectButton } from "@/components/disconnect-button";
import { ErrorNotice } from "@/components/error-notice";
import { RefreshButton } from "@/components/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { YouTubeAnalytics } from "@/components/youtube-analytics";
import { formatCount, formatPublished } from "@/lib/format";
import type { ProviderMeta, UserFacingError } from "@/lib/providers/types";
import type { AnalyticsDay, AnalyticsPeriod, AnalyticsSummary } from "@/lib/providers/youtube/analytics";
import type { YouTubeAccount } from "@/lib/providers/youtube/api";

const thumbTones = ["#8c3a2f", "#3f5c4b", "#3d4d6b"];

export function YouTubeView({
  meta,
  account,
  failure,
  justConnected,
  preview,
  enabled,
  signedIn,
  period,
  analyticsSummary,
  analyticsDays,
  needsAnalyticsScope,
  analyticsFailure,
}: {
  meta: ProviderMeta;
  account: YouTubeAccount | null;
  failure: UserFacingError | null;
  justConnected: boolean;
  preview: boolean;
  enabled: boolean;
  signedIn: boolean;
  period: AnalyticsPeriod;
  analyticsSummary: AnalyticsSummary | null;
  analyticsDays: AnalyticsDay[];
  needsAnalyticsScope: boolean;
  analyticsFailure: UserFacingError | null;
}) {
  const target = {
    id: meta.id,
    name: meta.name,
    availability: meta.availability,
    pagePath: meta.pagePath,
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            → العودة إلى اللوحة
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">YouTube</h1>
        </div>
        {account ? (
          <div className="flex flex-wrap gap-2">
            <RefreshButton />
            <ConnectActions target={target} connected enabled={enabled} signedIn={signedIn} variant="page" />
            <DisconnectButton platform="youtube" />
          </div>
        ) : null}
      </div>

      {preview ? (
        <Alert>
          <AlertTitle>معاينة ببيانات تجريبية</AlertTitle>
          <AlertDescription className="leading-7">
            هذه الأرقام ليست من حساب مربوط. الصفحة نفسها تعرض القناة وملخص YouTube Analytics بعد موافقة Google.
          </AlertDescription>
        </Alert>
      ) : null}

      {justConnected && account ? (
        <Alert>
          <AlertTitle>تم الربط</AlertTitle>
          <AlertDescription className="leading-7">
            حُفظ رمز الدخول على هذا الجهاز، ويُجدَّد تلقائياً قبل انتهاء صلاحيته.
          </AlertDescription>
        </Alert>
      ) : null}

      {failure ? <ErrorNotice error={failure} /> : null}

      {!account ? (
        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
          <h2 className="text-xl font-semibold">الحساب غير مربوط</h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            {enabled
              ? "اضغط ربط للانتقال إلى موافقة Google. بعد العودة تظهر هنا صورة القناة والمشتركون والمشاهدات وآخر المقاطع."
              : "YouTube غير مفعّل. المسؤول يحفظ بيانات تطبيق Google من إعدادات المسؤول، ثم يصبح الربط متاحاً."}
          </p>
          <ConnectActions target={target} connected={false} enabled={enabled} signedIn={signedIn} variant="page" />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 sm:flex-row sm:items-center">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-muted">
              {account.avatarUrl ? (
                <Image src={account.avatarUrl} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-2xl font-semibold">
                  {account.title.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-2xl font-semibold">{account.title}</h2>
              <p dir="ltr" className="truncate text-start font-mono text-xs text-muted-foreground">
                {account.channelId}
              </p>
              {/^UC[\w-]{22}$/.test(account.channelId) ? (
                <a
                  className="text-sm underline-offset-4 hover:underline"
                  href={`https://www.youtube.com/channel/${account.channelId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  فتح القناة
                </a>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="المشتركون"
              value={formatCount(account.subscriberCount, account.hiddenSubscriberCount)}
              note={account.hiddenSubscriberCount ? "صاحب القناة أخفى العدد" : undefined}
            />
            <Stat label="إجمالي المشاهدات" value={formatCount(account.viewCount)} />
            <Stat label="عدد المقاطع" value={formatCount(account.videoCount)} />
          </section>

          <YouTubeAnalytics
            period={period}
            summary={analyticsSummary}
            days={analyticsDays}
            currentSubscribers={account.subscriberCount}
            hiddenSubscribers={account.hiddenSubscriberCount}
            needsScope={needsAnalyticsScope}
            failure={analyticsFailure}
          />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">آخر المقاطع</h2>
            {account.videos.length === 0 ? (
              <p className="rounded-2xl bg-card p-5 text-sm leading-7 text-muted-foreground ring-1 ring-foreground/10">
                لا توجد مقاطع في قائمة الرفع.
              </p>
            ) : (
              <ul className="space-y-3">
                {account.videos.map((video, index) => {
                  const linkable = /^[A-Za-z0-9_-]{11}$/.test(video.id);
                  const body = (
                    <article className="flex flex-col gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10 sm:flex-row">
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted sm:w-44">
                        {video.thumbnailUrl ? (
                          <Image src={video.thumbnailUrl} alt="" fill sizes="176px" className="object-cover" />
                        ) : (
                          <span
                            className="flex h-full items-center justify-center text-sm text-white"
                            style={{ background: thumbTones[index % thumbTones.length] }}
                          >
                            مقطع
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 space-y-2 py-1">
                        <h3 className="text-base font-medium leading-7">{video.title}</h3>
                        <p className="text-sm text-muted-foreground">{formatPublished(video.publishedAt)}</p>
                        <p className="text-sm leading-6 text-foreground/80">
                          {formatCount(video.viewCount)} مشاهدة
                          <span className="px-1.5 text-muted-foreground">·</span>
                          {formatCount(video.likeCount)} إعجاب
                          <span className="px-1.5 text-muted-foreground">·</span>
                          {formatCount(video.commentCount)} تعليق
                        </p>
                      </div>
                    </article>
                  );
                  return (
                    <li key={video.id}>
                      {linkable ? (
                        <a
                          href={`https://www.youtube.com/watch?v=${video.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {body}
                        </a>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
