"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DisconnectButton({ platform }: { platform: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/auth/${platform}/disconnect`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.message ?? "تعذّر قطع الاتصال.");
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" className="h-10 px-4" onClick={() => setConfirming(true)}>
        قطع الاتصال
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="text-sm leading-6">
        سيُحذف رمز الدخول من هذا الجهاز، وتُطلب من Google إلغاء الرمز إن أمكن. بيانات Client ID تبقى محفوظة لإعادة
        الربط.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" className="h-10 px-4" disabled={pending} onClick={() => void disconnect()}>
          {pending ? "جارٍ القطع…" : "تأكيد القطع"}
        </Button>
        <Button type="button" variant="outline" className="h-10 px-4" disabled={pending} onClick={() => setConfirming(false)}>
          إلغاء
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
