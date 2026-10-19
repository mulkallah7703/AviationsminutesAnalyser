import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";

export const USER_COOKIE = "diwan_user";
export const ADMIN_COOKIE = "diwan_admin";

const USER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export type LocalUser = {
  id: string;
  displayName: string;
};

type UserRow = { id: string; display_name: string; password_hash: string };
type SessionRow = { kind: string; user_id: string | null; expires_at: number };

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function adminPasswordIsSet(): boolean {
  const row = getDb().prepare("SELECT value FROM app_meta WHERE key = ?").get("admin_password_hash") as
    | { value: string }
    | undefined;
  return Boolean(row?.value);
}

export function setAdminPassword(password: string): { ok: true } | { ok: false; message: string } {
  const checked = checkPassword(password);
  if (!checked.ok) return checked;
  if (adminPasswordIsSet()) {
    return { ok: false, message: "كلمة مرور المسؤول مضبوطة مسبقاً." };
  }
  getDb()
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES ('admin_password_hash', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(hashPassword(password));
  return { ok: true };
}

export function verifyAdminPassword(password: string): boolean {
  const row = getDb().prepare("SELECT value FROM app_meta WHERE key = ?").get("admin_password_hash") as
    | { value: string }
    | undefined;
  if (!row?.value) return false;
  return verifyPassword(password, row.value);
}

export function registerUser(
  displayName: string,
  password: string,
): { ok: true; user: LocalUser } | { ok: false; message: string } {
  const name = normalizeName(displayName);
  if (!name.ok) return name;
  const checked = checkPassword(password);
  if (!checked.ok) return checked;
  const user: LocalUser = { id: randomBytes(16).toString("base64url"), displayName: name.name };
  try {
    getDb()
      .prepare("INSERT INTO users (id, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(user.id, user.displayName, hashPassword(password), Date.now());
  } catch {
    return { ok: false, message: "هذا الاسم مستخدم. اختر اسماً آخر أو ادخل بالحساب الموجود." };
  }
  return { ok: true, user };
}

export function loginUser(
  displayName: string,
  password: string,
): { ok: true; user: LocalUser } | { ok: false; message: string } {
  const name = normalizeName(displayName);
  if (!name.ok) return name;
  const row = getDb()
    .prepare("SELECT id, display_name, password_hash FROM users WHERE display_name = ?")
    .get(name.name) as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, message: "الاسم أو كلمة المرور غير صحيحة." };
  }
  return { ok: true, user: { id: row.id, displayName: row.display_name } };
}

export function createSession(kind: "user" | "admin", userId: string | null, now = Date.now()): string {
  const token = randomBytes(32).toString("base64url");
  const ttl = kind === "admin" ? ADMIN_SESSION_MS : USER_SESSION_MS;
  getDb()
    .prepare("INSERT INTO sessions (token_hash, kind, user_id, expires_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), kind, userId, now + ttl);
  return token;
}

export function destroySession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function userFromSessionToken(token: string, now = Date.now()): LocalUser | null {
  const row = readSession(token, now);
  if (!row || row.kind !== "user" || !row.user_id) return null;
  const user = getDb()
    .prepare("SELECT id, display_name FROM users WHERE id = ?")
    .get(row.user_id) as { id: string; display_name: string } | undefined;
  if (!user) return null;
  return { id: user.id, displayName: user.display_name };
}

export function adminFromSessionToken(token: string, now = Date.now()): boolean {
  const row = readSession(token, now);
  return Boolean(row && row.kind === "admin");
}

export function readCookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export function userFromRequest(request: Request): LocalUser | null {
  const token = readCookieValue(request.headers.get("cookie"), USER_COOKIE);
  if (!token) return null;
  return userFromSessionToken(token);
}

export function adminFromRequest(request: Request): boolean {
  const token = readCookieValue(request.headers.get("cookie"), ADMIN_COOKIE);
  if (!token) return false;
  return adminFromSessionToken(token);
}

export function sessionCookie(request: Request, maxAgeSeconds: number) {
  const forwarded = request.headers.get("x-forwarded-proto");
  const https = new URL(request.url).protocol === "https:" || forwarded === "https";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
    secure: https,
  };
}

function readSession(token: string, now: number): SessionRow | null {
  const row = getDb()
    .prepare("SELECT kind, user_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(hashToken(token)) as SessionRow | undefined;
  if (!row) return null;
  if (row.expires_at < now) {
    destroySession(token);
    return null;
  }
  return row;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeName(displayName: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = displayName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) {
    return { ok: false, message: "اسم العرض بين حرفين و40 حرفاً." };
  }
  return { ok: true, name };
}

function checkPassword(password: string): { ok: true } | { ok: false; message: string } {
  if (password.length < 8 || password.length > 200) {
    return { ok: false, message: "كلمة المرور من 8 أحرف على الأقل." };
  }
  return { ok: true };
}
