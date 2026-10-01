import { randomUUID } from "node:crypto";
import type { Session, Task, Warning } from "../domain/entities.js";
import {
  contextMeshEventSchema,
  type ContextMeshEvent,
} from "../domain/events.js";
import {
  filePayloadSchema,
  taskPayloadSchema,
  taskUpdatePayloadSchema,
} from "../domain/schemas.js";

export interface ProcessorSnapshot {
  sessions: Session[];
  tasks: Task[];
  warnings: Warning[];
  acceptedEventCount: number;
}

export class EventProcessor {
  private readonly sessions = new Map<string, Session>();
  private readonly tasks = new Map<string, Task>();
  private readonly warnings = new Map<string, Warning>();
  private readonly acceptedEventIds = new Set<string>();

  ingest(input: unknown): { accepted: boolean; snapshot: ProcessorSnapshot } {
    const event = contextMeshEventSchema.parse(input);
    return this.ingestValidated(event);
  }

  ingestValidated(event: ContextMeshEvent): { accepted: boolean; snapshot: ProcessorSnapshot } {
    const identity = eventIdentity(event);
    if (this.acceptedEventIds.has(identity)) {
      return { accepted: false, snapshot: this.snapshot() };
    }

    this.apply(event);
    this.acceptedEventIds.add(identity);
    return { accepted: true, snapshot: this.snapshot() };
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
        this.sessions.set(event.sessionId, {
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
        const session = this.sessions.get(event.sessionId);
        if (session) {
          session.status = "ended";
          session.lastActivityAt = event.occurredAt;
        }
        return;
      }
      case "task_started": {
        const payload = taskPayloadSchema.parse(event.payload);
        this.tasks.set(payload.taskId, {
          id: payload.taskId,
          projectId: event.projectId,
          sessionId: event.sessionId,
          title: payload.title,
          status: "active",
          expectedFiles: payload.expectedFiles,
          modifiedFiles: [],
          updatedAt: event.occurredAt,
        });
        const session = this.sessions.get(event.sessionId);
        if (session) session.taskId = payload.taskId;
        this.refreshOverlaps(event.projectId);
        return;
      }
      case "task_updated": {
        const payload = taskUpdatePayloadSchema.parse(event.payload);
        const task = this.tasks.get(payload.taskId);
        if (!this.ownsTask(task, event)) return;
        if (payload.title) task.title = payload.title;
        if (payload.expectedFiles) task.expectedFiles = payload.expectedFiles;
        task.updatedAt = event.occurredAt;
        this.refreshOverlaps(event.projectId);
        return;
      }
      case "task_completed": {
        const taskId = zTaskId(event.payload);
        const task = this.tasks.get(taskId);
        if (this.ownsTask(task, event)) {
          task.status = "completed";
          task.updatedAt = event.occurredAt;
          this.refreshOverlaps(event.projectId);
        }
        return;
      }
      case "file_intent_declared": {
        const payload = filePayloadSchema.parse(event.payload);
        const task = this.tasks.get(payload.taskId);
        if (this.ownsTask(task, event) && !task.expectedFiles.includes(payload.path)) {
          task.expectedFiles.push(payload.path);
          task.updatedAt = event.occurredAt;
          this.refreshOverlaps(event.projectId);
        }
        return;
      }
      case "file_modified": {
        const payload = filePayloadSchema.parse(event.payload);
        const task = this.tasks.get(payload.taskId);
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
    const id = `${kind}:${[...taskIds].sort().join(",")}`;
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
}

function eventIdentity(event: ContextMeshEvent): string {
  return [event.source, event.projectId, event.sessionId, event.sourceEventId ?? event.eventId].join(":");
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
