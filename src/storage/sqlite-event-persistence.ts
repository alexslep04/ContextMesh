import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as tables from "./schema.js";
import { migrate } from "./migrate.js";
import type { EventPersistence } from "../application/event-persistence.js";
import { eventScope } from "../application/event-processor.js";
import { contextMeshEventSchema, type ContextMeshEvent } from "../domain/events.js";
import type { GitEvidence, Session, Task, Warning } from "../domain/entities.js";
import { currentMemories, type MemoryVersion } from "../domain/memories.js";
import type { PersistedProcessorState, ProcessorSnapshot } from "../domain/state.js";
export class SqliteEventPersistence implements EventPersistence {
  private readonly db;
  constructor(private readonly database: Database.Database) {
    migrate(database);
    this.db = drizzle(database, { schema: tables });
  }
  load(): PersistedProcessorState {
    const rows = this.db.select().from(tables.events).all();
    const events = rows.map(row => contextMeshEventSchema.parse({ ...row, eventId: row.eventId, sourceEventId: row.sourceEventId ?? undefined }));
    const latestEventAt: Record<string, string> = {};
    for (const event of events) {
      const scope = eventScope(event), time = new Date(event.occurredAt).toISOString();
      if (!latestEventAt[scope] || latestEventAt[scope] < time) latestEventAt[scope] = time;
    }
    return { events, eventIdentities: rows.map(row => row.identity), latestEventAt, snapshot: {
      projects: this.db.select().from(tables.projects).all(),
      sessions: this.db.select().from(tables.sessions).all().map(row => row.details ?? ({ id: row.id, projectId: row.projectId, agentType: row.agentType, status: row.status, taskId: row.taskId ?? undefined, lastActivityAt: row.lastActivityAt } as Session)),
      tasks: this.db.select().from(tables.tasks).all().map(row => row.details ?? ({ id: row.id, projectId: row.projectId, sessionId: row.sessionId, title: row.title, status: row.status, expectedFiles: row.expectedFiles, reportedFiles: row.modifiedFiles, modifiedFiles: [], updatedAt: row.updatedAt } as Task)),
      warnings: this.db.select().from(tables.warnings).all().map(row => row.details ?? ({ ...row, details: undefined } as unknown as Warning)),
      memoryVersions: this.db.select().from(tables.memoryVersions).all().map(row => row.details ?? ({ ...row, memoryId: row.memoryId, sourceSessionId: row.sourceSessionId ?? undefined, supersedesVersionId: row.supersedesVersionId ?? undefined } as MemoryVersion)),
      blockers: this.db.select().from(tables.blockers).all().map(row => row.data),
      evidence: this.db.select().from(tables.repositoryEvidence).all().map(row => row.data), acceptedEventCount: rows.length,
    }};
  }
  persist(event: ContextMeshEvent, identity: string, snapshot: ProcessorSnapshot): boolean {
    return this.db.transaction(tx => {
      const inserted = tx.insert(tables.events).values({ id: identity, eventId: event.eventId, identity, scope: eventScope(event), source: event.source, sourceEventId: event.sourceEventId, type: event.type, projectId: event.projectId, sessionId: event.sessionId, payload: event.payload, occurredAt: event.occurredAt }).onConflictDoNothing({ target: tables.events.identity }).run();
      if (!inserted.changes) return false;
      for (const project of snapshot.projects.filter(p => p.id === event.projectId)) tx.insert(tables.projects).values(project).onConflictDoUpdate({ target: tables.projects.id, set: { repositoryPath: project.repositoryPath } }).run();
      for (const session of snapshot.sessions.filter(s => s.projectId === event.projectId)) {
        const row = { id: session.id, projectId: session.projectId, agentType: session.agentType, status: session.status, taskId: session.taskId ?? null, lastActivityAt: session.lastActivityAt, details: session };
        tx.insert(tables.sessions).values(row).onConflictDoUpdate({ target: [tables.sessions.projectId, tables.sessions.id], set: row }).run();
      }
      for (const task of snapshot.tasks.filter(t => t.projectId === event.projectId)) {
        const row = { id: task.id, projectId: task.projectId, sessionId: task.sessionId, title: task.title, status: task.status, expectedFiles: task.expectedFiles, modifiedFiles: task.modifiedFiles, updatedAt: task.updatedAt, details: task };
        tx.insert(tables.tasks).values(row).onConflictDoUpdate({ target: [tables.tasks.projectId, tables.tasks.id], set: row }).run();
      }
      tx.delete(tables.warnings).where(eq(tables.warnings.projectId, event.projectId)).run();
      for (const warning of snapshot.warnings.filter(w => w.projectId === event.projectId)) tx.insert(tables.warnings).values({ ...warning, details: warning }).run();
      for (const blocker of snapshot.blockers.filter(b => b.projectId === event.projectId)) tx.insert(tables.blockers).values({ id: blocker.id, projectId: blocker.projectId, data: blocker }).onConflictDoUpdate({ target: [tables.blockers.projectId, tables.blockers.id], set: { data: blocker } }).run();
      const versions = snapshot.memoryVersions.filter(m => m.projectId === event.projectId);
      for (const version of versions) tx.insert(tables.memoryVersions).values({ ...version, memoryId: memoryKey(version.projectId, version.memoryId), details: version }).onConflictDoNothing({ target: tables.memoryVersions.id }).run();
      // FTS5 is an index of current versions, never the historical source of truth.
      this.database.prepare("DELETE FROM cm_memory_search WHERE project_id = ?").run(event.projectId);
      const search = this.database.prepare("INSERT INTO cm_memory_search (memory_version_id, project_id, kind, content) VALUES (?, ?, ?, ?)");
      for (const version of currentMemories(versions, true)) {
        const status = version.deleted ? "deleted" : "active";
        tx.insert(tables.memories).values({ id: memoryKey(version.projectId, version.memoryId), projectId: version.projectId, currentVersionId: version.id, status }).onConflictDoUpdate({ target: tables.memories.id, set: { currentVersionId: version.id, status } }).run();
        if (!version.deleted) search.run(version.id, version.projectId, version.kind, version.content + " " + (version.rationale ?? ""));
      }
      return true;
    });
  }
  saveEvidence(evidence: GitEvidence): void {
    const row = { id: JSON.stringify([evidence.projectId, evidence.worktreePath]), projectId: evidence.projectId, data: evidence };
    this.db.insert(tables.repositoryEvidence).values(row).onConflictDoUpdate({ target: tables.repositoryEvidence.id, set: row }).run();
  }
  searchMemories(projectId: string, terms: string[], limit: number): string[] {
    const match = terms.map(term => '"' + term.replaceAll('"', '""') + '"').join(" AND ");
    const rows = this.database.prepare("SELECT memory_version_id FROM cm_memory_search WHERE cm_memory_search MATCH ? AND project_id = ? ORDER BY bm25(cm_memory_search), memory_version_id LIMIT ?").all(match, projectId, limit) as { memory_version_id: string }[];
    return rows.map(row => row.memory_version_id);
  }
}
function memoryKey(projectId: string, memoryId: string): string { return JSON.stringify([projectId, memoryId]); }
