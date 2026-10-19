import { explainYouTubeError } from "@/lib/providers/youtube/errors";
import { providerList } from "@/lib/providers/registry";
import type { ProviderMeta, UserFacingError } from "@/lib/providers/types";
import { describeCredentials, hasTokens } from "@/lib/store";

export type DashboardPlatform = ProviderMeta & {
  connected: boolean;
  credentialsConfigured: boolean;
};

export function listDashboardPlatforms(userId: string | null): {
  platforms: DashboardPlatform[];
  storageError: UserFacingError | null;
} {
  try {
    return {
      storageError: null,
      platforms: providerList.map((provider) => {
        const ready = provider.meta.availability === "ready";
        return {
          ...provider.meta,
          connected: ready && userId ? hasTokens(userId, provider.meta.id) : false,
          credentialsConfigured: ready
            ? describeCredentials(provider.meta.id, provider.meta.credentialFields).configured
            : false,
        };
      }),
    };
  } catch (error) {
    return {
      storageError: explainYouTubeError(error),
      platforms: providerList.map((provider) => ({
        ...provider.meta,
        connected: false,
        credentialsConfigured: false,
      })),
    };
  }
}
