import type { ProviderModule } from "@/lib/providers/types";

/**
 * Follows X. Add the Instagram/Facebook Login provider module here.
 */
export const instagramProvider: ProviderModule = {
  meta: {
    id: "instagram",
    name: "Instagram",
    summaryAr: "الربط يُضاف بعد X.",
    availability: "coming_soon",
    comingSoonNoteAr: "يأتي Instagram بعد X.",
    accent: "#c13584",
    credentialFields: [],
    setupSteps: [],
    scopes: [],
    extraLinks: [],
    callbackPath: "/api/auth/instagram/callback",
    pagePath: "/instagram",
  },
};
