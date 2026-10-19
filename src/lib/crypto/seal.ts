import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "@/lib/paths";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cached: { dir: string; key: Buffer } | null = null;

export class StorageError extends Error {
  constructor(public code: "master_key_missing" | "master_key_invalid" | "decrypt_failed") {
    super(code);
    this.name = "StorageError";
  }
}

export function resetSealForTests(): void {
  cached = null;
}

export function loadOrCreateKey(): Buffer {
  const dir = getDataDir();
  if (cached?.dir === dir) return cached.key;

  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, "master.key");

  if (!fs.existsSync(file)) {
    const key = randomBytes(32);
    fs.writeFileSync(file, key, { mode: 0o600 });
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      // Windows and some filesystems ignore chmod. The key still stays local.
    }
    cached = { dir, key };
    return key;
  }

  const key = fs.readFileSync(file);
  if (key.length !== 32) {
    throw new StorageError("master_key_invalid");
  }
  cached = { dir, key };
  return key;
}

export function seal(plaintext: string, key = loadOrCreateKey()): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function open(payload: string, key = loadOrCreateKey()): string {
  try {
    const buf = Buffer.from(payload, "base64url");
    if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
      throw new Error("short");
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError("decrypt_failed");
  }
}
