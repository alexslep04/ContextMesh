import type { Session, Task, Warning, Blocker, GitEvidence } from "../domain/entities.js";
import type { MemoryVersion } from "../domain/memories.js";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("cm_projects", {
  id: text("id").primaryKey(),
  repositoryPath: text("repository_path").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("cm_sessions", {
  details: text("details", { mode: "json" }).$type<Session>(),
  id: text("id").notNull(),
  projectId: text("project_id").notNull(),
  agentType: text("agent_type").notNull(),
  status: text("status").notNull(),
  taskId: text("task_id"),
  lastActivityAt: text("last_activity_at").notNull(),
  revision: integer("revision").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.projectId, table.id] }),
}));

export const tasks = sqliteTable("cm_tasks", {
  details: text("details", { mode: "json" }).$type<Task>(),
  id: text("id").notNull(),
  projectId: text("project_id").notNull(),
  sessionId: text("session_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  expectedFiles: text("expected_files", { mode: "json" }).$type<string[]>().notNull(),
  modifiedFiles: text("modified_files", { mode: "json" }).$type<string[]>().notNull(),
  updatedAt: text("updated_at").notNull(),
  revision: integer("revision").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.projectId, table.id] }),
}));

export const events = sqliteTable("cm_events", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  identity: text("identity").notNull(),
  scope: text("scope").notNull(),
  source: text("source").notNull(),
  sourceEventId: text("source_event_id"),
  type: text("type").notNull(),
  projectId: text("project_id").notNull(),
  sessionId: text("session_id").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  occurredAt: text("occurred_at").notNull(),
}, (table) => ({
  sourceIdentity: uniqueIndex("cm_events_identity").on(table.identity),
}));

export const memories = sqliteTable("cm_memories", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  currentVersionId: text("current_version_id"),
  status: text("status").notNull().default("active"),
});

export const memoryVersions = sqliteTable("cm_memory_versions", {
  details: text("details", { mode: "json" }).$type<MemoryVersion>(),
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

export const warnings = sqliteTable("cm_warnings", {
  details: text("details", { mode: "json" }).$type<Warning>(),
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  projectId: text("project_id").notNull(),
  taskIds: text("task_ids", { mode: "json" }).$type<string[]>().notNull(),
  files: text("files", { mode: "json" }).$type<string[]>().notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

export const blockers = sqliteTable("cm_blockers", {
  id: text("id").notNull(), projectId: text("project_id").notNull(), data: text("data", { mode: "json" }).$type<Blocker>().notNull(),
}, table => ({ pk: primaryKey({ columns: [table.projectId, table.id] }) }));
export const repositoryEvidence = sqliteTable("cm_repository_evidence", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), data: text("data", { mode: "json" }).$type<GitEvidence>().notNull(),
});
