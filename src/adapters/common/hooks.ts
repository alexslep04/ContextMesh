import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import type { AgentAdapter } from "./adapter.js";
import type { ContextMeshEvent } from "../../domain/events.js";
import { filePathSchema, idSchema, sessionPayloadSchema } from "../../domain/schemas.js";

export const hostHookSchema = z.object({ hook_event_name: z.string().min(1), session_id: idSchema, cwd: z.string().min(1), tool_name: z.string().optional(), tool_use_id: z.string().optional(), tool_input: z.record(z.string(), z.unknown()).optional(), reason: z.string().optional(), agent_id: z.string().optional() });
export type HostHookPayload = z.infer<typeof hostHookSchema>;
export interface HookEnvelope { projectId: string; sessionId: string; repositoryPath: string; integrationId: string; taskId?: string; occurredAt: string; hook: HostHookPayload }
export const hookIdentity = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function createHookAdapter(agent: "codex" | "claude_code"): AgentAdapter<HookEnvelope> {
  return {
    agent, capabilities: { sessionLifecycle: true, toolEvents: true, explicitReporting: true, contextDelivery: true },
    normalize(input) {
      const hook = hostHookSchema.parse(input.hook);
      if (hook.agent_id) return []; // Subagent lifecycle is not a main session.
      const base = { projectId: idSchema.parse(input.projectId), sessionId: idSchema.parse(input.sessionId), source: agent, occurredAt: input.occurredAt };
      const make = (type: ContextMeshEvent["type"], key: unknown, payload: Record<string, unknown>): ContextMeshEvent => {
        const eventId = hookIdentity([input.integrationId, input.sessionId, key]);
        return { ...base, type, eventId, sourceEventId: eventId, payload };
      };
      if (hook.hook_event_name === "SessionStart") return [make("session_started", "start", sessionPayloadSchema.parse({ agentType: agent, repositoryPath: input.repositoryPath, hostSessionId: hook.session_id, integrationId: input.integrationId }))];
      if (hook.hook_event_name === "SessionEnd") return [make("session_ended", "end", { reason: "Host session ended" })];
      if (hook.hook_event_name !== "PostToolUse" || !input.taskId || !hook.tool_use_id || !["Edit", "Write", "MultiEdit"].includes(hook.tool_name ?? "")) return [];
      const file = hook.tool_input?.file_path;
      if (typeof file !== "string") return [];
      const root = resolve(input.repositoryPath), path = relative(root, isAbsolute(file) ? resolve(file) : resolve(hook.cwd, file)).replaceAll("\\", "/");
      const parsed = filePathSchema.safeParse(path);
      return parsed.success ? [make("file_modified", [hook.tool_use_id, parsed.data], { taskId: input.taskId, path: parsed.data })] : [];
    },
  };
}
