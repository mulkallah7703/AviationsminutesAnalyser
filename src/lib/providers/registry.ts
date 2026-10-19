import { instagramProvider } from "@/lib/providers/instagram";
import { linkedinProvider } from "@/lib/providers/linkedin";
import { tiktokProvider } from "@/lib/providers/tiktok";
import { asReadyProvider, type ProviderModule, type ReadyProvider } from "@/lib/providers/types";
import { xProvider } from "@/lib/providers/x";
import { youtubeProvider } from "@/lib/providers/youtube";

export const providerList: ProviderModule[] = [
  youtubeProvider,
  tiktokProvider,
  xProvider,
  instagramProvider,
  linkedinProvider,
];

export function getProviderModule(id: string): ProviderModule | null {
  return providerList.find((provider) => provider.meta.id === id) ?? null;
}

export function getReadyProvider(id: string): ReadyProvider | null {
  return asReadyProvider(getProviderModule(id));
}
