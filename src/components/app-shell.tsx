import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-3 rounded-2xl">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
            د
          </span>
          <span>
            <span className="block text-lg font-semibold leading-tight">AviationsminuteAnalyser</span>
            <span className="block text-sm text-muted-foreground">لوحة الشبكات على هذا الجهاز</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/admin/settings" className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
            إعداد المسؤول
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
