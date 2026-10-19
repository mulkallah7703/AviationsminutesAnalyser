"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountBar({
  displayName,
  highlight,
}: {
  displayName: string | null;
  highlight: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(path: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name, password }),
    });
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(data?.message ?? "تعذّر إتمام الدخول.");
      return;
    }
    setPassword("");
    router.refresh();
  }

  async function logout() {
    setBusy(true);
    await fetch("/api/account/logout", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  if (displayName) {
    return (
      <section id="account" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/10">
        <p className="text-sm">
          أنت داخل باسم <span className="font-semibold">{displayName}</span>
        </p>
        <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => void logout()}>
          خروج
        </Button>
      </section>
    );
  }

  return (
    <section
      id="account"
      className={`rounded-2xl bg-card px-4 py-4 shadow-sm ring-1 ${highlight ? "ring-primary" : "ring-foreground/10"}`}
    >
      <h2 className="text-base font-semibold">حسابك على هذا الجهاز</h2>
      <p className="mt-1 text-sm leading-7 text-muted-foreground">
        كل شخص ينشئ اسماً وكلمة مرور محليين. ربط YouTube و TikTok يُحفظ له وحده، ولا يرى مفاتيح التطبيق.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="account-name">اسم العرض</Label>
          <Input id="account-name" className="h-10" value={name} autoComplete="username" onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-password">كلمة المرور</Label>
          <Input
            id="account-password"
            className="h-10"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" className="h-10" disabled={busy} onClick={() => void submit("/api/account/login")}>
            دخول
          </Button>
          <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => void submit("/api/account/register")}>
            إنشاء حساب
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
