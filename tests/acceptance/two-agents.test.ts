import { it, expect } from "vitest";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runTwoAgentDemo } from "../../src/demo/two-agents.js";
import { readReceipts } from "../../src/demo/receipts.js";
import { temporaryDirectory } from "../helpers.js";
import { verifyFixture } from "../../src/demo/verify-fixture.js";
import { authImplementation, writeAuthTests } from "../../src/demo/simulated-pair.js";
import { waitFor } from "../../src/demo/processes.js";

it("coordinates independent MCP peers through overlap, scope change, blocker and restart-safe handoffs", async () => {
  const temp = temporaryDirectory();
  try {
    const report = await runTwoAgentDemo({ live: false, baseDirectory: temp.path });
    expect(report.mode).toBe("two-simulated-mcp-peers");
    expect(report.fixtureTestsPassed).toBe(true);
    expect(report.checks).toHaveLength(8);
    const receipts = readReceipts(join(report.directory, "codex-b-receipts.jsonl"));
    expect(receipts.some(r => r.operation === "task_started" && r.warningIds?.length === 1)).toBe(true);
    expect(receipts.some(r => r.operation === "context" && r.items?.some(i => i.kind === "handoff" && i.sessionId === "codex-a"))).toBe(true);
    expect(receipts.some(r => r.operation === "blocker_resolved")).toBe(true);
    expect(receipts.at(-1)?.operation).toBe("session_ended");
    expect(readFileSync(join(report.directory, "fixture-test-results.txt"), "utf8")).toContain("# tests 3");
    expect(existsSync(join(report.directory, "state.db.lock"))).toBe(false);
    expect(JSON.parse(readFileSync(join(report.directory, "report.json"), "utf8"))).toEqual(report);
  } finally { temp.remove(); }
}, 45000);

it("rejects an operator-edit rehearsal with no live agents", async () => {
  await expect(runTwoAgentDemo({ live: false, operatorEdit: true })).rejects.toThrow("requires live");
});

it("independently rejects a broken implementation even when the peer's own tests pass", async () => {
  const temp = temporaryDirectory();
  try {
    mkdirSync(join(temp.path, "src"));
    writeFileSync(join(temp.path, "src/auth.ts"), authImplementation); writeAuthTests(temp.path);
    expect(await verifyFixture(temp.path)).toContain("# tests 3");
    writeFileSync(join(temp.path, "tests/auth.test.mjs"), "import test from 'node:test'; test('one', () => {}); test('two', () => {}); test('three', () => {});\n");
    writeFileSync(join(temp.path, "src/auth.ts"), "export const authenticate = () => true;\n");
    await expect(verifyFixture(temp.path)).rejects.toThrow();
  } finally { temp.remove(); }
});

it("stops a pending coordination wait when interrupted", async () => {
  const controller = new AbortController(); controller.abort(new Error("Demo interrupted"));
  await expect(waitFor(async () => undefined, "peer", 300000, controller.signal)).rejects.toThrow("interrupted");
});
