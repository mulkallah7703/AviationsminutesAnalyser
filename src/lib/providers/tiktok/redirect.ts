import { TIKTOK_CALLBACK_PATH } from "@/lib/providers/tiktok/config";

export function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function tiktokRedirectUri(input: {
  origin: string;
  publicBaseUrl?: string;
  callbackPath?: string;
}): string {
  const callbackPath = input.callbackPath ?? TIKTOK_CALLBACK_PATH;
  const base = (input.publicBaseUrl?.trim() || input.origin).replace(/\/$/, "");
  return `${base}${callbackPath}`;
}

export function previewTikTokRedirect(input: {
  origin: string;
  publicBaseUrl?: string;
  callbackPath?: string;
}): { uri: string; error: string | null; usesPkce: boolean } {
  const callbackPath = input.callbackPath ?? TIKTOK_CALLBACK_PATH;
  const rawBase = (input.publicBaseUrl?.trim() || input.origin).replace(/\/$/, "");
  if (!rawBase) return { uri: "", error: null, usesPkce: true };
  let url: URL;
  try {
    url = new URL(callbackPath, `${rawBase}/`);
  } catch {
    return { uri: "", error: "عنوان العودة غير صالح.", usesPkce: false };
  }
  const uri = `${url.origin}${callbackPath}`;
  const loopback = isLoopbackHost(url.hostname);
  if (url.protocol === "https:") return { uri, error: null, usesPkce: true };
  if (url.protocol === "http:" && loopback) return { uri, error: null, usesPkce: true };
  return {
    uri,
    error:
      "TikTok يقبل https://، أو http://localhost و http://127.0.0.1 فقط. للوصول من عنوان عام ضع أصل النفق في حقل HTTPS.",
    usesPkce: true,
  };
}

export function prepareTikTokCredentials(
  fields: Record<string, string>,
): { ok: true; fields: Record<string, string> } | { ok: false; message: string } {
  const publicBaseUrl = fields.publicBaseUrl?.trim() ?? "";
  if (!publicBaseUrl) {
    const next = { ...fields };
    delete next.publicBaseUrl;
    return { ok: true, fields: next };
  }
  let url: URL;
  try {
    url = new URL(publicBaseUrl);
  } catch {
    return { ok: false, message: "أصل HTTPS العام غير صالح." };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    return { ok: false, message: "أصل HTTPS العام يجب أن يبدأ بـ https:// بلا اسم مستخدم أو استعلام." };
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return { ok: false, message: "ضع الأصل فقط، مثل https://app.example.com، بلا مسار." };
  }
  return { ok: true, fields: { ...fields, publicBaseUrl: url.origin } };
}
