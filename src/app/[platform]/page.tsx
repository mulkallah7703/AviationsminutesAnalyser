import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { LinkedInScreen } from "@/components/linkedin-screen";
import { TikTokScreen } from "@/components/tiktok-screen";
import { XScreen } from "@/components/x-screen";
import { YouTubeScreen } from "@/components/youtube-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { getProviderModule } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const provider = getProviderModule(platform);
  return { title: provider?.meta.name ?? "AviationsminuteAnalyser" };
}

export default async function PlatformPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ error?: string; connected?: string; preview?: string }>;
}) {
  const { platform } = await params;
  const provider = getProviderModule(platform);
  if (!provider) notFound();

  return (
    <AppShell>
      {platform === "youtube" ? (
        <Suspense fallback={<PlatformFallback />}>
          <YouTubeScreen searchParams={searchParams} />
        </Suspense>
      ) : platform === "tiktok" ? (
        <Suspense fallback={<PlatformFallback />}>
          <TikTokScreen searchParams={searchParams} />
        </Suspense>
      ) : platform === "x" ? (
        <Suspense fallback={<PlatformFallback />}>
          <XScreen searchParams={searchParams} />
        </Suspense>
      ) : platform === "linkedin" ? (
        <Suspense fallback={<PlatformFallback />}>
          <LinkedInScreen searchParams={searchParams} />
        </Suspense>
      ) : (
        <ComingSoon meta={provider.meta} />
      )}
    </AppShell>
  );
}

function PlatformFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-36 rounded-2xl" />
    </div>
  );
}
