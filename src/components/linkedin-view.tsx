import Image from "next/image";
import Link from "next/link";
import { ConnectActions } from "@/components/connect-actions";
import { DisconnectButton } from "@/components/disconnect-button";
import { ErrorNotice } from "@/components/error-notice";
import { LinkedInPreviewAnalytics } from "@/components/linkedin-analytics";
import { RefreshButton } from "@/components/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCount } from "@/lib/format";
import type { LinkedInProfile } from "@/lib/providers/linkedin/api";
import type { LinkedInPreviewSummary } from "@/lib/providers/linkedin/preview";
import type { ProviderMeta, UserFacingError } from "@/lib/providers/types";
import type { AnalyticsPeriod } from "@/lib/providers/youtube/analytics";

export function LinkedInView({
  meta,
  profile,
  failure,
  justConnected,
  preview,
  enabled,
  signedIn,
  period,
  previewSummary,
}: {
  meta: ProviderMeta;
  profile: LinkedInProfile | null;
  failure: UserFacingError | null;
  justConnected: boolean;
  preview: boolean;
  enabled: boolean;
  signedIn: boolean;
  period: AnalyticsPeriod;
  previewSummary: LinkedInPreviewSummary | null;
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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">LinkedIn</h1>
        </div>
        {profile ? (
          <div className="flex flex-wrap gap-2">
            <RefreshButton />
            <ConnectActions target={target} connected enabled={enabled} signedIn={signedIn} variant="page" />
            <DisconnectButton platform="linkedin" />
          </div>
        ) : null}
      </div>

      {preview ? (
        <Alert>
          <AlertTitle>معاينة ببيانات تجريبية</AlertTitle>
          <AlertDescription className="leading-7">
            الملف التجريبي بلا عنوان مهني وبلا متابعين، كما يعيد Sign in with LinkedIn. أرقام الفترة أدناه عيّنة لشكل
            الواجهة، وليست من LinkedIn.
          </AlertDescription>
        </Alert>
      ) : null}

      {justConnected && profile ? (
        <Alert>
          <AlertTitle>تم الربط</AlertTitle>
          <AlertDescription className="leading-7">
            حُفظ رمز الدخول لهذا الحساب المحلي. إذا أعاد LinkedIn رمز تحديث يُستخدم عند انتهاء الصلاحية، وإلا يُعاد الربط
            بعد نحو ٦٠ يوماً.
          </AlertDescription>
        </Alert>
      ) : null}

      {failure ? <ErrorNotice error={failure} /> : null}

      {!profile ? (
        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
          <h2 className="text-xl font-semibold">الحساب غير مربوط</h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            {enabled
              ? "اضغط ربط للانتقال إلى تسجيل الدخول في LinkedIn والموافقة على قراءة الاسم والصورة والبريد."
              : "LinkedIn غير مفعّل. المسؤول يحفظ Client ID و Client Secret من إعدادات المسؤول."}
          </p>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            المنتج المطلوب في بوابة المطوّر هو Sign in with LinkedIn using OpenID Connect، بالصلاحيات openid و profile و
            email. العنوان المهني وعدد المتابعين والمنشورات ومخطط الفترة تحتاج Community Management API بعد موافقة
            LinkedIn، ولا تُعرض أرقام مكانها.
          </p>
          <ConnectActions target={target} connected={false} enabled={enabled} signedIn={signedIn} variant="page" />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 sm:flex-row sm:items-center">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-muted">
              {profile.pictureUrl && licdnHost(profile.pictureUrl) ? (
                <Image src={profile.pictureUrl} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-2xl font-semibold">
                  {profile.name.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-2xl font-semibold">{profile.name}</h2>
              {profile.headline ? <p className="text-sm leading-7 text-muted-foreground">{profile.headline}</p> : null}
              {profile.email ? (
                <p dir="ltr" className="truncate text-start font-mono text-sm text-muted-foreground">
                  {profile.email}
                </p>
              ) : null}
            </div>
          </section>

          {typeof profile.followersCount === "number" ? (
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
                <p className="text-sm text-muted-foreground">المتابعون</p>
                <p className="mt-1 text-2xl font-semibold">{formatCount(profile.followersCount)}</p>
              </div>
            </section>
          ) : null}

          <section className="space-y-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
            <h2 className="text-xl font-semibold">ما يعيده الربط الحالي</h2>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              المنتج المفعّل هو Sign in with LinkedIn using OpenID Connect، بالصلاحيات openid و profile و email. الرد
              يجلب الاسم والصورة والبريد. العنوان المهني وعدد المتابعين وقائمة المنشورات وتفاعلها (الظهور والتفاعلات
              والتعليقات وإعادة المشاركة) ومخطط الفترة تحتاج Community Management API بعد موافقة LinkedIn، بالصلاحيات
              r_member_social و r_member_postAnalytics و r_member_profileAnalytics. هذه الصلاحيات لا تُطلب الآن حتى لا
              يُرفض تسجيل الدخول، ولا تُعرض أرقام مكان البيانات الغائبة.
            </p>
            <p className="text-sm leading-7">
              <a
                className="underline-offset-4 hover:underline"
                href="https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview"
                target="_blank"
                rel="noreferrer"
              >
                صفحة Community Management API
              </a>
            </p>
          </section>

          {preview && previewSummary ? <LinkedInPreviewAnalytics period={period} summary={previewSummary} /> : null}
        </>
      )}
    </div>
  );
}

function licdnHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("licdn.com");
  } catch {
    return false;
  }
}
