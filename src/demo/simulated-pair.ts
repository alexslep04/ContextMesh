import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ProjectContext } from "../application/context.js";
import { waitFor } from "./processes.js";

export const authImplementation = 'export function authenticate(token: string): boolean { return token === "demo-token"; }\n';
export const authTests = `import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../src/auth.ts';
test('accepts the fixture token', () => assert.equal(authenticate('demo-token'), true));
test('rejects an invalid token', () => assert.equal(authenticate('wrong-token'), false));
test('rejects an empty token', () => assert.equal(authenticate(''), false));
`;
export function writeAuthTests(repositoryPath: string) {
  mkdirSync(join(repositoryPath, "tests"), { recursive: true });
  writeFileSync(join(repositoryPath, "tests/auth.test.mjs"), authTests);
}
export function peerTools(client: Client, projectId: string, sessionId: string) {
  return async <T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const result = await client.callTool({ name, arguments: { projectId, sessionId, ...args } });
    const value = JSON.parse((result.content as { text: string }[])[0].text);
    assert(!result.isError, JSON.stringify(value)); return value as T;
  };
}
// Deterministic semantic peers for tests/rehearsal, using actual independent
// stdio MCP processes. They are always labeled simulated in the report.
export async function simulatePair(a: Client, b: Client, projectId: string, repositoryPath: string, signal: AbortSignal) {
  const first = peerTools(a, projectId, "codex-a"), second = peerTools(b, projectId, "codex-b");
  const context = (tool: ReturnType<typeof peerTools>) => tool<ProjectContext>("get_project_context", { budget: 24000 });
  const wait = (tool: ReturnType<typeof peerTools>, predicate: (c: ProjectContext) => boolean) => waitFor(async () => { const c = await context(tool); return predicate(c) ? c : undefined; }, "simulated peer coordination", 20000, signal);
  await Promise.all([
    (async () => {
      await first("register_session", { requestId: "register-a", agentType: "mock", repositoryPath });
      await context(first);
      await first("report_task", { requestId: "task-a", taskId: "auth-task", title: "Implement fixture token authentication", expectedFiles: ["src/auth.ts"] });
      writeFileSync(join(repositoryPath, "src/auth.ts"), authImplementation);
      await first("refresh_repository");
      await first("save_progress_checkpoint", { requestId: "ready-a", memoryId: "auth-ready", taskId: "auth-task", content: "Authentication implementation is ready for coordination", relatedFiles: ["src/auth.ts"] });
      await wait(first, c => c.items.some(i => i.taskId === "tests-task" && i.summary.startsWith("Overlap acknowledged")));
      await first("save_progress_checkpoint", { requestId: "overlap-a", memoryId: "overlap-seen-a", taskId: "auth-task", content: "Reviewed peer overlap acknowledgment" });
      await wait(first, c => c.items.some(i => i.kind === "blocker" && i.taskId === "tests-task"));
      await first("record_decision", { requestId: "decision-a", memoryId: "auth-contract", taskId: "auth-task", decision: "Authenticate accepts only demo-token", rationale: "Test the exported interface without editing its implementation", relatedFiles: ["src/auth.ts"] });
      await first("complete_task", { requestId: "complete-a", taskId: "auth-task", summary: "Implemented fixture token authentication", importantFiles: ["src/auth.ts"], decisions: ["Authenticate accepts only demo-token"], remainingIssues: [], nextSteps: ["Add accepted-token, rejected-token and empty-token tests"] });
      await first("end_session", { requestId: "end-a" });
    })(),
    (async () => {
      await second("register_session", { requestId: "register-b", agentType: "mock", repositoryPath });
      await wait(second, c => c.items.some(i => i.kind === "active_task" && i.id === "auth-task") && c.items.some(i => i.kind === "git_evidence" && i.files?.includes("src/auth.ts")) && c.items.some(i => i.kind === "progress" && i.taskId === "auth-task"));
      const overlap = await second<{ warnings: { message: string }[] }>("report_task", { requestId: "task-b", taskId: "tests-task", title: "Add fixture authentication tests", expectedFiles: ["src/auth.ts", "tests/auth.test.mjs"], dependencies: ["auth-task"] });
      assert.equal(overlap.warnings.length, 1); await second("get_conflicts"); await context(second);
      await second("save_progress_checkpoint", { requestId: "overlap-b", memoryId: "overlap-seen-b", taskId: "tests-task", content: "Overlap acknowledged: " + overlap.warnings[0].message });
      await wait(second, c => c.items.some(i => i.summary === "Reviewed peer overlap acknowledgment"));
      await second("update_task", { requestId: "narrow-b", taskId: "tests-task", expectedFiles: ["tests/auth.test.mjs"], reason: "Avoid concurrent implementation edits" });
      assert.deepEqual(await second("get_conflicts"), []);
      await second("record_blocker", { requestId: "block-b", blockerId: "waiting-for-auth", taskId: "tests-task", description: "Waiting for authentication handoff" });
      await wait(second, c => c.items.some(i => i.kind === "handoff" && i.taskId === "auth-task") && c.items.some(i => i.kind === "decision" && i.rationale));
      await second("save_progress_checkpoint", { requestId: "handoff-b", memoryId: "handoff-consumed-b", taskId: "tests-task", content: "Retrieved authentication handoff; next add accepted, rejected, and empty token tests" });
      await second("resolve_blocker", { requestId: "unblock-b", blockerId: "waiting-for-auth", resolution: "Retrieved decision and handoff through shared context" });
      writeAuthTests(repositoryPath); await second("refresh_repository");
      await second("complete_task", { requestId: "complete-b", taskId: "tests-task", summary: "Added authentication contract test fixture", importantFiles: ["tests/auth.test.mjs"], decisions: ["Test the public interface"], remainingIssues: [], nextSteps: ["Replace fixture with application requirements"] });
      await second("end_session", { requestId: "end-b" });
    })(),
  ]);
}
