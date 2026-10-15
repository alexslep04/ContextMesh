import type Database from "better-sqlite3";
import type { EventPersistence } from "../application/event-persistence.js";
import type { ContextMeshEvent } from "../domain/events.js";
import type { Session, Task, Warning } from "../domain/entities.js";
import type { PersistedProcessorState, ProcessorSnapshot } from "../domain/state.js";

const schema = `
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
  CREATE TABLE IF NOT EXISTS cm_warnings (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    project_id TEXT NOT NULL,
    task_ids TEXT NOT NULL,
    files TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

export class SqliteEventPersistence implements EventPersistence {
  constructor(private readonly database: Database.Database) {
    this.database.exec(schema);
  }

  load(): PersistedProcessorState {
    const sessions = this.database.prepare("SELECT * FROM cm_sessions").all() as SessionRow[];
    const tasks = this.database.prepare("SELECT * FROM cm_tasks").all() as TaskRow[];
    const warnings = this.database.prepare("SELECT * FROM cm_warnings").all() as WarningRow[];
    const eventIdentities = (this.database.prepare("SELECT identity FROM cm_events").all() as IdentityRow[])
      .map((row) => row.identity);
    const latestEventAt = Object.fromEntries(
      (this.database.prepare(
        "SELECT scope, MAX(occurred_at) AS occurred_at FROM cm_events GROUP BY scope",
      ).all() as LatestEventRow[])
        .map((row) => [row.scope, row.occurred_at]),
    );

    return {
      snapshot: {
        sessions: sessions.map(toSession),
        tasks: tasks.map(toTask),
        warnings: warnings.map(toWarning),
        acceptedEventCount: eventIdentities.length,
      },
      eventIdentities,
      latestEventAt,
    };
  }

  persist(event: ContextMeshEvent, identity: string, snapshot: ProcessorSnapshot): boolean {
    const transaction = this.database.transaction(() => {
      const eventResult = this.database.prepare(
        `INSERT INTO cm_events
          (id, event_id, identity, scope, source, source_event_id, type, project_id, session_id, payload, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(identity) DO NOTHING`,
      ).run(
        identity,
        event.eventId,
        identity,
        eventScope(event),
        event.source,
        event.sourceEventId ?? null,
        event.type,
        event.projectId,
        event.sessionId,
        JSON.stringify(event.payload),
        event.occurredAt,
      );

      if (eventResult.changes === 0) return false;

      const sessionStatement = this.database.prepare(
        `INSERT INTO cm_sessions (id, project_id, agent_type, status, task_id, last_activity_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, id) DO UPDATE SET
           project_id = excluded.project_id,
           agent_type = excluded.agent_type,
           status = excluded.status,
           task_id = excluded.task_id,
           last_activity_at = excluded.last_activity_at
         WHERE excluded.last_activity_at >= cm_sessions.last_activity_at`,
      );
      for (const session of snapshot.sessions.filter(
        (item) => item.projectId === event.projectId && item.id === event.sessionId,
      )) {
        sessionStatement.run(
          session.id,
          session.projectId,
          session.agentType,
          session.status,
          session.taskId ?? null,
          session.lastActivityAt,
        );
      }

      const taskStatement = this.database.prepare(
        `INSERT INTO cm_tasks
          (id, project_id, session_id, title, status, expected_files, modified_files, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, id) DO UPDATE SET
           project_id = excluded.project_id,
           session_id = excluded.session_id,
           title = excluded.title,
           status = excluded.status,
           expected_files = excluded.expected_files,
           modified_files = excluded.modified_files,
           updated_at = excluded.updated_at
         WHERE excluded.updated_at >= cm_tasks.updated_at`,
      );
      const taskId = typeof event.payload.taskId === "string" ? event.payload.taskId : undefined;
      for (const task of snapshot.tasks.filter(
        (item) => item.projectId === event.projectId && item.id === taskId,
      )) {
        taskStatement.run(
          task.id,
          task.projectId,
          task.sessionId,
          task.title,
          task.status,
          JSON.stringify(task.expectedFiles),
          JSON.stringify(task.modifiedFiles),
          task.updatedAt,
        );
      }

      rebuildWarnings(this.database, event.projectId);
      return true;
    });

    return transaction();
  }
}

interface IdentityRow { identity: string }
interface LatestEventRow { scope: string; occurred_at: string }
interface SessionRow {
  id: string;
  project_id: string;
  agent_type: Session["agentType"];
  status: Session["status"];
  task_id: string | null;
  last_activity_at: string;
}
interface TaskRow {
  id: string;
  project_id: string;
  session_id: string;
  title: string;
  status: Task["status"];
  expected_files: string;
  modified_files: string;
  updated_at: string;
}
interface WarningRow {
  id: string;
  kind: Warning["kind"];
  project_id: string;
  task_ids: string;
  files: string;
  message: string;
  created_at: string;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    agentType: row.agent_type,
    status: row.status,
    taskId: row.task_id ?? undefined,
    lastActivityAt: row.last_activity_at,
  };
}

function eventScope(event: ContextMeshEvent): string {
  const taskId = typeof event.payload.taskId === "string" ? event.payload.taskId : undefined;
  return JSON.stringify([event.projectId, taskId ? "task" : "session", taskId ?? event.sessionId]);
}

function rebuildWarnings(database: Database.Database, projectId: string): void {
  const tasks = database.prepare("SELECT * FROM cm_tasks WHERE project_id = ?").all(projectId) as TaskRow[];
  database.prepare("DELETE FROM cm_warnings WHERE project_id = ?").run(projectId);
  const insert = database.prepare(
    `INSERT INTO cm_warnings
      (id, kind, project_id, task_ids, files, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (let index = 0; index < tasks.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < tasks.length; otherIndex += 1) {
      const task = tasks[index];
      const other = tasks[otherIndex];
      if (task.status !== "active" || other.status !== "active") continue;
      const expectedFiles = JSON.parse(task.expected_files) as string[];
      const otherExpectedFiles = JSON.parse(other.expected_files) as string[];
      const modifiedFiles = JSON.parse(task.modified_files) as string[];
      const otherModifiedFiles = JSON.parse(other.modified_files) as string[];
      insertWarning(insert, "expected_overlap", projectId, task, other, expectedFiles.filter((file) => otherExpectedFiles.includes(file)));
      insertWarning(insert, "confirmed_overlap", projectId, task, other, modifiedFiles.filter((file) => otherModifiedFiles.includes(file)));
    }
  }
}

function insertWarning(
  insert: Database.Statement,
  kind: Warning["kind"],
  projectId: string,
  task: TaskRow,
  other: TaskRow,
  files: string[],
): void {
  if (files.length === 0) return;
  const taskIds = [task.id, other.id];
  insert.run(
    JSON.stringify([projectId, kind, [...taskIds].sort()]),
    kind,
    projectId,
    JSON.stringify(taskIds),
    JSON.stringify(files),
    kind === "expected_overlap"
      ? "Active tasks expect to modify the same files."
      : "Active tasks have modified the same files.",
    new Date().toISOString(),
  );
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    title: row.title,
    status: row.status,
    expectedFiles: JSON.parse(row.expected_files) as string[],
    modifiedFiles: JSON.parse(row.modified_files) as string[],
    updatedAt: row.updated_at,
  };
}

function toWarning(row: WarningRow): Warning {
  return {
    id: row.id,
    kind: row.kind,
    projectId: row.project_id,
    taskIds: JSON.parse(row.task_ids) as string[],
    files: JSON.parse(row.files) as string[],
    message: row.message,
    createdAt: row.created_at,
  };
}
