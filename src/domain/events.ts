import { z } from "zod";

export const eventTypeSchema = z.enum([
  "session_started",
  "session_ended",
  "task_started",
  "task_updated",
  "task_completed",
  "file_intent_declared",
  "file_modified",
  "decision_recorded",
  "blocker_recorded",
  "blocker_resolved",
  "commit_created",
  "warning_created",
  "progress_checkpoint",
  "memory_revised",
  "memory_deleted",
]);

export const contextMeshEventSchema = z.object({
  eventId: z.string().min(1),
  sourceEventId: z.string().min(1).optional(),
  source: z.enum(["mock", "claude_code", "codex", "mcp", "cli", "http"]),
  type: eventTypeSchema,
  projectId: z.string().min(1),
  sessionId: z.string().min(1),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export type ContextMeshEvent = z.infer<typeof contextMeshEventSchema>;
