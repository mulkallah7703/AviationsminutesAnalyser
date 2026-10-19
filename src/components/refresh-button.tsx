"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 px-4"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "جارٍ التحديث…" : "تحديث"}
    </Button>
  );
}
