"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("page_error");
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">تعذّر عرض الصفحة</h1>
      <p className="text-sm leading-7 text-muted-foreground">
        حدث خطأ أثناء تحميل اللوحة. أعد المحاولة. إذا تكرّر بعد تغيير ملفات مجلد data، تأكد أن ملف المفتاح ما زال إلى
        جانب قاعدة البيانات.
      </p>
      <Button type="button" className="h-10 w-fit px-4" onClick={() => reset()}>
        إعادة المحاولة
      </Button>
    </div>
  );
}
