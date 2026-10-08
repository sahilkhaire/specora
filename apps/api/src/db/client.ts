import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { databasePath } from "../config.js";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

let sqlite: Database.Database | null = null;

/**
 * Live binding: route modules import `db` directly and see the instance
 * created by `initDb()`. Calling any route before `initDb()` is a bug.
 */
export let db: Db = undefined as unknown as Db;
export { schema };

type Migration = (conn: Database.Database) => void;

function hasColumn(conn: Database.Database, table: string, column: string): boolean {
  const rows = conn.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

/**
 * Ordered, append-only migrations tracked with `PRAGMA user_version`.
 * Never edit a shipped migration; add a new one.
 */
const migrations: Migration[] = [
  // 1: initial schema (matches databases created before versioning existed).
  (conn) => {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'private',
        base_domain TEXT,
        admin_password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        instance_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        spec_source_json TEXT,
        spec_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT PRIMARY KEY,
        active_workspace_id TEXT NOT NULL DEFAULT '',
        environments_json TEXT NOT NULL DEFAULT '[]',
        active_environment_id TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS published_sites (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        hosting_type TEXT NOT NULL,
        public_host TEXT,
        custom_domain TEXT,
        custom_domain_verified_at TEXT,
        is_published INTEGER NOT NULL DEFAULT 0
      );
    `);
  },
  // 2: columns the ORM schema already referenced, admin sessions, hashed
  //    session ids (old raw-id sessions are dropped), and lookup indexes.
  (conn) => {
    if (!hasColumn(conn, "workspaces", "collection_json")) {
      conn.exec("ALTER TABLE workspaces ADD COLUMN collection_json TEXT");
    }
    if (!hasColumn(conn, "workspaces", "history_json")) {
      conn.exec("ALTER TABLE workspaces ADD COLUMN history_json TEXT");
    }
    conn.exec(`
      DELETE FROM sessions;
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON workflows(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_published_sites_custom_domain ON published_sites(custom_domain);
    `);
  },
];

function migrate(conn: Database.Database): void {
  const current = conn.pragma("user_version", { simple: true }) as number;
  for (let version = current; version < migrations.length; version++) {
    conn.transaction(() => {
      migrations[version]!(conn);
      conn.pragma(`user_version = ${version + 1}`);
    })();
  }
}

export function initDb(path = databasePath()): Db {
  closeDb();
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  migrate(sqlite);
  db = drizzle(sqlite, { schema });
  return db;
}

export function closeDb(): void {
  sqlite?.close();
  sqlite = null;
}

export function pingDb(): boolean {
  try {
    sqlite?.prepare("SELECT 1").get();
    return sqlite !== null;
  } catch {
    return false;
  }
}
