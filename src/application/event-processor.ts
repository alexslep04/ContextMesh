import { randomUUID } from "node:crypto";
import type { Session, Task, Warning } from "../domain/entities.js";
import type { EventPersistence } from "./event-persistence.js";
import {
  contextMeshEventSchema,
  type ContextMeshEvent,
} from "../domain/events.js";
import {
  filePayloadSchema,
  taskPayloadSchema,
  taskUpdatePayloadSchema,
} from "../domain/schemas.js";
import type { ProcessorSnapshot } from "../domain/state.js";

export type { ProcessorSnapshot } from "../domain/state.js";

export class EventProcessor {
  private readonly sessions = new Map<string, Session>();
  private readonly tasks = new Map<string, Task>();
  private readonly warnings = new Map<string, Warning>();
  private readonly acceptedEventIds = new Set<string>();
  private readonly latestEventAt = new Map<string, string>();

  constructor(private readonly persistence?: EventPersistence) {
    const state = persistence?.load();
    if (!state) return;
    for (const session of state.snapshot.sessions) this.sessions.set(stateKey(session.projectId, session.id), session);
    for (const task of state.snapshot.tasks) this.tasks.set(stateKey(task.projectId, task.id), task);
    for (const warning of state.snapshot.warnings) this.warnings.set(warning.id, warning);
    for (const identity of state.eventIdentities) this.acceptedEventIds.add(identity);
    for (const [scope, occurredAt] of Object.entries(state.latestEventAt)) this.latestEventAt.set(scope, occurredAt);
  }

  ingest(input: unknown): { accepted: boolean; snapshot: ProcessorSnapshot } {
    const event = contextMeshEventSchema.parse(input);
    return this.ingestValidated(event);
  }

  ingestValidated(event: ContextMeshEvent): { accepted: boolean; snapshot: ProcessorSnapshot } {
    const identity = eventIdentity(event);
    if (this.acceptedEventIds.has(identity)) {
      return { accepted: false, snapshot: this.snapshot() };
    }

    const scope = eventScope(event);
    const latestEventAt = this.latestEventAt.get(scope);
    if (latestEventAt && event.occurredAt < latestEventAt) {
      return { accepted: false, snapshot: this.snapshot() };
    }

    if (event.type === "task_started") {
      const taskId = typeof event.payload.taskId === "string" ? event.payload.taskId : undefined;
      const existingTask = taskId ? this.tasks.get(stateKey(event.projectId, taskId)) : undefined;
      if (existingTask?.status === "completed" && event.occurredAt <= existingTask.updatedAt) {
        return { accepted: false, snapshot: this.snapshot() };
      }
    }

    const previous = this.snapshot();
    try {
      this.apply(event);
      this.acceptedEventIds.add(identity);
      this.latestEventAt.set(scope, event.occurredAt);
      const snapshot = this.snapshot();
      const persisted = this.persistence?.persist(event, identity, snapshot) ?? true;
      if (!persisted) {
        this.restore(previous);
        this.acceptedEventIds.delete(identity);
        if (latestEventAt) this.latestEventAt.set(scope, latestEventAt);
        else this.latestEventAt.delete(scope);
        return { accepted: false, snapshot: this.snapshot() };
      }
      return { accepted: true, snapshot };
    } catch (error) {
      this.restore(previous);
      this.acceptedEventIds.delete(identity);
      if (latestEventAt) this.latestEventAt.set(scope, latestEventAt);
      else this.latestEventAt.delete(scope);
      throw error;
    }
  }

  snapshot(projectId?: string): ProcessorSnapshot {
    return {
      sessions: [...this.sessions.values()]
        .filter((session) => !projectId || session.projectId === projectId)
        .map((session) => ({ ...session })),
      tasks: [...this.tasks.values()]
        .filter((task) => !projectId || task.projectId === projectId)
        .map((task) => ({ ...task, expectedFiles: [...task.expectedFiles], modifiedFiles: [...task.modifiedFiles] })),
      warnings: [...this.warnings.values()]
        .filter((warning) => !projectId || warning.projectId === projectId)
        .map((warning) => ({ ...warning, taskIds: [...warning.taskIds], files: [...warning.files] })),
      acceptedEventCount: this.acceptedEventIds.size,
    };
  }

  private apply(event: ContextMeshEvent): void {
    switch (event.type) {
      case "session_started":
        this.sessions.set(stateKey(event.projectId, event.sessionId), {
          id: event.sessionId,
          projectId: event.projectId,
          agentType: event.source === "claude_code" || event.source === "codex"
            ? event.source
            : "mock",
          status: "active",
          lastActivityAt: event.occurredAt,
        });
        return;
      case "session_ended": {
        const session = this.sessions.get(stateKey(event.projectId, event.sessionId));
        if (session) {
          session.status = "ended";
          session.lastActivityAt = event.occurredAt;
        }
        return;
      }
      case "task_started": {
        const payload = taskPayloadSchema.parse(event.payload);
        this.tasks.set(stateKey(event.projectId, payload.taskId), {
          id: payload.taskId,
          projectId: event.projectId,
          sessionId: event.sessionId,
          title: payload.title,
          status: "active",
          expectedFiles: payload.expectedFiles,
          modifiedFiles: [],
          updatedAt: event.occurredAt,
        });
        const session = this.sessions.get(stateKey(event.projectId, event.sessionId));
        if (session) session.taskId = payload.taskId;
        this.refreshOverlaps(event.projectId);
        return;
      }
      case "task_updated": {
        const payload = taskUpdatePayloadSchema.parse(event.payload);
        const task = this.tasks.get(stateKey(event.projectId, payload.taskId));
        if (!this.ownsTask(task, event)) return;
        if (payload.title) task.title = payload.title;
        if (payload.expectedFiles) task.expectedFiles = payload.expectedFiles;
        task.updatedAt = event.occurredAt;
        this.refreshOverlaps(event.projectId);
        return;
      }
      case "task_completed": {
        const taskId = zTaskId(event.payload);
        const task = this.tasks.get(stateKey(event.projectId, taskId));
        if (this.ownsTask(task, event)) {
          task.status = "completed";
          task.updatedAt = event.occurredAt;
          this.refreshOverlaps(event.projectId);
        }
        return;
      }
      case "file_intent_declared": {
        const payload = filePayloadSchema.parse(event.payload);
        const task = this.tasks.get(stateKey(event.projectId, payload.taskId));
        if (this.ownsTask(task, event) && !task.expectedFiles.includes(payload.path)) {
          task.expectedFiles.push(payload.path);
          task.updatedAt = event.occurredAt;
          this.refreshOverlaps(event.projectId);
        }
        return;
      }
      case "file_modified": {
        const payload = filePayloadSchema.parse(event.payload);
        const task = this.tasks.get(stateKey(event.projectId, payload.taskId));
        if (this.ownsTask(task, event) && !task.modifiedFiles.includes(payload.path)) {
          task.modifiedFiles.push(payload.path);
          task.updatedAt = event.occurredAt;
          this.refreshOverlaps(event.projectId);
        }
        return;
      }
      default:
        return;
    }
  }

  private refreshOverlaps(projectId: string): void {
    for (const [id, warning] of this.warnings) {
      if (warning.projectId === projectId) this.warnings.delete(id);
    }

    const activeTasks = [...this.tasks.values()].filter(
      (task) => task.projectId === projectId && task.status === "active",
    );
    for (let index = 0; index < activeTasks.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < activeTasks.length; otherIndex += 1) {
        const task = activeTasks[index];
        const other = activeTasks[otherIndex];
        const expectedFiles = task.expectedFiles.filter((file) => other.expectedFiles.includes(file));
        const modifiedFiles = task.modifiedFiles.filter((file) => other.modifiedFiles.includes(file));
        if (expectedFiles.length > 0) this.addWarning("expected_overlap", projectId, [task.id, other.id], expectedFiles);
        if (modifiedFiles.length > 0) this.addWarning("confirmed_overlap", projectId, [task.id, other.id], modifiedFiles);
      }
    }
  }

  private ownsTask(task: Task | undefined, event: ContextMeshEvent): task is Task {
    return task?.projectId === event.projectId && task.sessionId === event.sessionId;
  }

  private addWarning(kind: Warning["kind"], projectId: string, taskIds: string[], files: string[]): void {
    const id = JSON.stringify([projectId, kind, [...taskIds].sort()]);
    this.warnings.set(id, {
      id,
      kind,
      projectId,
      taskIds,
      files,
      message: kind === "expected_overlap"
        ? "Active tasks expect to modify the same files."
        : "Active tasks have modified the same files.",
      createdAt: new Date().toISOString(),
    });
  }

  private restore(snapshot: ProcessorSnapshot): void {
    this.sessions.clear();
    this.tasks.clear();
    this.warnings.clear();
    for (const session of snapshot.sessions) this.sessions.set(stateKey(session.projectId, session.id), session);
    for (const task of snapshot.tasks) this.tasks.set(stateKey(task.projectId, task.id), task);
    for (const warning of snapshot.warnings) this.warnings.set(warning.id, warning);
  }
}

function eventIdentity(event: ContextMeshEvent): string {
  return JSON.stringify([event.source, event.projectId, event.sessionId, event.sourceEventId ?? event.eventId]);
}

export function eventScope(event: ContextMeshEvent): string {
  const taskId = typeof event.payload.taskId === "string" ? event.payload.taskId : undefined;
  return JSON.stringify([event.projectId, taskId ? "task" : "session", taskId ?? event.sessionId]);
}

function stateKey(projectId: string, id: string): string {
  return JSON.stringify([projectId, id]);
}

function zTaskId(payload: Record<string, unknown>): string {
  const taskId = payload.taskId;
  if (typeof taskId !== "string" || taskId.length === 0) {
    throw new Error("taskId is required");
  }
  return taskId;
}

export function createEventId(): string {
  return randomUUID();
}
