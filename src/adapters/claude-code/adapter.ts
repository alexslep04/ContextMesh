import { createHookAdapter } from "../common/hooks.js";
export type { HostHookPayload as ClaudeHookPayload } from "../common/hooks.js";
// Implemented capabilities; activation remains opt-in and live validation pending.
export const claudeCodeAdapter = createHookAdapter("claude_code");
