import { z } from "zod";
import { loadConfig } from "../../config.js";
import type { IngestResult } from "../../application/event-processor.js";
import type { ReadResource } from "../../application/service.js";
import { ApplicationError } from "../../domain/errors.js";
export interface MeshGateway {
  ingest(event: unknown): Promise<IngestResult>;
  read(resource: ReadResource, query?: Record<string, unknown>): Promise<unknown>;
  refresh(query: Record<string, unknown>): Promise<unknown>;
}
export class LocalApiClient implements MeshGateway {
  constructor(public readonly baseUrl = serviceUrl(), private readonly timeoutMs = loadConfig().timeoutMs) {}
  ingest(event: unknown): Promise<IngestResult> { return this.request("/v1/events", { method: "POST", body: JSON.stringify(event) }) as Promise<IngestResult>; }
  read(resource: ReadResource, query: Record<string, unknown> = {}): Promise<unknown> {
    const parameters = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) parameters.append(key, String(item));
    }
    return this.request("/v1/" + resource + "?" + parameters.toString());
  }
  refresh(query: Record<string, unknown>): Promise<unknown> { return this.request("/v1/repository/refresh", { method: "POST", body: JSON.stringify(query) }); }
  memoryHistory(projectId: string, memoryId: string): Promise<unknown> { return this.request("/v1/memories/" + encodeURIComponent(memoryId) + "?projectId=" + encodeURIComponent(projectId)); }
  modifyMemory(action: "revise" | "delete", memoryId: string, body: Record<string, unknown>): Promise<unknown> { return this.request("/v1/memories/" + encodeURIComponent(memoryId), { method: action === "revise" ? "PATCH" : "DELETE", body: JSON.stringify(body) }); }
  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    let response: Response;
    try { response = await fetch(this.baseUrl + path, { ...init, headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(this.timeoutMs) }); }
    catch { throw new ApplicationError("service_unavailable", "Cannot reach ContextMesh at " + this.baseUrl + ". Start the service or check CONTEXTMESH_HOST/PORT.", 503); }
    let body: unknown;
    try { body = await response.json(); } catch { throw new ApplicationError("invalid_service_response", "ContextMesh returned an invalid response", 502); }
    if (!response.ok) {
      const error = z.object({ error: z.string(), message: z.string() }).safeParse(body);
      throw new ApplicationError(error.success ? error.data.error : "service_error", error.success ? error.data.message : "ContextMesh request failed", response.status);
    }
    return body;
  }
}
export function serviceUrl(): string {
  const config = loadConfig();
  return "http://" + (config.host.includes(":") ? "[" + config.host + "]" : config.host) + ":" + config.port;
}
