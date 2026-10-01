import type { AgentAdapter } from "../common/adapter.js";
import type { ContextMeshEvent } from "../../domain/events.js";

export const codexAdapter: AgentAdapter<unknown> = {
  agent: "codex",
  capabilities: {
    sessionLifecycle: false,
    toolEvents: false,
    explicitReporting: false,
    contextDelivery: false,
  },
  normalize: (_payload: unknown): ContextMeshEvent[] => [],
};
