"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CredentialsDialog } from "@/components/credentials-dialog";
import { Button } from "@/components/ui/button";
import type { ProviderMeta } from "@/lib/providers/types";

export function AdminSettings({ metas, later }: { metas: ProviderMeta[]; later: string[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/admin/logout", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-semibold">إعدادات المسؤول</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            مفاتيح التطبيقات تُضبط هنا مرة واحدة. المستخدمون يرون زر الربط فقط، وينتقلون مباشرة إلى صفحة موافقة المنصة.
            متغيرات البيئة، إن وُجدت، تتقدّم على القيمة المحفوظة.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => void logout()}>
          خروج المسؤول
        </Button>
      </div>

      <div className="grid gap-4">
        {metas.map((meta) => (
          <article key={meta.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
            <div>
              <h2 className="text-lg font-semibold" dir="ltr">
                {meta.name}
              </h2>
              <p className="text-sm text-muted-foreground">{meta.summaryAr}</p>
            </div>
            <Button type="button" className="h-10" onClick={() => setOpenId(meta.id)}>
              بيانات التطبيق
            </Button>
            <CredentialsDialog meta={meta} open={openId === meta.id} onOpenChange={(open) => setOpenId(open ? meta.id : null)} />
          </article>
        ))}
      </div>

      <p className="text-sm leading-7 text-muted-foreground">لاحقاً: {later.join("، ")}.</p>
    </div>
  );
}
