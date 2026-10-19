import Image from "next/image";
import Link from "next/link";
import { ConnectActions } from "@/components/connect-actions";
import { DisconnectButton } from "@/components/disconnect-button";
import { ErrorNotice } from "@/components/error-notice";
import { RefreshButton } from "@/components/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { XAnalytics } from "@/components/x-analytics";
import { formatCount, formatPublished } from "@/lib/format";
import type { XPeriodSummary } from "@/lib/providers/x/analytics";
import type { XAccount } from "@/lib/providers/x/api";
import type { ProviderMeta, UserFacingError } from "@/lib/providers/types";
import type { AnalyticsPeriod } from "@/lib/providers/youtube/analytics";

export function XView({
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
  account: XAccount | null;
  failure: UserFacingError | null;
  justConnected: boolean;
  preview: boolean;
  enabled: boolean;
  signedIn: boolean;
  period: AnalyticsPeriod;
  analyticsSummary: XPeriodSummary | null;
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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">X</h1>
        </div>
        {account ? (
          <div className="flex flex-wrap gap-2">
            <RefreshButton />
            <ConnectActions target={target} connected enabled={enabled} signedIn={signedIn} variant="page" />
            <DisconnectButton platform="x" />
          </div>
        ) : null}
      </div>

      {preview ? (
        <Alert>
          <AlertTitle>معاينة ببيانات تجريبية</AlertTitle>
          <AlertDescription className="leading-7">
            هذه الأرقام ليست من حساب مربوط. الفلاتر تعرض ملخص منشورات خلال شهر أو ٣ أشهر أو سنة، مع لقطات متابعين تجريبية.
          </AlertDescription>
        </Alert>
      ) : null}

      {justConnected && account ? (
        <Alert>
          <AlertTitle>تم الربط</AlertTitle>
          <AlertDescription className="leading-7">حُفظ رمز الدخول لهذا الحساب المحلي، ويُجدَّد عبر offline.access.</AlertDescription>
        </Alert>
      ) : null}

      {failure ? <ErrorNotice error={failure} /> : null}

      {!account ? (
        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
          <h2 className="text-xl font-semibold">الحساب غير مربوط</h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            {enabled
              ? "اضغط ربط للانتقال إلى تسجيل الدخول في X والموافقة على قراءة الحساب والمنشورات."
              : "X غير مفعّل. المسؤول يحفظ Client ID و Client Secret من إعدادات المسؤول."}
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
                  {account.name.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-2xl font-semibold">{account.name}</h2>
              {account.username ? (
                <p dir="ltr" className="truncate text-start font-mono text-sm text-muted-foreground">
                  @{account.username}
                </p>
              ) : null}
              {account.description ? <p className="text-sm leading-7 text-muted-foreground">{account.description}</p> : null}
              {account.username ? (
                <a
                  className="text-sm underline-offset-4 hover:underline"
                  href={`https://x.com/${account.username}`}
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
            <Stat label="يتابع" value={formatCount(account.followingCount)} />
            <Stat label="المنشورات" value={formatCount(account.tweetCount)} />
          </section>

          <XAnalytics period={period} summary={analyticsSummary} failure={analyticsFailure} />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">آخر المنشورات</h2>
            {account.tweets.length === 0 ? (
              <p className="rounded-2xl bg-card p-5 text-sm leading-7 text-muted-foreground ring-1 ring-foreground/10">
                {analyticsFailure
                  ? "لم تُجلب المنشورات. التفاصيل في ملخص الفترة."
                  : "لا توجد منشورات في الرد."}
              </p>
            ) : (
              <ul className="space-y-3">
                {account.tweets.map((tweet) => (
                  <li key={tweet.id} className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
                    <p className="text-sm leading-7">{tweet.text}</p>
                    {tweet.createdAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">{formatPublished(tweet.createdAt)}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatCount(tweet.impressionCount)} ظهور · {formatCount(tweet.likeCount)} إعجاب ·{" "}
                      {formatCount(tweet.replyCount)} رد · {formatCount((tweet.repostCount ?? 0) + (tweet.quoteCount ?? 0))} مشاركة ·{" "}
                      {formatCount(tweet.bookmarkCount)} علامة
                    </p>
                    {account.username ? (
                      <a
                        className="mt-1 inline-block text-sm underline-offset-4 hover:underline"
                        href={`https://x.com/${account.username}/status/${tweet.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        فتح المنشور
                      </a>
                    ) : null}
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
