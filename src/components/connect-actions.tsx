"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { navigateTopLevel } from "@/lib/navigate";

export function ConnectActions({
  target,
  connected,
  enabled,
  signedIn,
  variant,
}: {
  target: { id: string; name: string; availability: "ready" | "coming_soon"; pagePath: string };
  connected: boolean;
  enabled: boolean;
  signedIn: boolean;
  variant: "card" | "page";
}) {
  const [error, setError] = useState<string | null>(null);

  if (target.availability !== "ready") {
    return (
      <Button type="button" variant="secondary" className="h-10" disabled>
        لاحقاً
      </Button>
    );
  }

  if (!enabled) {
    return (
      <Button type="button" variant="secondary" className="h-10" disabled>
        غير مفعّل
      </Button>
    );
  }

  function connect() {
    if (!signedIn) {
      setError("أنشئ حساباً محلياً أو ادخل به قبل الربط.");
      document.getElementById("account")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    navigateTopLevel(`/api/auth/${target.id}/start`);
  }

  return (
    <div className={variant === "card" ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap gap-2">
        {variant === "card" && connected ? (
          <Button asChild className="h-10 px-4">
            <Link href={target.pagePath}>عرض الحساب</Link>
          </Button>
        ) : (
          <Button type="button" className="h-10 px-4" onClick={connect}>
            {connected ? "إعادة الربط" : `ربط ${target.name}`}
          </Button>
        )}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
