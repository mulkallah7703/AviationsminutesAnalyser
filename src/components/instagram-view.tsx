import Image from "next/image";
import Link from "next/link";
import { ConnectActions } from "@/components/connect-actions";
import { DisconnectButton } from "@/components/disconnect-button";
import { ErrorNotice } from "@/components/error-notice";
import { InstagramAnalytics } from "@/components/instagram-analytics";
import { RefreshButton } from "@/components/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCount, formatPublished } from "@/lib/format";
import type { InstagramPeriodSummary } from "@/lib/providers/instagram/analytics";
import type { InstagramAccount } from "@/lib/providers/instagram/api";
import type { ProviderMeta, UserFacingError } from "@/lib/providers/types";
import type { AnalyticsPeriod } from "@/lib/providers/youtube/analytics";

const tones = ["#c13584", "#e1306c", "#833ab4"];

const ACCOUNT_TYPES: Record<string, string> = {
  BUSINESS: "حساب أعمال",
  MEDIA_CREATOR: "صانع محتوى",
  CREATOR: "صانع محتوى",
};

const MEDIA_TYPES: Record<string, string> = {
  REELS: "ريلز",
  FEED: "منشور",
  STORY: "قصة",
  IMAGE: "صورة",
  VIDEO: "فيديو",
  CAROUSEL_ALBUM: "ألبوم",
};

export function InstagramView({
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
  account: InstagramAccount | null;
  failure: UserFacingError | null;
  justConnected: boolean;
  preview: boolean;
  enabled: boolean;
  signedIn: boolean;
  period: AnalyticsPeriod;
  analyticsSummary: InstagramPeriodSummary | null;
  analyticsFailure: UserFacingError | null;
}) {
  const target = {
    id: meta.id,
    name: meta.name,
    availability: meta.availability,
    pagePath: meta.pagePath,
  };
  const posts = analyticsSummary?.posts.slice(0, 12) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            → العودة إلى اللوحة
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Instagram</h1>
        </div>
        {account ? (
          <div className="flex flex-wrap gap-2">
            <RefreshButton />
            <ConnectActions target={target} connected enabled={enabled} signedIn={signedIn} variant="page" />
            <DisconnectButton platform="instagram" />
          </div>
        ) : null}
      </div>

      {preview ? (
        <Alert>
          <AlertTitle>معاينة ببيانات تجريبية</AlertTitle>
          <AlertDescription className="leading-7">
            هذه الأرقام ليست من حساب مربوط. الفلاتر تعرض إحصاءات الحساب خلال شهر أو ٣ أشهر أو سنة، مع منشورات تجريبية.
          </AlertDescription>
        </Alert>
      ) : null}

      {justConnected && account ? (
        <Alert>
          <AlertTitle>تم الربط</AlertTitle>
          <AlertDescription className="leading-7">
            حُفظ رمز الدخول مشفّراً لهذا الحساب المحلي.
          </AlertDescription>
        </Alert>
      ) : null}

      {failure ? <ErrorNotice error={failure} /> : null}

      {!account ? (
        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
          <h2 className="text-xl font-semibold">الحساب غير مربوط</h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            {enabled
              ? "اضغط ربط للانتقال إلى نافذة Meta: سجّل الدخول بـ Instagram أو Facebook، واختر الـ business portfolio وحساب Instagram، ثم وافق على الصلاحيات. يعمل مع حسابات الأعمال وصنّاع المحتوى."
              : "Instagram غير مفعّل. المسؤول يحفظ معرّف تطبيق Meta وسرّه و Configuration ID من إعدادات المسؤول."}
          </p>
          <ConnectActions target={target} connected={false} enabled={enabled} signedIn={signedIn} variant="page" />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 sm:flex-row sm:items-center">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-muted">
              {account.pictureUrl ? (
                <Image src={account.pictureUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
              ) : (
                <span className="flex h-full items-center justify-center text-2xl font-semibold">{account.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-2xl font-semibold">{account.name}</h2>
              {account.username ? (
                <p dir="ltr" className="truncate text-start font-mono text-sm text-muted-foreground">
                  @{account.username}
                </p>
              ) : null}
              {account.accountType ? (
                <p className="text-sm text-muted-foreground">{ACCOUNT_TYPES[account.accountType] ?? account.accountType}</p>
              ) : null}
              {account.username ? (
                <a
                  className="text-sm underline-offset-4 hover:underline"
                  href={`https://www.instagram.com/${account.username}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  فتح الملف
                </a>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="المتابعون" value={formatCount(account.followersCount)} />
            <Stat label="يتابع" value={formatCount(account.followsCount)} />
            <Stat label="المنشورات" value={formatCount(account.mediaCount)} />
          </section>

          <InstagramAnalytics period={period} summary={analyticsSummary} failure={analyticsFailure} />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">منشورات الفترة</h2>
            {posts.length === 0 ? (
              <p className="rounded-2xl bg-card p-5 text-sm leading-7 text-muted-foreground ring-1 ring-foreground/10">
                لا توجد منشورات في هذه الفترة، أو تعذّر جلب قائمة المنشورات.
              </p>
            ) : (
              <ul className="space-y-3">
                {posts.map((post, index) => (
                  <li key={post.id} className="flex gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10">
                    <div
                      className="relative size-20 shrink-0 overflow-hidden rounded-lg"
                      style={{ background: tones[index % tones.length] }}
                    >
                      {post.thumbnailUrl ? (
                        <Image src={post.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="line-clamp-2 font-medium">{post.caption || "بلا وصف"}</p>
                      <p className="text-xs text-muted-foreground">
                        {MEDIA_TYPES[post.productType ?? ""] ?? MEDIA_TYPES[post.mediaType] ?? post.mediaType}
                        {post.timestamp ? ` · ${formatPublished(post.timestamp)}` : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {post.insights?.views !== null && post.insights?.views !== undefined
                          ? `${formatCount(post.insights.views)} مشاهدة · `
                          : ""}
                        {formatCount(post.insights?.likes ?? post.likeCount)} إعجاب ·{" "}
                        {formatCount(post.insights?.comments ?? post.commentsCount)} تعليق
                        {post.insights ? (
                          <>
                            {" "}
                            · {formatCount(post.insights.shares)} مشاركة · {formatCount(post.insights.saved)} حفظ
                          </>
                        ) : null}
                      </p>
                      {post.permalink ? (
                        <a className="text-sm underline-offset-4 hover:underline" href={post.permalink} target="_blank" rel="noreferrer">
                          فتح المنشور
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
