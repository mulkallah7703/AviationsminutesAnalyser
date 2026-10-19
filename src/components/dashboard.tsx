import { AccountBar } from "@/components/account-bar";
import { ConnectActions } from "@/components/connect-actions";
import { ErrorNotice } from "@/components/error-notice";
import { PlatformMark } from "@/components/platform-mark";
import { Badge } from "@/components/ui/badge";
import type { DashboardPlatform } from "@/lib/dashboard";
import type { UserFacingError } from "@/lib/providers/types";

export function Dashboard({
  platforms,
  storageError,
  displayName,
  needAccount,
  disabledPlatform,
}: {
  platforms: DashboardPlatform[];
  storageError: UserFacingError | null;
  displayName: string | null;
  needAccount: boolean;
  disabledPlatform: string | null;
}) {
  return (
    <div className="space-y-8">
      <section className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">حساباتك في مكان واحد</h1>
        <p className="text-base leading-8 text-muted-foreground">
          ادخل باسمك المحلي ثم اربط المنصة. الزر ينقلك مباشرة إلى صفحة موافقة YouTube أو TikTok أو X أو LinkedIn. مفاتيح
          التطبيق يضبطها المسؤول، ولا تظهر هنا.
        </p>
      </section>

      <AccountBar displayName={displayName} highlight={needAccount} />

      {storageError ? <ErrorNotice error={storageError} /> : null}
      {disabledPlatform ? (
        <p className="rounded-2xl bg-accent px-4 py-3 text-sm leading-7 text-accent-foreground">
          هذه المنصة غير مفعّلة بعد. يطلب المسؤول ضبط بياناتها من إعدادات المسؤول.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {platforms.map((platform) => {
          const comingSoon = platform.availability !== "ready";
          const disabled = !comingSoon && !platform.credentialsConfigured;
          const badge = comingSoon ? "لاحقاً" : disabled ? "غير مفعّل" : platform.connected ? "متصل" : "غير متصل";
          return (
            <article
              key={platform.id}
              className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10"
            >
              <div className="h-1.5" style={{ background: platform.accent }} />
              <div className="flex flex-1 flex-col gap-5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <PlatformMark id={platform.id} accent={platform.accent} />
                    <div>
                      <h2 className="text-lg font-semibold" dir="ltr">
                        {platform.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {comingSoon ? "غير متاح بعد" : disabled ? "بانتظار المسؤول" : platform.connected ? "الجلسة محفوظة" : "بانتظار الربط"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={platform.connected && !disabled ? "default" : "outline"}>{badge}</Badge>
                </div>
                <p className="flex-1 text-sm leading-7 text-muted-foreground">{platform.summaryAr}</p>
                {disabled ? (
                  <p className="text-sm text-foreground/80">غير مفعّل حتى يحفظ المسؤول بيانات التطبيق.</p>
                ) : null}
                <ConnectActions
                  target={{
                    id: platform.id,
                    name: platform.name,
                    availability: platform.availability,
                    pagePath: platform.pagePath,
                  }}
                  connected={platform.connected}
                  enabled={platform.credentialsConfigured}
                  signedIn={Boolean(displayName)}
                  variant="card"
                />
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
