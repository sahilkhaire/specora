import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const instances = sqliteTable("instances", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  visibility: text("visibility").notNull().default("private"),
  baseDomain: text("base_domain"),
  adminPasswordHash: text("admin_password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  instanceId: text("instance_id"),
  name: text("name").notNull(),
  description: text("description"),
  specSourceJson: text("spec_source_json"),
  specJson: text("spec_json"),
  collectionJson: text("collection_json"),
  historyJson: text("history_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userState = sqliteTable("user_state", {
  userId: text("user_id").primaryKey(),
  activeWorkspaceId: text("active_workspace_id").notNull().default(""),
  environmentsJson: text("environments_json").notNull().default("[]"),
  activeEnvironmentId: text("active_environment_id").notNull().default(""),
});

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  payloadJson: text("payload_json").notNull(),
});

export const publishedSites = sqliteTable("published_sites", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().unique(),
  slug: text("slug").notNull().unique(),
  hostingType: text("hosting_type").notNull(),
  publicHost: text("public_host"),
  customDomain: text("custom_domain"),
  customDomainVerifiedAt: text("custom_domain_verified_at"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
});
