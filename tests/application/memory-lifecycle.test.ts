import { it, expect } from "vitest";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createRuntime } from "../../src/runtime.js";
import { createMcpServer } from "../../src/transport/mcp/server.js";
import { LocalApiClient } from "../../src/transport/http/client.js";
import { events, temporaryDirectory } from "../helpers.js";

it("revises/deletes atomically, preserves history and replay, and keeps current-only search after restart", async () => {
  const temp = temporaryDirectory(), clock = events();
  const config = { host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 };
  let runtime = createRuntime(config);
  try {
    const processor = runtime.service.processor;
    processor.ingest(clock.event("session_started"));
    processor.ingest(clock.event("decision_recorded", { memoryId: "d", decision: "obsoleteword", rationale: "Old rationale" }));
    const original = processor.memories("p")[0];
    const patch = { projectId: "p", sessionId: "a", requestId: "revise", expectedVersionId: original.id, reason: "Correct contract", content: "currentword", rationale: "New rationale" };
    const revised = await runtime.app.inject({ method: "PATCH", url: "/v1/memories/d", payload: patch }); expect(revised.statusCode).toBe(200);
    expect(processor.snapshot().memoryVersions[0]).toEqual(original);
    const current = processor.memories("p")[0]; expect(current).toMatchObject({ version: 2, supersedesVersionId: original.id, content: "currentword" });
    expect((await runtime.app.inject({ method: "PATCH", url: "/v1/memories/d", payload: patch })).json().reason).toBe("duplicate");
    expect((await runtime.app.inject({ method: "PATCH", url: "/v1/memories/d", payload: { ...patch, requestId: "stale-editor" } })).statusCode).toBe(409);
    expect((await runtime.app.inject({ method: "PATCH", url: "/v1/memories/d", payload: { ...patch, requestId: "empty", content: undefined, rationale: undefined } })).statusCode).toBe(400);
    expect(processor.searchMemories("p", "obsoleteword", 50)).toEqual([]);
    expect(processor.searchMemories("p", "currentword", 50)).toHaveLength(1);
    expect(processor.searchMemories("other", "currentword", 50)).toEqual([]);
    expect(processor.searchMemories("p", '" OR *', 50)).toEqual([]);
    const deletion = { projectId: "p", sessionId: "a", requestId: "delete", expectedVersionId: current.id, reason: "No longer applicable" };
    expect((await runtime.app.inject({ method: "DELETE", url: "/v1/memories/d", payload: deletion })).statusCode).toBe(200);
    expect(processor.memories("p")).toEqual([]); expect(processor.searchMemories("p", "currentword", 50)).toEqual([]);
    expect((await runtime.service.read("context", { projectId: "p" }) as { items: unknown[] }).items).toEqual([]);
    expect(runtime.service.memoryHistory("p", "d").versions).toHaveLength(3);
    expect(runtime.service.memoryHistory("p", "d").current.deleted).toBe(true);
    expect(() => processor.ingest({ ...clock.event("decision_recorded", { memoryId: "d", decision: "Resurrect", rationale: "No" }), occurredAt: new Date().toISOString() })).toThrow("deleted");
    await runtime.app.close(); runtime = createRuntime(config);
    expect(runtime.service.processor.memories("p")).toEqual([]);
    expect(runtime.service.processor.searchMemories("p", "currentword", 50)).toEqual([]);
    expect(runtime.service.memoryHistory("p", "d").versions).toHaveLength(3);
    expect((await runtime.app.inject({ method: "DELETE", url: "/v1/memories/d", payload: deletion })).json().reason).toBe("duplicate");
    expect((await runtime.app.inject({ method: "GET", url: "/v1/memories/export?projectId=p" })).json().versions).toHaveLength(3);
  } finally { await runtime.app.close(); temp.remove(); }
});

it("shares memory edits/search through MCP and HTTP, including ownership and invalid input boundaries", async () => {
  const temp = temporaryDirectory(), clock = events();
  const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
  const api = new LocalApiClient(await runtime.app.listen({ host: "127.0.0.1", port: 0 }));
  const server = createMcpServer(api), client = new Client({ name: "memory-editor", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a);
  const call = async (name: string, args: Record<string, unknown>) => {
    const response = await client.callTool({ name, arguments: { projectId: "p", sessionId: "a", ...args } });
    return { error: response.isError, value: JSON.parse((response.content as { text: string }[])[0].text) };
  };
  try {
    runtime.service.processor.ingest(clock.event("session_started"));
    runtime.service.processor.ingest(clock.event("decision_recorded", { memoryId: "d", decision: "First", rationale: "Original" }));
    const current = runtime.service.processor.memories("p")[0];
    expect((await call("revise_memory", { memoryId: "d", expectedVersionId: current.id, requestId: "revise", reason: "Clarify", content: "searchableword" })).error).toBeFalsy();
    expect((await call("search_project_memory", { query: "searchableword" })).value).toHaveLength(1);
    expect((await api.read("memories", { projectId: "p", query: "searchableword" }) as unknown[])).toHaveLength(1);
    const latest = runtime.service.processor.memories("p")[0];
    expect((await call("delete_memory", { memoryId: "d", expectedVersionId: latest.id, requestId: "bad-session", reason: "Remove", sessionId: "missing" })).value.error).toBe("session_not_found");
    expect((await call("delete_memory", { memoryId: "d", expectedVersionId: latest.id, requestId: "delete", reason: "Remove" })).error).toBeFalsy();
    expect((await api.read("memories", { projectId: "p" }) as unknown[])).toEqual([]);
    expect((await api.memoryHistory("p", "d") as { versions: unknown[] }).versions).toHaveLength(3);
  } finally { await client.close(); await server.close(); await runtime.app.close(); temp.remove(); }
});
