import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { MeshGateway } from "../transport/http/client.js";
import type { ProjectContext } from "../application/context.js";
import { contextMeshEventSchema } from "../domain/events.js";

export interface DemoReceipt {
  at: string; bridgeSessionId: string; operation: string;
  requestId?: string; items?: { kind: string; id: string; sessionId?: string; taskId?: string }[];
  warningIds?: string[];
}
// Retain only structured operation/provenance metadata, never tool payloads,
// prompts, complete context, model output, credentials or conversations.
export function receiptGateway(gateway: MeshGateway, path: string, projectId: string, sessionId: string): MeshGateway {
  const record = (receipt: Omit<DemoReceipt, "at" | "bridgeSessionId">) => appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), bridgeSessionId: sessionId, ...receipt }) + "\n");
  const scope = (query: Record<string, unknown> = {}) => {
    if (query.projectId !== projectId || (query.sessionId !== undefined && query.sessionId !== sessionId)) throw new Error("Demo bridge identity does not match this session");
  };
  return {
    async ingest(input) {
      const event = contextMeshEventSchema.parse(input); scope(event);
      if (event.sessionId !== sessionId) throw new Error("Demo bridge session identity is required");
      const result = await gateway.ingest(event);
      record({ operation: event.type, requestId: event.sourceEventId ?? event.eventId, warningIds: result.snapshot.warnings.map(w => w.id) });
      return result;
    },
    async read(resource, query) {
      scope(query);
      const value = await gateway.read(resource, query);
      record({ operation: resource, ...(resource === "context" ? { items: (value as ProjectContext).items.map(({ kind, id, sessionId, taskId }) => ({ kind, id, sessionId, taskId })) } : {}) });
      return value;
    },
    async refresh(query) { scope(query); const value = await gateway.refresh(query); record({ operation: "refresh_repository" }); return value; },
  };
}
export function readReceipts(path: string): DemoReceipt[] {
  if (!existsSync(path)) return [];
  // A writer may be appending its final line while the harness polls.
  return readFileSync(path, "utf8").split("\n").filter(Boolean).flatMap(line => { try { return [JSON.parse(line) as DemoReceipt]; } catch { return []; } });
}
