import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const databaseUrl = process.env.DATABASE_URL ?? "file:./specora.db";
const filePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : "./specora.db";

const sqlite = new Database(filePath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { schema };

export function initDb(): void {
  sqlite.exec(`
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
}
