import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { nodeArguments } from "../../src/demo/processes.js";
import { createRuntime } from "../../src/runtime.js";
import { LocalApiClient } from "../../src/transport/http/client.js";
import { codexExecArguments, codexMcpConfiguration, mcpNodeArguments, prepareCodexConnection } from "../../src/adapters/codex/connection.js";
import { events, fixtureRepository, temporaryDirectory } from "../helpers.js";

describe("Codex connections for ordinary projects", () => {
  it("preserves normal sandbox configuration for native work and keeps operator-edit mode read-only", () => {
    const native = codexExecArguments("fixture", "mcp=config", "Prompt");
    expect(native).toContain("workspace-write");
    expect(native).not.toContain("--ignore-user-config");
    expect(native).not.toContain("--ignore-rules");
    expect(native).not.toContain("--dangerously-bypass-approvals-and-sandbox");
    const operator = codexExecArguments("fixture", "mcp=config", "Prompt", true);
    expect(operator).toContain("read-only"); expect(operator).toContain("--ignore-user-config");
  });
  it("prepares distinct sessions without changing the project or storing an event", async () => {
    const temp = temporaryDirectory();
    const repositoryPath = join(temp.path, "repository with spaces"); fixtureRepository(repositoryPath);
    const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
    const client = new LocalApiClient(await runtime.app.listen({ host: "127.0.0.1", port: 0 }));
    const launch = { command: process.execPath, args: [], source: "test" };
    try {
      const options = { projectId: "p", repositoryPath, task: "Add tests", baseDirectory: join(temp.path, "connections"), client, launch };
      const a = await prepareCodexConnection(options), b = await prepareCodexConnection(options);
      expect(a.sessionId).not.toBe(b.sessionId);
      expect(a.directory).not.toBe(b.directory);
      expect(runtime.service.processor.snapshot().acceptedEventCount).toBe(0);
      expect(readFileSync(join(repositoryPath, "src/auth.ts"), "utf8")).toBe("export const authenticate = () => false;\n");
      const managed = readFileSync(join(a.directory, "managed-session.json"), "utf8");
      expect(managed).toContain("--ephemeral"); expect(managed).toContain("workspace-write");
      expect(readFileSync(join(a.directory, "instructions.md"), "utf8")).toContain(a.sessionId);
      expect(readFileSync(join(a.directory, "instructions.md"), "utf8")).toContain("end_session");
      expect(existsSync(join(a.directory, "check-login.ps1"))).toBe(true);
      const endpoint = new URL(client.baseUrl);
      const generated = await promisify(execFile)(process.execPath, [...nodeArguments("cli/index"), "connect", "codex", "--project", "p", "--repo", repositoryPath, "--task", "Inspect API tests", "--json"], {
        cwd: temp.path, env: { ...process.env, CONTEXTMESH_HOST: "127.0.0.1", CONTEXTMESH_PORT: endpoint.port, CONTEXTMESH_CODEX: process.execPath }, windowsHide: true, timeout: 10000,
      });
      const cliConnection = JSON.parse(generated.stdout);
      expect(cliConnection.projectId).toBe("p");
      expect(existsSync(cliConnection.node)).toBe(true);
      const clock = events();
      runtime.service.processor.ingest(clock.event("session_started", { agentType: "codex", repositoryPath }, "already-used"));
      await expect(prepareCodexConnection({ ...options, sessionId: "already-used" })).rejects.toThrow("already exists");
      const other = join(temp.path, "other-repository"); fixtureRepository(other);
      await expect(prepareCodexConnection({ ...options, repositoryPath: other })).rejects.toThrow("different Git repository");
      const nonGit = join(temp.path, "not-git"); mkdirSync(nonGit);
      await expect(prepareCodexConnection({ ...options, projectId: "new-project", repositoryPath: nonGit })).rejects.toThrow();
      await expect(prepareCodexConnection({ ...options, projectId: " " })).rejects.toThrow();
    } finally { await runtime.app.close(); temp.remove(); }
  });
  it("fails before creating artifacts when the service is unavailable", async () => {
    const temp = temporaryDirectory(), baseDirectory = join(temp.path, "connections");
    try {
      await expect(prepareCodexConnection({ projectId: "p", repositoryPath: temp.path, task: "Work", baseDirectory, client: new LocalApiClient("http://127.0.0.1:1", 100) })).rejects.toMatchObject({ code: "service_unavailable" });
      expect(existsSync(baseDirectory)).toBe(false);
    } finally { temp.remove(); }
  });
  it("creates a loopback MCP configuration with actual runtime entry points", () => {
    expect(mcpNodeArguments().every(existsSync)).toBe(true);
    expect(mcpNodeArguments("demo/mcp").every(existsSync)).toBe(true);
    expect(codexMcpConfiguration("http://127.0.0.1:4317")).toContain('required=true');
    expect(codexMcpConfiguration("http://[::1]:4317")).toContain('CONTEXTMESH_HOST="::1"');
    for (const url of ["https://127.0.0.1", "http://example.com", "http://127.0.0.1/path", "http://user:password@localhost:4317"]) expect(() => codexMcpConfiguration(url)).toThrow("loopback");
  });
});
