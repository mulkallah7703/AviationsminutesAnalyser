import { X_CALLBACK_PATH } from "@/lib/providers/x/config";

export function isLoopbackHost(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, "");
  return bare === "localhost" || bare === "127.0.0.1" || bare === "::1";
}

export function resolveXRedirectUri(input: {
  credentials: Record<string, string>;
  origin: string;
  env?: Record<string, string | undefined>;
}): string {
  const env = input.env ?? process.env;
  const exact = env.X_REDIRECT_URI?.trim();
  if (exact) return exact;
  const base = (
    input.credentials.publicBaseUrl?.trim() ||
    env.X_PUBLIC_BASE_URL?.trim() ||
    env.PUBLIC_BASE_URL?.trim() ||
    input.origin
  ).replace(/\/$/, "");
  return `${base}${X_CALLBACK_PATH}`;
}

export function previewXRedirect(input: {
  origin: string;
  publicBaseUrl?: string;
  sharedPublicBase?: string;
  callbackPath?: string;
}): { uri: string; error: string | null } {
  const callbackPath = input.callbackPath ?? X_CALLBACK_PATH;
  const rawBase = (input.publicBaseUrl?.trim() || input.sharedPublicBase?.trim() || input.origin).replace(/\/$/, "");
  if (!rawBase) return { uri: "", error: null };
  let url: URL;
  try {
    url = new URL(callbackPath, `${rawBase}/`);
  } catch {
    return { uri: "", error: "عنوان العودة غير صالح." };
  }
  const uri = `${url.origin}${callbackPath}`;
  if (url.protocol === "https:") return { uri, error: null };
  if (url.protocol === "http:" && isLoopbackHost(url.hostname)) return { uri, error: null };
  return {
    uri,
    error: "X يقبل https://، أو http://localhost و http://127.0.0.1 فقط. للوصول من عنوان عام ضع أصل النفق في حقل HTTPS.",
  };
}

export function xRedirectAllowed(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

export function prepareXCredentials(
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
