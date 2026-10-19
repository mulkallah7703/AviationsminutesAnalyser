import { oauthCallbackResponse } from "@/lib/auth/callback-response";

type Context = { params: Promise<{ platform: string }> };

export async function GET(request: Request, context: Context) {
  const { platform } = await context.params;
  return oauthCallbackResponse(request, platform === "google" ? "youtube" : platform);
}
