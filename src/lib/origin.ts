export function resolvePublicOrigin(request: { url: string; headers: Headers }): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost?.split(",")[0] ?? request.headers.get("host") ?? "").trim();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  let proto = (forwardedProto?.split(",")[0] ?? "").trim();
  if (!proto) {
    try {
      proto = new URL(request.url).protocol.replace(":", "");
    } catch {
      proto = "http";
    }
  }
  if (!host) {
    return new URL(request.url).origin;
  }
  return `${proto}://${host}`;
}

export function isSameOrigin(request: { url: string; headers: Headers }): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === resolvePublicOrigin(request);
}
