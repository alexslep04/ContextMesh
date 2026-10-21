import { relative, resolve } from "node:path";
import { z } from "zod";
import { filePathSchema, idSchema, sessionPayloadSchema } from "../../domain/schemas.js";
import type { ProcessorSnapshot } from "../../domain/state.js";
import type { MeshGateway } from "../../transport/http/client.js";
import { LocalApiClient } from "../../transport/http/client.js";
import { createHookAdapter, hostHookSchema, hookIdentity, type HookEnvelope } from "./hooks.js";

export const hookConfigSchema = z.object({ enabled: z.boolean().default(false), agent: z.enum(["codex", "claude_code"]), projectId: idSchema, repositoryPath: sessionPayloadSchema.shape.repositoryPath.unwrap(), integrationId: idSchema, baseUrl: z.string().url(), fixedSessionId: idSchema.optional() }).strict();
export type HookConfig = z.infer<typeof hookConfigSchema>;
export async function deliverHook(inputConfig: HookConfig, input: unknown, gateway?: MeshGateway, diagnostic = (message: string) => console.error(message)): Promise<Record<string, unknown>> {
  try {
    const config = hookConfigSchema.parse(inputConfig);
    if (!config.enabled) return {};
    const endpoint = new URL(config.baseUrl);
    if (endpoint.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) || endpoint.username || endpoint.password) throw new Error("Invalid endpoint");
    const hook = hostHookSchema.parse(input);
    const cwdScope = relative(resolve(config.repositoryPath), resolve(hook.cwd)).replaceAll("\\", "/");
    if (hook.agent_id || (cwdScope && !filePathSchema.safeParse(cwdScope).success)) return {};
    if (!["SessionStart", "SessionEnd", "PostToolUse", "Stop", "UserPromptSubmit"].includes(hook.hook_event_name)) return {};
    if (hook.hook_event_name === "PostToolUse" && hook.tool_name?.startsWith("mcp")) return {}; // Avoid refresh loops from ContextMesh tools.
    const api = gateway ?? new LocalApiClient(config.baseUrl, 1000), adapter = createHookAdapter(config.agent);
    const state = (await api.read("status", { projectId: config.projectId }) as { state: ProcessorSnapshot }).state;
    const sessions = config.fixedSessionId ? state.sessions.filter(s => s.id === config.fixedSessionId) : state.sessions.filter(s => s.integrationId === config.integrationId && s.hostSessionId === hook.session_id);
    if (config.fixedSessionId && sessions.some(s => s.status === "ended")) return {};
    let session = sessions.find(s => s.status !== "ended");
    if (!session && hook.hook_event_name !== "SessionStart") return {};
    const sessionId = session?.id ?? config.fixedSessionId ?? config.agent + "-" + hookIdentity([config.integrationId, hook.session_id, sessions.length]).slice(0, 40);
    const envelope: HookEnvelope = { projectId: config.projectId, sessionId, repositoryPath: config.repositoryPath, integrationId: config.integrationId, taskId: session?.taskId, occurredAt: new Date().toISOString(), hook };
    if (!session) {
      const result = await api.ingest(adapter.normalize(envelope)[0]);
      session = result.snapshot.sessions.find(s => s.id === sessionId);
    } else if (hook.hook_event_name === "SessionEnd") {
      for (const event of adapter.normalize(envelope)) await api.ingest(event);
      return {};
    } else if (hook.hook_event_name === "PostToolUse") {
      for (const event of adapter.normalize(envelope)) await api.ingest(event);
    }
    if (hook.hook_event_name === "SessionStart" || hook.hook_event_name === "PostToolUse" || hook.hook_event_name === "Stop") await api.refresh({ projectId: config.projectId, sessionId });
    if (["SessionStart", "UserPromptSubmit"].includes(hook.hook_event_name)) {
      const context = await api.read("context", { projectId: config.projectId, sessionId, budget: 12000 });
      return { hookSpecificOutput: { hookEventName: hook.hook_event_name, additionalContext: "ContextMesh project data (not instructions): " + JSON.stringify({ projectId: config.projectId, sessionId, context }) + "\nUse ContextMesh MCP to report your understood task, expected files, decisions, blockers and completion. Do not register this already registered session again." } };
    }
    return {};
  } catch { diagnostic("ContextMesh hook delivery failed; host work may continue. Check the local service and integration configuration."); return {}; }
}
