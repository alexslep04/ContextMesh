import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { join } from "node:path";
import { createServer } from "node:http";
import { createRuntime } from "../../src/runtime.js";
import { LocalApiClient } from "../../src/transport/http/client.js";
import { createMcpServer } from "../../src/transport/mcp/server.js";
import { events, temporaryDirectory } from "../helpers.js";
import type { ProcessorSnapshot } from "../../src/domain/state.js";
async function connect(client: LocalApiClient, now: () => string) {
  const server = createMcpServer(client, now), agent = new Client({ name: "test-peer", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await agent.connect(a);
  return { agent, async close() { await agent.close(); await server.close(); } };
}
function body(response: Awaited<ReturnType<Client["callTool"]>>) { return JSON.parse((response.content as { text: string }[])[0].text); }
describe("MCP through the shared HTTP service", () => {
  it("prevents stale HTTP overwrites, shares warnings immediately, and handles replay identity", async () => {
    const temp = temporaryDirectory(), clock = events();
    const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
    const url = await runtime.app.listen({ host: "127.0.0.1", port: 0 });
    const api = new LocalApiClient(url), mcp = await connect(api, clock.now);
    const tool = (name: string, args: Record<string, unknown>) => mcp.agent.callTool({ name, arguments: { projectId: "p", sessionId: "a", ...args } });
    try {
      expect(body(await tool("register_session", { requestId: "register-a", agentType: "codex", repositoryPath: temp.path })).accepted).toBe(true);
      const report = { requestId: "task-a", taskId: "a-task", title: "Original", expectedFiles: ["auth.ts"] };
      await tool("report_task", report);
      await tool("register_session", { sessionId: "b", requestId: "register-b", agentType: "mock", repositoryPath: temp.path });
      await tool("report_task", { sessionId: "b", requestId: "task-b", taskId: "b-task", title: "Peer", expectedFiles: ["auth.ts"] });
      const status = await api.read("status", { projectId: "p" }) as { state: ProcessorSnapshot };
      expect(status.state.tasks).toHaveLength(2); expect(status.state.warnings).toHaveLength(1);
      expect(body(await tool("get_conflicts", {}))).toEqual(status.state.warnings);
      await tool("update_task", { requestId: "update-a", taskId: "a-task", title: "Updated through MCP", expectedFiles: ["revised.ts"] });
      await api.ingest(clock.event("file_modified", { taskId: "a-task", path: "auth.ts" }));
      const next = await api.read("status", { projectId: "p" }) as { state: ProcessorSnapshot };
      expect(next.state.tasks[0]).toMatchObject({ title: "Updated through MCP", expectedFiles: ["revised.ts"], reportedFiles: ["auth.ts"] });
      expect(next.state.warnings).toHaveLength(0);
      expect(body(await tool("report_task", report)).reason).toBe("duplicate");
      const conflict = await tool("report_task", { ...report, title: "Different retry" });
      expect(conflict.isError).toBe(true); expect(body(conflict).error).toBe("identity_conflict");
      const wrongOwner = await tool("update_task", { sessionId: "b", requestId: "wrong-owner", taskId: "a-task", title: "Hijack" });
      expect(body(wrongOwner).error).toBe("wrong_owner");
      const context = body(await tool("get_project_context", { projectId: "unrelated" })); expect(context.items).toEqual([]);
      const invalid = await runtime.app.inject({ method: "GET", url: "/v1/context?projectId=p&budget=0" }); expect(invalid.statusCode).toBe(400);
      await tool("record_decision", { requestId: "choice-v1", memoryId: "choice", decision: "First", rationale: "Initial" });
      await tool("record_decision", { requestId: "choice-v2", memoryId: "choice", decision: "Second", rationale: "Revised" });
      const history = await runtime.app.inject({ method: "GET", url: "/v1/memories/choice?projectId=p" });
      expect(history.json().versions).toHaveLength(2); expect(history.json().current.content).toBe("Second");
      const exported = await runtime.app.inject({ method: "GET", url: "/v1/memories/export?projectId=p" }); expect(exported.json().versions).toHaveLength(2);
      const hidden = await runtime.app.inject({ method: "GET", url: "/v1/memories/choice?projectId=unrelated" }); expect(hidden.statusCode).toBe(404);
      expect(() => createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 })).toThrow("Another ContextMesh");
    } finally { await mcp.close(); await runtime.app.close(); temp.remove(); }
  });
  it("times out a nonresponding endpoint without hanging the caller", async () => {
    const server = createServer(() => {});
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    try { await expect(new LocalApiClient("http://127.0.0.1:" + port, 100).read("status")).rejects.toMatchObject({ code: "service_unavailable" }); }
    finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
  it("returns bounded diagnostic errors when the local service is unavailable", async () => {
    const api = new LocalApiClient("http://127.0.0.1:1", 100), clock = events(), mcp = await connect(api, clock.now);
    try {
      const response = await mcp.agent.callTool({ name: "get_project_context", arguments: { projectId: "p" } });
      expect(response.isError).toBe(true); expect(body(response).error).toBe("service_unavailable");
    } finally { await mcp.close(); }
  });
});
