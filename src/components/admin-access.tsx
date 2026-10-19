"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminSetupForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(data?.message ?? "تعذّر حفظ كلمة المرور.");
      return;
    }
    router.push("/admin/settings");
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-lg space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
      <h1 className="text-2xl font-semibold">إعداد المسؤول</h1>
      <p className="text-sm leading-7 text-muted-foreground">
        هذه كلمة مرور صاحب الجهاز. تُستخدم لفتح إعدادات التطبيقات، وليست حساباً للمستخدمين. تُحفظ كبصمة مشفّرة في قاعدة
        البيانات المحلية.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="admin-password">كلمة المرور</Label>
        <Input id="admin-password" className="h-10" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-confirm">تأكيد كلمة المرور</Label>
        <Input id="admin-confirm" className="h-10" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" className="h-10" disabled={busy} onClick={() => void submit()}>
        {busy ? "جارٍ الحفظ…" : "حفظ والانتقال للإعدادات"}
      </Button>
    </section>
  );
}

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(data?.message ?? "تعذّر الدخول.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-lg space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
      <h1 className="text-2xl font-semibold">دخول المسؤول</h1>
      <p className="text-sm leading-7 text-muted-foreground">أدخل كلمة المرور التي أُنشئت عند أول تشغيل.</p>
      <div className="space-y-1.5">
        <Label htmlFor="admin-login">كلمة المرور</Label>
        <Input id="admin-login" className="h-10" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" className="h-10" disabled={busy} onClick={() => void submit()}>
        {busy ? "جارٍ التحقق…" : "دخول"}
      </Button>
    </section>
  );
}
