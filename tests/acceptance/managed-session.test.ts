import { it, expect } from "vitest";
import { join } from "node:path";
import { writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRuntime } from "../../src/runtime.js";
import { runManagedSession } from "../../src/adapters/codex/managed.js";
import { fixtureRepository, temporaryDirectory } from "../helpers.js";
import { LocalApiClient } from "../../src/transport/http/client.js";
import { prepareCodexConnection } from "../../src/adapters/codex/connection.js";

it("registers automatically, observes Git and ends a failed agent process without completing its task", async () => {
  const temp = temporaryDirectory(), repositoryPath = join(temp.path, "repository"); fixtureRepository(repositoryPath);
  const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
  const url = await runtime.app.listen({ host: "127.0.0.1", port: 0 });
  const child = join(temp.path, "agent.mjs");
  writeFileSync(child, "import { writeFileSync } from 'node:fs';\nconst response = await fetch(" + JSON.stringify(url + "/v1/events") + ", {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId:'task',source:'mcp',type:'task_started',projectId:'p',sessionId:'a',occurredAt:new Date().toISOString(),payload:{taskId:'t',title:'Interrupted work',expectedFiles:['src/auth.ts']}})}); if(!response.ok) process.exit(9); writeFileSync('src/auth.ts','export const authenticate = () => true;'); process.exit(7);\n");
  const config = { projectId: "p", sessionId: "a", repositoryPath, baseUrl: url, command: process.execPath, args: [child, "Task prompt"], markerPath: join(temp.path, "launched.json") };
  try {
    expect(await runManagedSession(config)).toBe(7);
    const state = runtime.service.processor.snapshot("p");
    expect(state.sessions[0].status).toBe("ended"); expect(state.tasks[0].status).toBe("active");
    expect(state.evidence[0].files.some(f => f.path === "src/auth.ts")).toBe(true);
    expect(state.memoryVersions).toEqual([]);
    await expect(runManagedSession(config)).rejects.toMatchObject({ code: "EEXIST" });
    await expect(runManagedSession({ ...config, markerPath: join(temp.path, "second-launch.json") })).rejects.toThrow("already registered");
    expect(runtime.service.processor.snapshot("p").sessions).toHaveLength(1);
    runtime.service.processor.ingest({ eventId: "existing-owner", source: "cli", type: "session_started", projectId: "p", sessionId: "b", occurredAt: new Date().toISOString(), payload: { agentType: "codex", repositoryPath } });
    await expect(runManagedSession({ ...config, sessionId: "b", markerPath: join(temp.path, "collision.json") })).rejects.toThrow("new session ID");
    expect(runtime.service.processor.snapshot("p").sessions.find(s => s.id === "b")?.status).toBe("active");
  } finally { await runtime.app.close(); temp.remove(); }
});

it("continues ordinary agent execution when ContextMesh is unavailable", async () => {
  const temp = temporaryDirectory(), child = join(temp.path, "agent.mjs"), marker = join(temp.path, "ran.txt"), diagnostics: string[] = [];
  writeFileSync(child, "import {writeFileSync} from 'node:fs'; writeFileSync(" + JSON.stringify(marker) + ",'ran');\n");
  try {
    expect(await runManagedSession({ projectId: "p", sessionId: "a", repositoryPath: temp.path, baseUrl: "http://127.0.0.1:1", command: process.execPath, args: [child, "Prompt"], markerPath: join(temp.path, "launched.json") }, message => diagnostics.push(message))).toBe(0);
    expect(existsSync(marker)).toBe(true); expect(diagnostics.length).toBeGreaterThan(0);
  } finally { temp.remove(); }
});

it("runs the generated launcher through its actual runtime entry point", async () => {
  const temp = temporaryDirectory(), repositoryPath = join(temp.path, "repository"); fixtureRepository(repositoryPath);
  const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
  const client = new LocalApiClient(await runtime.app.listen({ host: "127.0.0.1", port: 0 }));
  const entry = join(temp.path, "fake-codex.mjs"), marker = join(temp.path, "started.txt");
  writeFileSync(entry, "import {writeFileSync} from 'node:fs'; writeFileSync(" + JSON.stringify(marker) + ", 'started');\n");
  try {
    const connection = await prepareCodexConnection({ projectId: "p", sessionId: "a", repositoryPath, task: "Inspect fixture", baseDirectory: temp.path, client, launch: { command: process.execPath, args: [entry], source: "deterministic test double" } });
    await promisify(execFile)(process.execPath, [connection.node], { windowsHide: true, timeout: 10000 });
    expect(existsSync(marker)).toBe(true);
    expect(runtime.service.processor.snapshot("p").sessions[0]).toMatchObject({ id: "a", status: "ended", agentType: "codex" });
    expect(runtime.service.processor.snapshot("p").acceptedEventCount).toBe(2);
  } finally { await runtime.app.close(); temp.remove(); }
}, 15000);
