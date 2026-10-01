import type { AgentAdapter } from "../common/adapter.js";
import type { ContextMeshEvent } from "../../domain/events.js";

export interface ClaudeHookPayload {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export const claudeCodeAdapter: AgentAdapter<ClaudeHookPayload> = {
  agent: "claude_code",
  capabilities: {
    sessionLifecycle: false,
    toolEvents: false,
    explicitReporting: false,
    contextDelivery: false,
  },
  normalize: (_payload: ClaudeHookPayload): ContextMeshEvent[] => [],
};
