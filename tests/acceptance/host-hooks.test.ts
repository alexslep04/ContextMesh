import { it, expect } from "vitest";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRuntime } from "../../src/runtime.js";
import { LocalApiClient } from "../../src/transport/http/client.js";
import { deliverHook, type HookConfig } from "../../src/adapters/common/hook-delivery.js";
import { createHookAdapter } from "../../src/adapters/common/hooks.js";
import { prepareClaudeConnection } from "../../src/adapters/claude-code/connection.js";
import { prepareCodexConnection } from "../../src/adapters/codex/connection.js";
import { fixtureRepository, temporaryDirectory } from "../helpers.js";

it("normalizes documented lifecycle/file fixtures, deduplicates delivery and keeps Stop separate from completion", async () => {
  const temp = temporaryDirectory(), repositoryPath = join(temp.path, "repository"); fixtureRepository(repositoryPath);
  const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
  const api = new LocalApiClient(await runtime.app.listen({ host: "127.0.0.1", port: 0 }));
  const config: HookConfig = { enabled: true, agent: "claude_code", projectId: "p", repositoryPath, integrationId: "integration", baseUrl: api.baseUrl };
  const base = { session_id: "host-a", cwd: repositoryPath, transcript_path: "PRIVATE-TRANSCRIPT", prompt: "PRIVATE-PROMPT" };
  try {
    const starts = await Promise.all([deliverHook(config, { ...base, hook_event_name: "SessionStart" }, api), deliverHook(config, { ...base, hook_event_name: "SessionStart" }, api)]);
    expect(starts[0]).toHaveProperty("hookSpecificOutput");
    let state = runtime.service.processor.snapshot("p"); expect(state.sessions).toHaveLength(1);
    const sessionId = state.sessions[0].id;
    await api.ingest({ eventId: "task", source: "mcp", type: "task_started", projectId: "p", sessionId, occurredAt: new Date().toISOString(), payload: { taskId: "t", title: "Edit auth", expectedFiles: ["src/auth.ts"] } });
    writeFileSync(join(repositoryPath, "src/auth.ts"), "export const authenticate = () => true;\n");
    const edited = { ...base, hook_event_name: "PostToolUse", tool_name: "Write", tool_use_id: "tool-a", tool_input: { file_path: join(repositoryPath, "src/auth.ts"), content: "PRIVATE-CONTENT" } };
    await deliverHook(config, edited, api); const count = runtime.service.processor.snapshot().acceptedEventCount;
    await deliverHook(config, edited, api); expect(runtime.service.processor.snapshot().acceptedEventCount).toBe(count);
    await deliverHook(config, { ...base, hook_event_name: "Stop", last_assistant_message: "PRIVATE-RESPONSE" }, api);
    state = runtime.service.processor.snapshot("p");
    expect(state.sessions[0].status).toBe("active"); expect(state.tasks[0].status).toBe("active");
    expect(state.tasks[0].reportedFiles).toEqual(["src/auth.ts"]); expect(state.tasks[0].modifiedFiles).toEqual([]);
    expect(state.evidence[0].files.some(f => f.path === "src/auth.ts")).toBe(true);
    expect(JSON.stringify(runtime.service.processor.history("p"))).not.toContain("PRIVATE-");
    await deliverHook(config, { ...base, hook_event_name: "SessionEnd" }, api);
    expect(runtime.service.processor.snapshot("p").sessions[0].status).toBe("ended");
    expect(runtime.service.processor.snapshot("p").tasks[0].status).toBe("active");
    await deliverHook(config, { ...base, hook_event_name: "SessionStart", source: "resume" }, api);
    state = runtime.service.processor.snapshot("p"); expect(state.sessions).toHaveLength(2);
    expect(state.sessions.filter(s => s.status === "active")).toHaveLength(1);
    const before = state.acceptedEventCount;
    await deliverHook(config, { ...base, hook_event_name: "PostToolUse", tool_name: "mcp__contextmesh__refresh_repository" }, api);
    await deliverHook(config, { ...base, hook_event_name: "SessionStart", agent_id: "subagent" }, api);
    expect(runtime.service.processor.snapshot("p").acceptedEventCount).toBe(before);
  } finally { await runtime.app.close(); temp.remove(); }
});

it("keeps disabled integrations inert and fails open on malformed input or unavailable service", async () => {
  const temp = temporaryDirectory(), diagnostics: string[] = [];
  const config: HookConfig = { enabled: false, agent: "claude_code", projectId: "p", repositoryPath: temp.path, integrationId: "i", baseUrl: "http://127.0.0.1:1" };
  try {
    expect(await deliverHook(config, null, undefined, m => diagnostics.push(m))).toEqual({}); expect(diagnostics).toEqual([]);
    expect(await deliverHook({ ...config, enabled: true }, { hook_event_name: "SessionStart", session_id: "h", cwd: temp.path }, undefined, m => diagnostics.push(m))).toEqual({});
    expect(diagnostics).toHaveLength(1);
    expect(await deliverHook({ ...config, enabled: true }, null, undefined, m => diagnostics.push(m))).toEqual({});
    expect(diagnostics).toHaveLength(2);
    const adapter = createHookAdapter("claude_code");
    const outside = adapter.normalize({ projectId: "p", sessionId: "s", repositoryPath: temp.path, integrationId: "i", taskId: "t", occurredAt: new Date().toISOString(), hook: { session_id: "s", cwd: temp.path, hook_event_name: "PostToolUse", tool_name: "Write", tool_use_id: "u", tool_input: { file_path: "../outside.ts" } } });
    expect(outside).toEqual([]);
  } finally { temp.remove(); }
});

it("generates disabled Claude configuration without an installed CLI and opt-in Codex hook configuration", async () => {
  const temp = temporaryDirectory(), repositoryPath = join(temp.path, "repository"); fixtureRepository(repositoryPath);
  const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
  const api = new LocalApiClient(await runtime.app.listen({ host: "127.0.0.1", port: 0 }));
  try {
    const claude = await prepareClaudeConnection({ projectId: "p", repositoryPath, task: "Test auth", baseDirectory: temp.path, client: api });
    expect(claude.enabled).toBe(false); expect(claude.liveVerified).toBe(false);
    const settings = JSON.parse(readFileSync(claude.settingsPath, "utf8")); expect(settings.hooks).toHaveProperty("SessionStart"); expect(settings.hooks).toHaveProperty("PostToolUse");
    await expect(promisify(execFile)(process.execPath, [claude.node], { timeout: 10000, windowsHide: true })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("disabled pending live validation") });
    expect(runtime.service.processor.snapshot().acceptedEventCount).toBe(0);
    const codex = await prepareCodexConnection({ projectId: "p", repositoryPath, task: "Test auth", hooks: true, baseDirectory: temp.path, client: api, launch: { command: process.execPath, args: [], source: "test" } });
    const managed = JSON.parse(readFileSync(join(codex.directory, "managed-session.json"), "utf8"));
    expect(managed.args.some((arg: string) => arg.startsWith("hooks="))).toBe(true);
    expect(managed.args).not.toContain("--dangerously-bypass-hook-trust");
    expect(JSON.parse(readFileSync(join(codex.directory, "hook-config.json"), "utf8")).fixedSessionId).toBe(codex.sessionId);
  } finally { await runtime.app.close(); temp.remove(); }
});
