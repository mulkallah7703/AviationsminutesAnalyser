import { randomBytes } from "node:crypto";
import { CREDENTIAL_ENV, envCredentialValue, envVarName } from "@/lib/credential-env";
import { open, seal, StorageError } from "@/lib/crypto/seal";
import { getDb } from "@/lib/db";
import type { CredentialStatus } from "@/lib/credential-status";
import { maskValue } from "@/lib/mask";
import type { CredentialField, TokenSet } from "@/lib/providers/types";

const STATE_TTL_MS = 10 * 60 * 1000;

export type { CredentialFieldStatus, CredentialStatus } from "@/lib/credential-status";

type CredentialRow = { payload: string };
type TokenRow = { payload: string };
type StateRow = {
  platform: string;
  redirect_uri: string;
  expires_at: number;
  code_verifier: string | null;
  user_id: string | null;
};

function readJson<T>(payload: string): T {
  const text = open(payload);
  return JSON.parse(text) as T;
}

function readStoredCredentials(platform: string): Record<string, string> | null {
  const row = getDb()
    .prepare("SELECT payload FROM credentials WHERE platform = ?")
    .get(platform) as CredentialRow | undefined;
  if (!row) return null;
  const parsed = readJson<Record<string, string>>(row.payload);
  if (!parsed || typeof parsed !== "object") return null;
  return parsed;
}

export function readCredentials(platform: string): Record<string, string> | null {
  const stored = readStoredCredentials(platform) ?? {};
  const merged: Record<string, string> = { ...stored };
  for (const key of Object.keys(CREDENTIAL_ENV[platform] ?? {})) {
    const fromEnv = envCredentialValue(platform, key);
    if (fromEnv) merged[key] = fromEnv;
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

export function describeCredentials(
  platform: string,
  fields: CredentialField[],
): CredentialStatus {
  let current: Record<string, string> | null = null;
  try {
    current = readCredentials(platform);
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw error;
  }
  return {
    configured:
      fields.some((field) => !field.optional) &&
      fields.filter((field) => !field.optional).every((field) => Boolean(current?.[field.key])),
    fields: fields.map((field) => {
      const fromEnv = envCredentialValue(platform, field.key);
      const value = fromEnv ?? current?.[field.key];
      const set = Boolean(value);
      const reveal = Boolean(field.reveal && !field.secret && set && value);
      return {
        key: field.key,
        secret: field.secret,
        set,
        hint: set && value && !field.secret && !reveal ? maskValue(value) : null,
        value: reveal && value ? value : null,
        source: fromEnv ? "env" : value ? "stored" : "empty",
        envVar: envVarName(platform, field.key),
      };
    }),
  };
}

export function upsertCredentials(
  platform: string,
  incoming: Record<string, unknown>,
  fields: CredentialField[],
  prepare?: (fields: Record<string, string>) =>
    | { ok: true; fields: Record<string, string> }
    | { ok: false; message: string },
): { ok: true; status: CredentialStatus } | { ok: false; message: string } {
  const current = readStoredCredentials(platform) ?? {};
  let next: Record<string, string> = { ...current };

  for (const field of fields) {
    if (envCredentialValue(platform, field.key)) continue;
    const raw = incoming[field.key];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) {
      if (field.optional) delete next[field.key];
      continue;
    }
    next[field.key] = trimmed;
  }

  if (prepare) {
    const prepared = prepare(next);
    if (!prepared.ok) return prepared;
    next = prepared.fields;
  }

  const effective = readCredentials(platform) ?? {};
  for (const [key, value] of Object.entries(next)) effective[key] = value;
  const missing = fields.filter((field) => !field.optional && !effective[field.key]);
  if (missing.length > 0) {
    const names = missing.map((field) => field.label).join(" و ");
    return { ok: false, message: `أدخل ${names}.` };
  }

  const payload = seal(JSON.stringify(next));
  getDb()
    .prepare(
      `INSERT INTO credentials (platform, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(platform) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    )
    .run(platform, payload, Date.now());

  return { ok: true, status: describeCredentials(platform, fields) };
}

export function readTokens(userId: string, platform: string): TokenSet | null {
  const row = getDb()
    .prepare("SELECT payload FROM tokens WHERE user_id = ? AND platform = ?")
    .get(userId, platform) as TokenRow | undefined;
  if (!row) return null;
  const parsed = readJson<TokenSet>(row.payload);
  if (!parsed?.accessToken || typeof parsed.expiresAt !== "number") return null;
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken ?? null,
    expiresAt: parsed.expiresAt,
    scope: parsed.scope ?? "",
    tokenType: parsed.tokenType ?? "Bearer",
    openId: typeof parsed.openId === "string" ? parsed.openId : undefined,
    refreshExpiresAt: typeof parsed.refreshExpiresAt === "number" ? parsed.refreshExpiresAt : undefined,
  };
}

export function saveTokens(userId: string, platform: string, tokens: TokenSet): void {
  const payload = seal(JSON.stringify(tokens));
  getDb()
    .prepare(
      `INSERT INTO tokens (user_id, platform, payload, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, platform) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    )
    .run(userId, platform, payload, Date.now());
}

export function deleteTokens(userId: string, platform: string): void {
  getDb().prepare("DELETE FROM tokens WHERE user_id = ? AND platform = ?").run(userId, platform);
}

export function hasTokens(userId: string, platform: string): boolean {
  try {
    return Boolean(readTokens(userId, platform)?.accessToken);
  } catch (error) {
    if (error instanceof StorageError) throw error;
    return false;
  }
}

export function createOAuthState(
  platform: string,
  redirectUri: string,
  userId: string,
  now = Date.now(),
  codeVerifier?: string,
): string {
  const db = getDb();
  db.prepare("DELETE FROM oauth_states WHERE expires_at < ?").run(now);
  const state = randomBytes(24).toString("base64url");
  db.prepare(
    `INSERT INTO oauth_states (state, platform, redirect_uri, expires_at, code_verifier, user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(state, platform, redirectUri, now + STATE_TTL_MS, codeVerifier ?? null, userId);
  return state;
}

export function consumeOAuthState(
  state: string,
  now = Date.now(),
): { platform: string; redirectUri: string; codeVerifier: string | null; userId: string | null } | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT platform, redirect_uri, expires_at, code_verifier, user_id FROM oauth_states WHERE state = ?",
    )
    .get(state) as StateRow | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
  if (row.expires_at < now) return null;
  return {
    platform: row.platform,
    redirectUri: row.redirect_uri,
    codeVerifier: row.code_verifier,
    userId: row.user_id,
  };
}
