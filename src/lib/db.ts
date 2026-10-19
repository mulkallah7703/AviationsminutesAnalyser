import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadOrCreateKey, StorageError } from "@/lib/crypto/seal";
import { getDataDir } from "@/lib/paths";

let singleton: DatabaseSync | null = null;
let singletonDir: string | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS credentials (
  platform TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, platform)
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  code_verifier TEXT,
  user_id TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  user_id TEXT,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tiktok_video_cache (
  user_id TEXT NOT NULL,
  open_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, open_id)
);
CREATE TABLE IF NOT EXISTS tiktok_follower_snapshots (
  user_id TEXT NOT NULL,
  open_id TEXT NOT NULL,
  day TEXT NOT NULL,
  followers INTEGER NOT NULL,
  PRIMARY KEY (user_id, open_id, day)
);
CREATE TABLE IF NOT EXISTS x_post_cache (
  user_id TEXT NOT NULL,
  x_user_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, x_user_id)
);
CREATE TABLE IF NOT EXISTS x_follower_snapshots (
  user_id TEXT NOT NULL,
  x_user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  followers INTEGER NOT NULL,
  PRIMARY KEY (user_id, x_user_id, day)
);
`;

export function getDb(): DatabaseSync {
  const dir = getDataDir();
  if (singleton && singletonDir === dir) return singleton;
  if (singleton) {
    singleton.close();
    singleton = null;
  }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const databasePath = path.join(dir, "app.db");
  const keyPath = path.join(dir, "master.key");
  if (fs.existsSync(databasePath) && !fs.existsSync(keyPath)) {
    throw new StorageError("master_key_missing");
  }
  loadOrCreateKey();
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  migrate(db);
  singleton = db;
  singletonDir = dir;
  return db;
}

function columnNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((row) => row.name);
}

function migrate(db: DatabaseSync): void {
  const tokenColumns = columnNames(db, "tokens");
  if (tokenColumns.length > 0 && !tokenColumns.includes("user_id")) {
    db.exec(`
      CREATE TABLE tokens_v2 (
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, platform)
      );
      INSERT INTO tokens_v2 (user_id, platform, payload, updated_at)
      SELECT 'legacy', platform, payload, updated_at FROM tokens;
      DROP TABLE tokens;
      ALTER TABLE tokens_v2 RENAME TO tokens;
    `);
  }

  const stateColumns = columnNames(db, "oauth_states");
  if (!stateColumns.includes("code_verifier")) {
    db.exec("ALTER TABLE oauth_states ADD COLUMN code_verifier TEXT");
  }
  if (!stateColumns.includes("user_id")) {
    db.exec("ALTER TABLE oauth_states ADD COLUMN user_id TEXT");
  }
}

export function resetDbForTests(): void {
  if (singleton) {
    singleton.close();
    singleton = null;
    singletonDir = null;
  }
}
