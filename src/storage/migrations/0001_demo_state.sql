ALTER TABLE cm_sessions ADD COLUMN details TEXT;
ALTER TABLE cm_tasks ADD COLUMN details TEXT;
ALTER TABLE cm_warnings ADD COLUMN details TEXT;
ALTER TABLE cm_memory_versions ADD COLUMN details TEXT;
CREATE TABLE cm_blockers (id TEXT NOT NULL, project_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (project_id, id));
CREATE TABLE cm_repository_evidence (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX cm_events_project_time ON cm_events(project_id, occurred_at);
CREATE UNIQUE INDEX cm_memory_version_number ON cm_memory_versions(memory_id, version);
