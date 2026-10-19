import Image from "next/image";
import Link from "next/link";
import { ConnectActions } from "@/components/connect-actions";
import { DisconnectButton } from "@/components/disconnect-button";
import { ErrorNotice } from "@/components/error-notice";
import { RefreshButton } from "@/components/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TikTokAnalytics } from "@/components/tiktok-analytics";
import { formatCount, formatPublished } from "@/lib/format";
import type { TikTokPeriodSummary } from "@/lib/providers/tiktok/analytics";
import type { TikTokAccount } from "@/lib/providers/tiktok/api";
import type { ProviderMeta, UserFacingError } from "@/lib/providers/types";
import type { AnalyticsPeriod } from "@/lib/providers/youtube/analytics";

const tones = ["#1a1a1a", "#2b2b2b", "#3a3a3a"];

export function TikTokView({
  meta,
  account,
  failure,
  justConnected,
  preview,
  enabled,
  signedIn,
  period,
  analyticsSummary,
  analyticsFailure,
}: {
  meta: ProviderMeta;
  account: TikTokAccount | null;
  failure: UserFacingError | null;
  justConnected: boolean;
  preview: boolean;
  enabled: boolean;
  signedIn: boolean;
  period: AnalyticsPeriod;
  analyticsSummary: TikTokPeriodSummary | null;
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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">TikTok</h1>
        </div>
        {account ? (
          <div className="flex flex-wrap gap-2">
            <RefreshButton />
            <ConnectActions target={target} connected enabled={enabled} signedIn={signedIn} variant="page" />
            <DisconnectButton platform="tiktok" />
          </div>
        ) : null}
      </div>

      {preview ? (
        <Alert>
          <AlertTitle>معاينة ببيانات تجريبية</AlertTitle>
          <AlertDescription className="leading-7">
            هذه الأرقام ليست من حساب مربوط. الفلاتر تعرض ملخص مقاطع منشورة خلال شهر أو ٣ أشهر أو سنة، مع لقطات متابعين تجريبية.
          </AlertDescription>
        </Alert>
      ) : null}

      {justConnected && account ? (
        <Alert>
          <AlertTitle>تم الربط</AlertTitle>
          <AlertDescription className="leading-7">حُفظ رمز الدخول لهذا الحساب المحلي، ويُجدَّد تلقائياً.</AlertDescription>
        </Alert>
      ) : null}

      {failure ? <ErrorNotice error={failure} /> : null}

      {!account ? (
        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
          <h2 className="text-xl font-semibold">الحساب غير مربوط</h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            {enabled
              ? "اضغط ربط للانتقال إلى تسجيل الدخول في TikTok والموافقة على قراءة الحساب والمقاطع."
              : "TikTok غير مفعّل. المسؤول يحفظ Client Key و Client Secret من إعدادات المسؤول."}
          </p>
          <ConnectActions target={target} connected={false} enabled={enabled} signedIn={signedIn} variant="page" />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 sm:flex-row sm:items-center">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-muted">
              {account.avatarUrl ? (
                <Image src={account.avatarUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
              ) : (
                <span className="flex h-full items-center justify-center text-2xl font-semibold">
                  {account.displayName.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-2xl font-semibold">{account.displayName}</h2>
              {account.username ? (
                <p dir="ltr" className="truncate text-start font-mono text-sm text-muted-foreground">
                  @{account.username}
                </p>
              ) : null}
              {account.bio ? <p className="text-sm leading-7 text-muted-foreground">{account.bio}</p> : null}
              {account.profileUrl ? (
                <a className="text-sm underline-offset-4 hover:underline" href={account.profileUrl} target="_blank" rel="noreferrer">
                  فتح الملف
                </a>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="المتابعون" value={formatCount(account.followerCount)} />
            <Stat label="يتابع" value={formatCount(account.followingCount)} />
            <Stat label="الإعجابات" value={formatCount(account.likesCount)} />
            <Stat label="المقاطع" value={formatCount(account.videoCount)} />
          </section>

          <TikTokAnalytics period={period} summary={analyticsSummary} failure={analyticsFailure} />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">آخر المقاطع</h2>
            {account.videos.length === 0 ? (
              <p className="rounded-2xl bg-card p-5 text-sm leading-7 text-muted-foreground ring-1 ring-foreground/10">
                لا توجد مقاطع في الرد، أو أن صلاحية video.list غير ممنوحة.
              </p>
            ) : (
              <ul className="space-y-3">
                {account.videos.map((video, index) => (
                  <li key={video.id} className="flex gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10">
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg" style={{ background: tones[index % tones.length] }}>
                      {video.coverUrl ? (
                        <Image src={video.coverUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">{video.title}</p>
                      {video.createTime ? (
                        <p className="text-xs text-muted-foreground">{formatPublished(video.createTime)}</p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        {formatCount(video.viewCount)} مشاهدة · {formatCount(video.likeCount)} إعجاب ·{" "}
                        {formatCount(video.commentCount)} تعليق · {formatCount(video.shareCount)} مشاركة
                      </p>
                      {video.shareUrl ? (
                        <a className="text-sm underline-offset-4 hover:underline" href={video.shareUrl} target="_blank" rel="noreferrer">
                          فتح المقطع
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
