import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LocalApiClient, type MeshGateway } from "../http/client.js";
import { ApplicationError } from "../../domain/errors.js";
import { blockerPayloadSchema, checkpointPayloadSchema, completionPayloadSchema, contextQuerySchema, decisionPayloadSchema, filePayloadSchema, idSchema, projectQuerySchema, resolutionPayloadSchema, sessionPayloadSchema, sessionEndPayloadSchema, taskPayloadSchema, taskUpdatePayloadSchema, memoryDeletionPayloadSchema, memoryRevisionPayloadSchema, memorySearchQuerySchema } from "../../domain/schemas.js";
import type { ContextMeshEvent } from "../../domain/events.js";
async function result(action: () => Promise<unknown>) {
  try { return { content: [{ type: "text" as const, text: JSON.stringify(await action()) }] }; }
  catch (error) { return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: error instanceof ApplicationError ? error.code : "tool_failed", message: error instanceof Error ? error.message : "ContextMesh operation failed" }) }] }; }
}
export function createMcpServer(gateway: MeshGateway = new LocalApiClient(), now = () => new Date().toISOString()) {
  const server = new McpServer({ name: "contextmesh", version: "0.2.0" });
  function mutation(name: string, type: ContextMeshEvent["type"], description: string, payload: z.ZodObject) {
    server.registerTool(name, { description, annotations: { readOnlyHint: false, destructiveHint: type === "memory_deleted", idempotentHint: true, openWorldHint: false }, inputSchema: { projectId: idSchema, sessionId: idSchema, requestId: idSchema, ...payload.shape } }, async input => result(async () => {
      const { projectId, sessionId, requestId, ...data } = input;
      const response = await gateway.ingest({ eventId: requestId, sourceEventId: requestId, source: "mcp", type, projectId, sessionId, occurredAt: now(), payload: data });
      return { accepted: response.accepted, reason: response.reason, requestId, warnings: response.snapshot.warnings };
    }));
  }
  mutation("register_session", "session_started", "Register an independent coding session. Use the same project ID for peers, a unique session ID, the actual agent type, and an absolute repository/worktree path. Reuse requestId only when retrying the same report.", sessionPayloadSchema.extend({ agentType: z.enum(["codex", "claude_code", "mock"]), repositoryPath: z.string().min(1) }));
  mutation("end_session", "session_ended", "End a session without completing its unfinished task.", sessionEndPayloadSchema);
  mutation("revise_memory", "memory_revised", "Append a memory revision with expectedVersionId and reason. History is preserved; concurrent edits are rejected.", memoryRevisionPayloadSchema);
  mutation("delete_memory", "memory_deleted", "Append a deletion tombstone with expectedVersionId and reason; exclude from context/search while preserving history.", memoryDeletionPayloadSchema);
  mutation("report_task", "task_started", "Report understood work and expected files. Returns immediate overlap warnings. Register the session first.", taskPayloadSchema);
  mutation("update_task", "task_updated", "Update the current task's scope. Use a new requestId for a genuine update.", taskUpdatePayloadSchema);
  mutation("complete_task", "task_completed", "Complete work and save a durable handoff with summary, important files, decisions, remaining issues and next steps.", completionPayloadSchema);
  mutation("record_decision", "decision_recorded", "Save a decision and rationale. Reuse memoryId with a NEW requestId to append a superseding version; history is preserved.", decisionPayloadSchema);
  mutation("record_blocker", "blocker_recorded", "Record a blocker and mark its associated task blocked.", blockerPayloadSchema);
  mutation("resolve_blocker", "blocker_resolved", "Resolve a blocker, save resolution memory, and unblock its task when no open blockers remain.", resolutionPayloadSchema);
  mutation("save_progress_checkpoint", "progress_checkpoint", "Save a durable progress checkpoint for a future session.", checkpointPayloadSchema);
  mutation("report_file_activity", "file_modified", "Report activity on a task file. This is a claim; refresh_repository supplies separate Git evidence.", filePayloadSchema);
  server.registerTool("get_project_context", { description: "Get relevant project context with a serialized character budget, current decisions, handoffs, warnings and Git evidence.", annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }, inputSchema: contextQuerySchema.shape }, input => result(() => gateway.read("context", input)));
  server.registerTool("search_project_memory", { description: "Search current project memories. Deleted and superseded versions are excluded. Query words must all match.", annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }, inputSchema: memorySearchQuerySchema.shape }, input => result(() => gateway.read("memories", input)));
  server.registerTool("get_active_sessions", { description: "Inspect active sessions in one project.", annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }, inputSchema: projectQuerySchema.shape }, input => result(() => gateway.read("sessions", { ...input, status: "active" })));
  server.registerTool("get_conflicts", { description: "Get explained overlap warnings for a project.", annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }, inputSchema: projectQuerySchema.shape }, input => result(() => gateway.read("warnings", input)));
  server.registerTool("refresh_repository", { description: "Inspect the registered Git worktree and persist verified repository evidence. Does not infer which session edited a shared-worktree file.", inputSchema: { ...projectQuerySchema.shape, sessionId: idSchema.optional() } }, input => result(() => gateway.refresh(input)));
  return server;
}
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
  let closing = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { if (!closing) { closing = true; void server.close(); } });
}
