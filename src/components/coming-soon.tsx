import Link from "next/link";
import { PlatformMark } from "@/components/platform-mark";
import { Badge } from "@/components/ui/badge";
import type { ProviderMeta } from "@/lib/providers/types";

export function ComingSoon({ meta }: { meta: ProviderMeta }) {
  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        → العودة إلى اللوحة
      </Link>
      <section className="max-w-2xl space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <PlatformMark id={meta.id} accent={meta.accent} />
          <div>
            <h1 className="text-2xl font-semibold" dir="ltr">
              {meta.name}
            </h1>
            <Badge variant="secondary">لاحقاً</Badge>
          </div>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{meta.summaryAr}</p>
        <p className="text-sm leading-7">
          الربط غير مفعّل في هذه النسخة. عند إضافته ستُفتح نفس شاشة بيانات الاعتماد: الحقول، خطوات الحصول عليها، عنوان
          إعادة التوجيه، والصلاحيات، ثم صفحة الحساب وزر قطع الاتصال.
        </p>
        {meta.comingSoonNoteAr ? <p className="text-sm text-foreground/80">{meta.comingSoonNoteAr}</p> : null}
      </section>
    </div>
  );
}
