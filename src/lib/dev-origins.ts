const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export function allowedDevOriginsFromEnv(env: Record<string, string | undefined> = process.env): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | undefined) => {
    const host = devOriginHost(value);
    if (!host || seen.has(host)) return;
    seen.add(host);
    hosts.push(host);
  };
  add(env.TIKTOK_PUBLIC_BASE_URL);
  add(env.GOOGLE_REDIRECT_URI);
  add(env.X_PUBLIC_BASE_URL);
  add(env.X_REDIRECT_URI);
  add(env.LINKEDIN_PUBLIC_BASE_URL);
  add(env.PUBLIC_BASE_URL);
  for (const part of (env.ALLOWED_DEV_ORIGINS ?? "").split(",")) add(part);
  return hosts;
}

function devOriginHost(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let hostname: string;
  try {
    hostname = new URL(candidate).hostname;
  } catch {
    return null;
  }
  hostname = hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || isLoopback(hostname)) return null;
  return hostname;
}

function isLoopback(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, "");
  return LOOPBACK.has(bare) || bare.endsWith(".localhost");
}
