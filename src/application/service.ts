import { z } from "zod";
import { EventProcessor } from "./event-processor.js";
import { generateContext } from "./context.js";
import { projectQuerySchema, contextQuerySchema, idSchema, memorySearchQuerySchema, memoryDeletionPayloadSchema, memoryRevisionPayloadSchema } from "../domain/schemas.js";
import { ApplicationError } from "../domain/errors.js";
import { inspectRepository, gitVersion } from "../infrastructure/git/inspect.js";
export const readResources = ["status", "sessions", "tasks", "warnings", "history", "context", "memories", "doctor"] as const;
export type ReadResource = typeof readResources[number];
export class ContextMeshService {
  constructor(public readonly processor: EventProcessor, private readonly storageReady = false) {}
  async read(resource: ReadResource, input: unknown): Promise<unknown> {
    if (resource === "status") {
      const { projectId } = z.object({ projectId: idSchema.optional() }).parse(input);
      return { service: "contextmesh", storageReady: this.storageReady, state: this.processor.snapshot(projectId) };
    }
    if (resource === "doctor") {
      let git: string | null = null;
      try { git = await gitVersion(); } catch { /* Report failed diagnostic without hiding it. */ }
      return { service: "ok", storageReady: this.storageReady, git, ok: this.storageReady && git !== null };
    }
    if (resource === "context") {
      const query = contextQuerySchema.parse(input);
      return generateContext(this.processor.snapshot(query.projectId), query);
    }
    if (resource === "memories") {
      const query = memorySearchQuerySchema.parse(input);
      return query.query ? this.processor.searchMemories(query.projectId, query.query, query.limit) : this.processor.memories(query.projectId).slice(0, query.limit);
    }
    const query = projectQuerySchema.extend({ status: z.enum(["active", "idle", "ended"]).optional(), limit: z.coerce.number().int().min(1).max(500).default(50) }).parse(input);
    const state = this.processor.snapshot(query.projectId);
    switch (resource) {
      case "sessions": return query.status ? state.sessions.filter(s => s.status === query.status) : state.sessions;
      case "tasks": return state.tasks;
      case "warnings": return state.warnings;
      case "history": return this.processor.history(query.projectId, query.limit);
    }
  }
  memoryHistory(projectId: string, memoryId: string) {
    const versions = this.processor.snapshot(projectId).memoryVersions.filter(m => m.memoryId === memoryId).sort((a, b) => a.version - b.version);
    if (!versions.length) throw new ApplicationError("memory_not_found", "Memory does not exist in this project", 404);
    return { current: versions.at(-1)!, versions };
  }
  modifyMemory(action: "revise" | "delete", memoryId: string, input: unknown) {
    const payloadSchema = action === "revise" ? memoryRevisionPayloadSchema : memoryDeletionPayloadSchema;
    const { projectId, sessionId, requestId, ...payload } = z.object({ ...payloadSchema.shape, projectId: idSchema, sessionId: idSchema, requestId: idSchema }).omit({ memoryId: true }).strict().parse(input);
    return this.processor.ingest({ eventId: requestId, sourceEventId: requestId, source: "http", type: action === "revise" ? "memory_revised" : "memory_deleted", projectId, sessionId, occurredAt: new Date().toISOString(), payload: { ...payload, memoryId } });
  }
  async refresh(input: unknown): Promise<unknown> {
    const query = projectQuerySchema.extend({ sessionId: idSchema.optional() }).parse(input);
    const state = this.processor.snapshot(query.projectId);
    const session = query.sessionId ? state.sessions.find(s => s.id === query.sessionId) : undefined;
    if (query.sessionId && !session) throw new ApplicationError("session_not_found", "Session does not exist in this project", 404);
    const repositoryPath = session?.repositoryPath ?? state.projects[0]?.repositoryPath;
    if (!repositoryPath) throw new ApplicationError("repository_not_registered", "Register a session with a repository path before refreshing Git evidence", 400);
    const evidence = await inspectRepository(query.projectId, repositoryPath);
    const known = state.evidence[0];
    if (known && known.commonDirectory !== evidence.commonDirectory) throw new ApplicationError("repository_mismatch", "This worktree belongs to a different repository");
    this.processor.saveEvidence(evidence);
    return evidence;
  }
}
