"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CredentialStatus } from "@/lib/credential-status";
import { previewLinkedInRedirect } from "@/lib/providers/linkedin/redirect";
import { previewTikTokRedirect } from "@/lib/providers/tiktok/redirect";
import { previewXRedirect } from "@/lib/providers/x/redirect";
import { DEFAULT_GOOGLE_REDIRECT_URI } from "@/lib/providers/youtube/config";
import type { ProviderMeta } from "@/lib/providers/types";

function usePageOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

export function CredentialsDialog({
  meta,
  open,
  onOpenChange,
}: {
  meta: ProviderMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [announcedRedirect, setAnnouncedRedirect] = useState<string | null>(null);
  const [redirectLocked, setRedirectLocked] = useState(false);
  const [sharedPublicBase, setSharedPublicBase] = useState("");
  const origin = usePageOrigin() || "http://localhost:5050";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/credentials/${meta.id}`);
      const data = (await response.json().catch(() => null)) as
        | (CredentialStatus & { redirectUri?: string; redirectLocked?: boolean; sharedPublicBase?: string | null })
        | { message?: string }
        | null;
      if (cancelled) return;
      setValues({});
      setNotice(null);
      setAnnouncedRedirect(null);
      setRedirectLocked(false);
      setSharedPublicBase("");
      if (!response.ok || !data || !("fields" in data)) {
        setError(data && "message" in data && data.message ? data.message : "تعذّر قراءة البيانات المحفوظة.");
        return;
      }
      setError(null);
      setStatus(data);
      if ("redirectUri" in data && typeof data.redirectUri === "string" && data.redirectUri) {
        setAnnouncedRedirect(data.redirectUri);
      }
      if ("redirectLocked" in data && data.redirectLocked) setRedirectLocked(true);
      if ("sharedPublicBase" in data && typeof data.sharedPublicBase === "string") {
        setSharedPublicBase(data.sharedPublicBase);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, meta.id]);

  const savedPublicBase =
    status?.fields.find((field) => field.key === "publicBaseUrl")?.value ?? "";
  const publicBaseUrl = values.publicBaseUrl?.trim() || savedPublicBase;
  const tiktokPreview =
    meta.redirectPolicy === "tiktok"
      ? previewTikTokRedirect({ origin, publicBaseUrl, callbackPath: meta.callbackPath })
      : null;
  const xPreview =
    meta.redirectPolicy === "x" && !redirectLocked
      ? previewXRedirect({ origin, publicBaseUrl, sharedPublicBase, callbackPath: meta.callbackPath })
      : null;
  const linkedinPreview =
    meta.redirectPolicy === "linkedin"
      ? previewLinkedInRedirect({ origin, publicBaseUrl, sharedPublicBase, callbackPath: meta.callbackPath })
      : null;
  const redirectUri =
    meta.id === "youtube" || redirectLocked
      ? announcedRedirect || (meta.id === "youtube" ? DEFAULT_GOOGLE_REDIRECT_URI : "")
      : xPreview?.uri || tiktokPreview?.uri || linkedinPreview?.uri || (origin ? `${origin}${meta.callbackPath}` : "");
  const redirectError = xPreview?.error ?? tiktokPreview?.error ?? linkedinPreview?.error ?? null;

  const clientIdValue = values.clientId?.trim() ?? "";
  const showClientFormatHint =
    meta.id === "youtube" && clientIdValue.length > 0 && !clientIdValue.endsWith(".apps.googleusercontent.com");

  async function copyUri() {
    if (!redirectUri || redirectError) return;
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("تعذّر النسخ تلقائياً. حدّد العنوان وانسخه يدوياً.");
    }
  }

  async function save() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/credentials/${meta.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json().catch(() => null)) as CredentialStatus | { message?: string } | null;
    setLoading(false);
    if (!response.ok || !data || !("configured" in data)) {
      setError(data && "message" in data && data.message ? data.message : "تعذّر الحفظ.");
      return;
    }
    setStatus(data);
    setValues({});
    setNotice(data.configured ? "حُفظت البيانات. يمكن للمستخدمين الربط الآن." : "حُفظ جزء من البيانات. أكمل الحقول المطلوبة.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,880px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pe-12">
          <DialogTitle className="text-lg">إعداد {meta.name}</DialogTitle>
          <DialogDescription className="leading-7">
            هذه البيانات للتطبيق نفسه، وتُدخل مرة واحدة. تُحفظ مشفّرة على هذا الجهاز. إذا وُجد متغير بيئة للحقل فهو
            الذي يُستخدم.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <h3 className="font-semibold">الحقول</h3>
            {meta.credentialFields.map((field) => {
              const fieldStatus = status?.fields.find((item) => item.key === field.key);
              const fromEnv = fieldStatus?.source === "env";
              const inputId = `${meta.id}-${field.key}`;
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={inputId}>
                    {field.labelAr}{" "}
                    <span className="font-normal text-muted-foreground" dir="ltr">
                      ({field.label})
                    </span>
                    {field.optional ? <span className="font-normal text-muted-foreground"> — اختياري</span> : null}
                  </Label>
                  <Input
                    id={inputId}
                    dir="ltr"
                    className="h-10 font-mono text-sm"
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    disabled={fromEnv}
                    placeholder={
                      fromEnv
                        ? "مضبوط من متغير البيئة"
                        : fieldStatus?.set
                          ? "اتركه فارغاً للإبقاء على القيمة المحفوظة"
                          : field.placeholder
                    }
                    value={fromEnv ? "" : (values[field.key] ?? "")}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                  <p className="text-sm leading-6 text-muted-foreground">{field.helpAr}</p>
                  {fromEnv ? (
                    <p className="text-sm text-foreground/80">
                      يُستخدم المتغير{" "}
                      <span dir="ltr" className="font-mono">
                        {fieldStatus?.envVar}
                      </span>{" "}
                      بدل أي قيمة محفوظة هنا.
                    </p>
                  ) : fieldStatus?.set ? (
                    <p className="text-sm text-foreground/80">
                      {field.secret ? (
                        "محفوظ ومشفّر. لن يُعرض السر مرة أخرى."
                      ) : (
                        <>
                          المحفوظ:{" "}
                          <span dir="ltr" className="font-mono">
                            {fieldStatus.value ?? fieldStatus.hint}
                          </span>
                        </>
                      )}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {showClientFormatHint ? (
              <p className="rounded-lg bg-accent px-3 py-2 text-sm leading-6 text-accent-foreground">
                معرّف عميل Google ينتهي عادةً بـ{" "}
                <span dir="ltr" className="font-mono">
                  .apps.googleusercontent.com
                </span>
                .
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">من أين أحصل عليها؟</h3>
            <ol className="list-decimal space-y-3 ps-5 text-sm leading-7">
              {meta.setupSteps.map((step) => (
                <li key={step.titleAr}>
                  <span className="font-medium">{step.titleAr}. </span>
                  {step.bodyAr}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              {meta.consoleUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={meta.consoleUrl} target="_blank" rel="noreferrer">
                    {meta.consoleLinkLabel ?? "فتح لوحة المطوّر"}
                  </a>
                </Button>
              ) : null}
              {meta.extraLinks.map((link) => (
                <Button key={link.href} variant="outline" size="sm" asChild>
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {link.labelAr}
                  </a>
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">عنوان إعادة التوجيه</h3>
            <p className="text-sm leading-7 text-muted-foreground">
              {meta.redirectHelpAr ?? "الصق هذا العنوان في إعدادات تطبيق المنصة كما هو."}
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-muted p-2">
              <code dir="ltr" className="flex-1 break-all px-1 text-start font-mono text-xs sm:text-sm">
                {redirectUri || "…"}
              </code>
              <Button type="button" variant="secondary" size="sm" disabled={!redirectUri || Boolean(redirectError)} onClick={() => void copyUri()}>
                {copied ? <Check /> : <Copy />}
                {copied ? "تم النسخ" : "نسخ"}
              </Button>
            </div>
            {redirectError ? <p className="text-sm leading-6 text-destructive">{redirectError}</p> : null}
            {redirectLocked ? (
              <p className="text-sm leading-6 text-muted-foreground">
                يُستخدم المتغير <span dir="ltr" className="font-mono">X_REDIRECT_URI</span> كما هو، ويتقدّم على الأصل المحسوب.
              </p>
            ) : null}
            {tiktokPreview?.usesPkce && !redirectError ? (
              <p className="text-sm leading-6 text-muted-foreground">
                يُرفق PKCE تلقائياً: code_challenge هو SHA-256 للسر المؤقت بصيغة hex، وهي الصيغة التي تطلبها TikTok.
              </p>
            ) : null}
            {meta.redirectPolicy === "x" && !redirectError ? (
              <p className="text-sm leading-6 text-muted-foreground">
                يُرفق PKCE دائماً: code_challenge هو SHA-256 للسر المؤقت بصيغة base64url، وهي الصيغة التي تطلبها X.
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">الصلاحيات المطلوبة</h3>
            <ul className="space-y-3">
              {meta.scopes.map((scope) => (
                <li key={scope.value} className="rounded-xl border border-border bg-card px-3 py-2">
                  <code dir="ltr" className="block break-all text-start font-mono text-xs">
                    {scope.value}
                  </code>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{scope.descriptionAr}</p>
                </li>
              ))}
            </ul>
          </section>

          {error ? <p className="text-sm leading-6 text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm leading-6 text-foreground">{notice}</p> : null}
        </div>
        <div className="flex border-t bg-muted/40 px-5 py-4">
          <Button type="button" className="h-10 px-4" disabled={loading} onClick={() => void save()}>
            {loading ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
