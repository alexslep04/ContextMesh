import { it, expect } from "vitest";
import { runDemo } from "../../src/demo/workflow.js";
import { temporaryDirectory } from "../helpers.js";
it("runs real HTTP/MCP processes, Git, CLI and restart recovery end to end", async () => {
  const temp = temporaryDirectory();
  try {
    const report = await runDemo({ baseDirectory: temp.path });
    expect(report.mode).toBe("fully-simulated");
    expect(report.checks).toHaveLength(7);
    expect(report.checks.join(" ")).toContain("restart");
  } finally { temp.remove(); }
}, 45000);
