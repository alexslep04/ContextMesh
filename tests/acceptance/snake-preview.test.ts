import { it, expect } from "vitest";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { temporaryDirectory } from "../helpers.js";
import { seedSnakeFixture, snakeImplementation, writeSnakeBrowser } from "../../src/demo/snake-fixture.js";
import { serveSnake } from "../../src/demo/preview.js";
import { verifyFixture } from "../../src/demo/verify-fixture.js";
import { startDemoAgent } from "../../src/demo/live-agent.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { nodeArguments } from "../../src/demo/processes.js";

it("verifies the Snake engine and executable browser controls, then serves only game files on loopback", async () => {
  const temp = temporaryDirectory();
  seedSnakeFixture(temp.path); writeFileSync(join(temp.path, "snake.js"), snakeImplementation); writeSnakeBrowser(temp.path);
  const preview = await serveSnake(temp.path);
  try {
    expect(await verifyFixture(temp.path)).toContain("# tests 7");
    expect(preview.url).toMatch(/^http:\/\/127\.0\.0\.1:/);
    const page = await fetch(preview.url); expect(page.status).toBe(200); expect(await page.text()).toContain("Snake, together.");
    const script = await fetch(preview.url + "/snake.js"); expect(script.headers.get("content-type")).toContain("javascript");
    expect(await (await fetch(preview.url + "/app.js", { method: "HEAD" })).text()).toBe("");
    for (const path of ["/CONTRACT.md", "/package.json", "/.git/config", "/%2e%2e%2fstate.db", "/constructor"]) expect((await fetch(preview.url + path)).status).toBe(404);
    expect((await fetch(preview.url, { method: "POST" })).status).toBe(405);
    writeFileSync(join(temp.path, "app.js"), "// blank browser code\n");
    await expect(verifyFixture(temp.path)).rejects.toThrow();
  } finally { await preview.stop(); temp.remove(); }
}, 20000);

it("propagates a failed automatic Codex launch and stops only its owned process", async () => {
  const temp = temporaryDirectory(), messages: string[] = [];
  try {
    const controller = new AbortController();
    const agent = startDemoAgent({ command: process.execPath, args: [], source: "test double" }, ["-e", "process.exit(7)"], temp.path, controller, "a", message => messages.push(message));
    await agent.done; expect(controller.signal.aborted).toBe(true); expect(controller.signal.reason.message).toContain("code 7");
    await agent.stop(); expect(messages).toEqual(["Codex A exited (7)."]);
    const idle = startDemoAgent({ command: process.execPath, args: [], source: "test double" }, ["-e", "setInterval(()=>{},1000)"], temp.path, new AbortController(), "b", () => {});
    await idle.stop(); expect(idle.finished).toBe(true);
  } finally { temp.remove(); }
}, 15000);

it("rejects invalid demo modes and timeouts before starting processes or writing fixtures", async () => {
  const temp = temporaryDirectory();
  try {
    for (const args of [["--launch-agents"], ["--operator-edit"], ["--two-live", "--two-simulated"], ["--timeout", "0"]]) {
      await expect(promisify(execFile)(process.execPath, [...nodeArguments("demo/index"), ...args], { cwd: temp.path, windowsHide: true, timeout: 10000 })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("Demo failed:") });
    }
  } finally { temp.remove(); }
}, 15000);
