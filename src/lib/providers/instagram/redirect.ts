import { INSTAGRAM_CALLBACK_PATH } from "@/lib/providers/instagram/config";

export function isLoopbackHost(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, "");
  return bare === "localhost" || bare === "127.0.0.1" || bare === "::1";
}

/** Credentials already carry INSTAGRAM_PUBLIC_BASE_URL when it is set, because env overrides stored values. */
export function resolveInstagramRedirectUri(input: {
  credentials: Record<string, string>;
  origin: string;
  env?: Record<string, string | undefined>;
}): string {
  const env = input.env ?? process.env;
  const base = (
    input.credentials.publicBaseUrl?.trim() ||
    env.INSTAGRAM_PUBLIC_BASE_URL?.trim() ||
    env.PUBLIC_BASE_URL?.trim() ||
    input.origin
  ).replace(/\/$/, "");
  return `${base}${INSTAGRAM_CALLBACK_PATH}`;
}

export function previewInstagramRedirect(input: {
  origin: string;
  publicBaseUrl?: string;
  sharedPublicBase?: string;
  callbackPath?: string;
}): { uri: string; error: string | null } {
  const callbackPath = input.callbackPath ?? INSTAGRAM_CALLBACK_PATH;
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
    error: "Instagram يقبل https:// فقط لعنوان عام. ضع أصل HTTPS في الحقل الاختياري أو في INSTAGRAM_PUBLIC_BASE_URL.",
  };
}

export function instagramRedirectAllowed(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

export function prepareInstagramCredentials(
  fields: Record<string, string>,
): { ok: true; fields: Record<string, string> } | { ok: false; message: string } {
  const clientId = fields.clientId?.trim() ?? "";
  if (clientId && !/^\d{6,25}$/.test(clientId)) {
    return { ok: false, message: "معرّف التطبيق أرقام فقط، كما يظهر في App settings > Basic." };
  }
  const configId = fields.configId?.trim() ?? "";
  if (configId && !/^\d{6,25}$/.test(configId)) {
    return { ok: false, message: "Configuration ID أرقام فقط، كما يظهر في API setup with Unified login." };
  }
  if (!configId) {
    fields = { ...fields };
    delete fields.configId;
  } else {
    fields = { ...fields, configId };
  }
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
