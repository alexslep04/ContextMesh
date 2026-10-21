import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { contextMeshEventSchema, type ContextMeshEvent } from "../domain/events.js";
import type { GitEvidence, Task } from "../domain/entities.js";
import type { MemoryKind, MemoryVersion } from "../domain/memories.js";
import { currentMemories } from "../domain/memories.js";
import { emptySnapshot, type ProcessorSnapshot } from "../domain/state.js";
import { ApplicationError } from "../domain/errors.js";
import { blockerPayloadSchema, checkpointPayloadSchema, completionPayloadSchema, decisionPayloadSchema, filePayloadSchema, resolutionPayloadSchema, sessionPayloadSchema, sessionEndPayloadSchema, taskPayloadSchema, taskUpdatePayloadSchema, memoryDeletionPayloadSchema, memoryRevisionPayloadSchema } from "../domain/schemas.js";
import type { EventPersistence } from "./event-persistence.js";
import { deriveWarnings } from "./conflicts.js";
export type { ProcessorSnapshot } from "../domain/state.js";
export interface IngestResult { accepted: boolean; reason?: "duplicate" | "stale"; snapshot: ProcessorSnapshot }
const payloadSchemas: Partial<Record<ContextMeshEvent["type"], z.ZodType>> = {
  session_started: sessionPayloadSchema, session_ended: sessionEndPayloadSchema, task_started: taskPayloadSchema,
  task_updated: taskUpdatePayloadSchema, task_completed: completionPayloadSchema, file_intent_declared: filePayloadSchema,
  file_modified: filePayloadSchema, decision_recorded: decisionPayloadSchema, blocker_recorded: blockerPayloadSchema,
  blocker_resolved: resolutionPayloadSchema, progress_checkpoint: checkpointPayloadSchema,
  memory_revised: memoryRevisionPayloadSchema, memory_deleted: memoryDeletionPayloadSchema,
};
export class EventProcessor {
  private state: ProcessorSnapshot = emptySnapshot();
  private readonly identities = new Set<string>();
  private events: ContextMeshEvent[] = [];
  private latest: Record<string, string> = {};
  constructor(private readonly persistence?: EventPersistence) {
    if (persistence) {
      const loaded = persistence.load();
      this.state = { ...emptySnapshot(), ...loaded.snapshot };
      loaded.eventIdentities.forEach(id => this.identities.add(id));
      this.events = loaded.events;
      this.latest = loaded.latestEventAt;
    }
  }
  ingest(input: unknown): IngestResult { return this.ingestValidated(contextMeshEventSchema.parse(input)); }
  ingestValidated(input: ContextMeshEvent): IngestResult {
    const envelope = contextMeshEventSchema.parse(input);
    const schema = payloadSchemas[envelope.type];
    const identity = eventIdentity(envelope);
    if (this.identities.has(identity)) {
      const prior = this.events.find(e => eventIdentity(e) === identity);
      const oldPayload = prior && schema?.safeParse(prior.payload);
      const newPayload = schema?.safeParse(envelope.payload);
      const matches = oldPayload?.success && newPayload?.success
        ? isDeepStrictEqual(oldPayload.data, newPayload.data)
        : isDeepStrictEqual(prior?.payload, envelope.payload);
      if (prior && (prior.type !== envelope.type || !matches)) throw new ApplicationError("identity_conflict", "A request identity was reused with different content");
      return { accepted: false, reason: "duplicate", snapshot: this.snapshot(envelope.projectId) };
    }
    if (!schema) throw new ApplicationError("unsupported_event", "This event is not a supported external operation", 400);
    const event = { ...envelope, occurredAt: new Date(envelope.occurredAt).toISOString(), payload: schema.parse(envelope.payload) as Record<string, unknown> };
    const scope = eventScope(event);
    if (this.latest[scope] && event.occurredAt < this.latest[scope]) return { accepted: false, reason: "stale", snapshot: this.snapshot(event.projectId) };
    const taskOperation = ["task_started", "task_updated", "task_completed", "file_modified", "file_intent_declared"].includes(event.type);
    const referencedTask = taskOperation ? this.state.tasks.find(t => t.projectId === event.projectId && t.id === event.payload.taskId) : undefined;
    const endingSession = event.type === "session_ended" ? this.state.sessions.find(s => s.projectId === event.projectId && s.id === event.sessionId) : undefined;
    if ((referencedTask && event.occurredAt < referencedTask.updatedAt) || (endingSession && event.occurredAt < endingSession.lastActivityAt)) return { accepted: false, reason: "stale", snapshot: this.snapshot(event.projectId) };
    const previous = this.state;
    this.state = structuredClone(previous);
    try {
      this.apply(event);
      this.state.warnings = this.state.warnings.filter(w => w.projectId !== event.projectId).concat(deriveWarnings(this.state, event.projectId, event.occurredAt));
      this.state.acceptedEventCount = this.identities.size + 1;
      if (this.persistence && !this.persistence.persist(event, identity, this.state)) {
        this.state = previous;
        return { accepted: false, reason: "duplicate", snapshot: this.snapshot(event.projectId) };
      }
      this.identities.add(identity); this.events.push(event); this.latest[scope] = event.occurredAt;
      return { accepted: true, snapshot: this.snapshot(event.projectId) };
    } catch (error) { this.state = previous; throw error; }
  }
  snapshot(projectId?: string): ProcessorSnapshot {
    const state = structuredClone(this.state);
    if (projectId) {
      state.projects = state.projects.filter(p => p.id === projectId);
      state.sessions = state.sessions.filter(p => p.projectId === projectId);
      state.tasks = state.tasks.filter(p => p.projectId === projectId);
      state.warnings = state.warnings.filter(p => p.projectId === projectId);
      state.memoryVersions = state.memoryVersions.filter(p => p.projectId === projectId);
      state.blockers = state.blockers.filter(p => p.projectId === projectId);
      state.evidence = state.evidence.filter(p => p.projectId === projectId);
      state.acceptedEventCount = this.events.filter(e => e.projectId === projectId).length;
    } else state.acceptedEventCount = this.identities.size;
    return state;
  }
  history(projectId: string, limit = 50): ContextMeshEvent[] { return structuredClone(this.events.filter(e => e.projectId === projectId).slice(-limit).reverse()); }
  memories(projectId: string): MemoryVersion[] { return currentMemories(this.snapshot(projectId).memoryVersions); }
  searchMemories(projectId: string, query: string, limit: number): MemoryVersion[] {
    const terms = query.match(/[\p{L}\p{N}_]+/gu) ?? [];
    if (!terms.length) return [];
    const ids = this.persistence?.searchMemories?.(projectId, terms, limit);
    const memories = this.memories(projectId);
    if (ids) return ids.flatMap(id => memories.filter(m => m.id === id));
    return memories.filter(m => terms.every(term => (m.content + " " + (m.rationale ?? "")).toLocaleLowerCase().includes(term.toLocaleLowerCase()))).slice(0, limit);
  }
  saveEvidence(evidence: GitEvidence): void {
    this.persistence?.saveEvidence(evidence);
    this.state.evidence = this.state.evidence.filter(e => e.projectId !== evidence.projectId || e.worktreePath !== evidence.worktreePath).concat(structuredClone(evidence));
  }
  private task(event: ContextMeshEvent, id: string, active = true): Task {
    const task = this.state.tasks.find(t => t.projectId === event.projectId && t.id === id);
    if (!task) throw new ApplicationError("task_not_found", "Task does not exist in this project", 404);
    if (task.sessionId !== event.sessionId) throw new ApplicationError("wrong_owner", "This task belongs to another session", 403);
    if (active && task.status !== "active" && task.status !== "blocked") throw new ApplicationError("task_finished", "Task is already finished");
    return task;
  }
  private memory(event: ContextMeshEvent, memoryId: string, kind: MemoryKind, content: string, extra: Partial<MemoryVersion> = {}): void {
    const previous = currentMemories(this.state.memoryVersions, true).find(m => m.projectId === event.projectId && m.memoryId === memoryId);
    if (previous?.deleted) throw new ApplicationError("memory_deleted", "This memory was deleted; use a new memory ID", 410);
    if (previous && previous.kind !== kind) throw new ApplicationError("memory_kind_conflict", "Memory kind cannot change");
    this.state.memoryVersions.push({ ...extra, id: randomUUID(), memoryId, projectId: event.projectId, kind, content,
      version: (previous?.version ?? 0) + 1, supersedesVersionId: previous?.id, sourceSessionId: event.sessionId, createdAt: event.occurredAt });
  }
  private apply(event: ContextMeshEvent): void {
    const p = event.payload;
    if (event.type === "session_started") {
      if (this.state.sessions.some(s => s.projectId === event.projectId && s.id === event.sessionId)) throw new ApplicationError("session_exists", "Use a new session ID for a new session");
      const payload = sessionPayloadSchema.parse(p);
      let project = this.state.projects.find(pr => pr.id === event.projectId);
      const repositoryPath = payload.repositoryPath ? resolve(payload.repositoryPath) : project?.repositoryPath;
      if (!project) { project = { id: event.projectId, repositoryPath: repositoryPath ?? "", createdAt: event.occurredAt }; this.state.projects.push(project); }
      else if (!project.repositoryPath && repositoryPath) project.repositoryPath = repositoryPath;
      this.state.sessions.push({ id: event.sessionId, projectId: event.projectId,
        agentType: payload.agentType ?? (event.source === "codex" || event.source === "claude_code" ? event.source : "mock"),
        status: "active", repositoryPath, hostSessionId: payload.hostSessionId, integrationId: payload.integrationId, startedAt: event.occurredAt, lastActivityAt: event.occurredAt });
      return;
    }
    const session = this.state.sessions.find(s => s.projectId === event.projectId && s.id === event.sessionId);
    if (!session) throw new ApplicationError("session_not_found", "Register this session before reporting work", 404);
    if (session.status === "ended" && event.type !== "session_ended") throw new ApplicationError("session_ended", "Register a new session to continue reporting");
    session.lastActivityAt = event.occurredAt > session.lastActivityAt ? event.occurredAt : session.lastActivityAt;
    switch (event.type) {
      case "memory_revised": case "memory_deleted": {
        const payload = event.type === "memory_revised" ? memoryRevisionPayloadSchema.parse(p) : memoryDeletionPayloadSchema.parse(p);
        const previous = currentMemories(this.state.memoryVersions, true).find(m => m.projectId === event.projectId && m.memoryId === payload.memoryId);
        if (!previous) throw new ApplicationError("memory_not_found", "Memory does not exist in this project", 404);
        if (previous.id !== payload.expectedVersionId) throw new ApplicationError("memory_version_conflict", "Memory changed; retrieve its latest version before editing", 409);
        if (previous.deleted) throw new ApplicationError("memory_deleted", "Memory is already deleted", 410);
        const revision = event.type === "memory_revised" ? memoryRevisionPayloadSchema.parse(p) : undefined;
        const content = revision?.content ?? previous.content;
        this.state.memoryVersions.push({ ...previous, id: randomUUID(), version: previous.version + 1, supersedesVersionId: previous.id, sourceSessionId: event.sessionId, createdAt: event.occurredAt, content, rationale: revision?.rationale ?? previous.rationale, relatedFiles: revision?.relatedFiles ?? previous.relatedFiles, deleted: event.type === "memory_deleted", revisionReason: payload.reason,
          data: previous.kind === "handoff" ? { ...previous.data, summary: content } : previous.data });
        return;
      }
      case "session_ended": session.status = "ended"; return;
      case "task_started": {
        const payload = taskPayloadSchema.parse(p);
        if (this.state.tasks.some(t => t.projectId === event.projectId && t.id === payload.taskId)) throw new ApplicationError("task_exists", "Update an existing task instead of starting it again");
        if (this.state.tasks.some(t => t.projectId === event.projectId && t.sessionId === event.sessionId && ["active", "blocked"].includes(t.status))) throw new ApplicationError("active_task_exists", "Complete the current task before starting another");
        this.validateDependencies(event.projectId, payload.taskId, payload.dependencies);
        this.state.tasks.push({ ...payload, id: payload.taskId, projectId: event.projectId, sessionId: event.sessionId, status: "active", modifiedFiles: [], reportedFiles: [], startedAt: event.occurredAt, updatedAt: event.occurredAt });
        session.taskId = payload.taskId; return;
      }
      case "task_updated": {
        const payload = taskUpdatePayloadSchema.parse(p); const task = this.task(event, payload.taskId);
        if (payload.dependencies) this.validateDependencies(event.projectId, task.id, payload.dependencies);
        if (payload.title !== undefined) task.title = payload.title;
        if (payload.expectedFiles !== undefined) task.expectedFiles = payload.expectedFiles;
        if (payload.dependencies !== undefined) task.dependencies = payload.dependencies;
        task.updatedAt = event.occurredAt; return;
      }
      case "task_completed": {
        const payload = completionPayloadSchema.parse(p); const task = this.task(event, payload.taskId);
        if (this.state.blockers.some(b => b.projectId === event.projectId && b.taskId === task.id && b.status === "open")) throw new ApplicationError("unresolved_blocker", "Resolve task blockers before completing this task");
        Object.assign(task, payload, { status: "completed", updatedAt: event.occurredAt, completedAt: event.occurredAt });
        this.memory(event, "handoff:" + task.id, "handoff", payload.summary, { taskId: task.id, relatedFiles: payload.importantFiles, data: payload });
        delete session.taskId; return;
      }
      case "file_intent_declared": case "file_modified": {
        const payload = filePayloadSchema.parse(p); const task = this.task(event, payload.taskId);
        const files = event.type === "file_modified" ? (task.reportedFiles ??= []) : task.expectedFiles;
        if (!files.includes(payload.path)) files.push(payload.path);
        files.sort(); task.updatedAt = event.occurredAt; return;
      }
      case "decision_recorded": {
        const payload = decisionPayloadSchema.parse(p); if (payload.taskId) this.task(event, payload.taskId, false);
        this.memory(event, payload.memoryId, "decision", payload.decision, { rationale: payload.rationale, taskId: payload.taskId, relatedFiles: payload.relatedFiles }); return;
      }
      case "progress_checkpoint": {
        const payload = checkpointPayloadSchema.parse(p); if (payload.taskId) this.task(event, payload.taskId);
        this.memory(event, payload.memoryId, "progress", payload.content, { taskId: payload.taskId, relatedFiles: payload.relatedFiles }); return;
      }
      case "blocker_recorded": {
        const payload = blockerPayloadSchema.parse(p);
        if (this.state.blockers.some(b => b.projectId === event.projectId && b.id === payload.blockerId)) throw new ApplicationError("blocker_exists", "Blocker ID already exists");
        if (payload.taskId) { const task = this.task(event, payload.taskId); task.status = "blocked"; task.updatedAt = event.occurredAt; }
        this.state.blockers.push({ id: payload.blockerId, projectId: event.projectId, sessionId: event.sessionId, taskId: payload.taskId, description: payload.description, status: "open", createdAt: event.occurredAt }); return;
      }
      case "blocker_resolved": {
        const payload = resolutionPayloadSchema.parse(p);
        const blocker = this.state.blockers.find(b => b.projectId === event.projectId && b.id === payload.blockerId);
        if (!blocker) throw new ApplicationError("blocker_not_found", "Blocker does not exist", 404);
        if (blocker.status === "resolved") throw new ApplicationError("blocker_resolved", "Blocker is already resolved");
        Object.assign(blocker, { status: "resolved", resolvedAt: event.occurredAt, resolution: payload.resolution });
        const task = this.state.tasks.find(t => t.projectId === event.projectId && t.id === blocker.taskId);
        if (task && task.status === "blocked" && !this.state.blockers.some(b => b.projectId === event.projectId && b.taskId === task.id && b.status === "open")) { task.status = "active"; task.updatedAt = event.occurredAt; }
        this.memory(event, "resolution:" + blocker.id, "blocker_resolution", payload.resolution, { taskId: blocker.taskId }); return;
      }
    }
  }
  private validateDependencies(projectId: string, taskId: string, dependencies: string[]): void {
    for (const dependency of dependencies) if (dependency === taskId || !this.state.tasks.some(t => t.projectId === projectId && t.id === dependency)) throw new ApplicationError("invalid_dependency", "Dependencies must reference other tasks in this project", 400);
  }
}
export function eventIdentity(event: ContextMeshEvent): string { return JSON.stringify([event.source, event.projectId, event.sessionId, event.sourceEventId ?? event.eventId]); }
export function eventScope(event: ContextMeshEvent): string {
  const payload = event.payload;
  const key = typeof payload.memoryId === "string" ? ["memory", payload.memoryId] : typeof payload.blockerId === "string" ? ["blocker", payload.blockerId] : typeof payload.taskId === "string" ? ["task", payload.taskId] : ["session", event.sessionId];
  return JSON.stringify([event.projectId, ...key]);
}
export function createEventId(): string { return randomUUID(); }
