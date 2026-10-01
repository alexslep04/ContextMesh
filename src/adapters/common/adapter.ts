import type { ContextMeshEvent } from "../../domain/events.js";

export interface AdapterCapabilities {
  sessionLifecycle: boolean;
  toolEvents: boolean;
  explicitReporting: boolean;
  contextDelivery: boolean;
}

export interface AgentAdapter<TPayload = unknown> {
  readonly agent: "claude_code" | "codex";
  readonly capabilities: AdapterCapabilities;
  normalize(payload: TPayload): ContextMeshEvent[];
}
