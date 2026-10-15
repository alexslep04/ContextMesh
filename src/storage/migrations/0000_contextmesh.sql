CREATE TABLE IF NOT EXISTS cm_projects (
  id TEXT PRIMARY KEY NOT NULL,
  repository_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cm_sessions (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  status TEXT NOT NULL,
  task_id TEXT,
  last_activity_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS cm_tasks (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  expected_files TEXT NOT NULL,
  modified_files TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS cm_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  identity TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  source TEXT NOT NULL,
  source_event_id TEXT,
  type TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cm_memories (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  current_version_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS cm_memory_versions (
  id TEXT PRIMARY KEY NOT NULL,
  memory_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  kind TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source_session_id TEXT,
  supersedes_version_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cm_warnings (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_ids TEXT NOT NULL,
  files TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS cm_memory_search USING fts5(
  memory_version_id UNINDEXED,
  project_id UNINDEXED,
  kind UNINDEXED,
  content
);
