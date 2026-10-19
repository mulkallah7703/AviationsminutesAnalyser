import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <div className="max-w-xl space-y-3">
        <h1 className="text-2xl font-semibold">الصفحة غير موجودة</h1>
        <p className="text-sm leading-7 text-muted-foreground">هذا المسار ليس منصة معروفة في اللوحة.</p>
        <Link href="/" className="text-sm underline-offset-4 hover:underline">
          العودة إلى اللوحة
        </Link>
      </div>
    </AppShell>
  );
}
