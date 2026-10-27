import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ProjectContext } from "../application/context.js";
import { waitFor } from "./processes.js";

import { snakeImplementation, writeSnakeBrowser } from "./snake-fixture.js";

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
      await first("report_task", { requestId: "task-a", taskId: "snake-task", title: "Implement Snake game rules", expectedFiles: ["snake.js"] });
      writeFileSync(join(repositoryPath, "snake.js"), snakeImplementation);
      await first("refresh_repository");
      await first("save_progress_checkpoint", { requestId: "ready-a", memoryId: "snake-ready", taskId: "snake-task", content: "Snake engine is ready for coordination", relatedFiles: ["snake.js"] });
      await wait(first, c => c.items.some(i => i.taskId === "browser-task" && i.summary.startsWith("Overlap acknowledged")));
      await first("save_progress_checkpoint", { requestId: "overlap-a", memoryId: "overlap-seen-a", taskId: "snake-task", content: "Reviewed peer overlap acknowledgment" });
      await wait(first, c => c.items.some(i => i.kind === "blocker" && i.taskId === "browser-task"));
      await first("record_decision", { requestId: "decision-a", memoryId: "snake-contract", taskId: "snake-task", decision: "Pure createGame and step functions separate rules from canvas", rationale: "Test the exported interface without editing its implementation", relatedFiles: ["snake.js"] });
      await first("complete_task", { requestId: "complete-a", taskId: "snake-task", summary: "Implemented Snake game rules", importantFiles: ["snake.js"], decisions: ["Pure createGame and step functions separate rules from canvas"], remainingIssues: [], nextSteps: ["Build browser controls and movement growth collision tests"] });
      await first("end_session", { requestId: "end-a" });
    })(),
    (async () => {
      await second("register_session", { requestId: "register-b", agentType: "mock", repositoryPath });
      await wait(second, c => c.items.some(i => i.kind === "active_task" && i.id === "snake-task") && c.items.some(i => i.kind === "git_evidence" && i.files?.includes("snake.js")) && c.items.some(i => i.kind === "progress" && i.taskId === "snake-task"));
      const overlap = await second<{ warnings: { message: string }[] }>("report_task", { requestId: "task-b", taskId: "browser-task", title: "Build Snake browser and tests", expectedFiles: ["snake.js", "index.html", "app.js", "tests/snake.test.mjs"], dependencies: ["snake-task"] });
      assert.equal(overlap.warnings.length, 1); await second("get_conflicts"); await context(second);
      await second("save_progress_checkpoint", { requestId: "overlap-b", memoryId: "overlap-seen-b", taskId: "browser-task", content: "Overlap acknowledged: " + overlap.warnings[0].message });
      await wait(second, c => c.items.some(i => i.summary === "Reviewed peer overlap acknowledgment"));
      await second("update_task", { requestId: "narrow-b", taskId: "browser-task", expectedFiles: ["index.html", "app.js", "tests/snake.test.mjs"], reason: "Avoid concurrent implementation edits" });
      assert.deepEqual(await second("get_conflicts"), []);
      await second("record_blocker", { requestId: "block-b", blockerId: "waiting-for-snake", taskId: "browser-task", description: "Waiting for Snake engine handoff" });
      await wait(second, c => c.items.some(i => i.kind === "handoff" && i.taskId === "snake-task") && c.items.some(i => i.kind === "decision" && i.rationale));
      await second("save_progress_checkpoint", { requestId: "handoff-b", memoryId: "handoff-consumed-b", taskId: "browser-task", content: "Retrieved createGame/step handoff; next add canvas controls and game tests" });
      await second("resolve_blocker", { requestId: "unblock-b", blockerId: "waiting-for-snake", resolution: "Retrieved decision and handoff through shared context" });
      writeSnakeBrowser(repositoryPath); await second("refresh_repository");
      await second("complete_task", { requestId: "complete-b", taskId: "browser-task", summary: "Built Snake browser and tests", importantFiles: ["index.html", "app.js", "tests/snake.test.mjs"], decisions: ["Test the public interface"], remainingIssues: [], nextSteps: ["Play the finished Snake game"] });
      await second("end_session", { requestId: "end-b" });
    })(),
  ]);
}
