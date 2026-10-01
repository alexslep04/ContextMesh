import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  repositoryPath: text("repository_path").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  agentType: text("agent_type").notNull(),
  status: text("status").notNull(),
  lastActivityAt: text("last_activity_at").notNull(),
  revision: integer("revision").notNull().default(0),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  sessionId: text("session_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  expectedFiles: text("expected_files", { mode: "json" }).$type<string[]>().notNull(),
  updatedAt: text("updated_at").notNull(),
  revision: integer("revision").notNull().default(0),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  sourceEventId: text("source_event_id"),
  type: text("type").notNull(),
  projectId: text("project_id").notNull(),
  sessionId: text("session_id").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  occurredAt: text("occurred_at").notNull(),
}, (table) => ({
  sourceIdentity: uniqueIndex("events_source_identity").on(table.source, table.sourceEventId, table.projectId, table.sessionId),
}));

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  currentVersionId: text("current_version_id"),
  status: text("status").notNull().default("active"),
});

export const memoryVersions = sqliteTable("memory_versions", {
  id: text("id").primaryKey(),
  memoryId: text("memory_id").notNull(),
  version: integer("version").notNull(),
  kind: text("kind").notNull(),
  projectId: text("project_id").notNull(),
  content: text("content").notNull(),
  sourceSessionId: text("source_session_id"),
  supersedesVersionId: text("supersedes_version_id"),
  createdAt: text("created_at").notNull(),
});
