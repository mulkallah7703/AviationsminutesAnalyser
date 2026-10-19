import { oauthCallbackResponse } from "@/lib/auth/callback-response";

export function GET(request: Request) {
  return oauthCallbackResponse(request, "youtube");
}
