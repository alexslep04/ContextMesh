import { execFile, spawn } from "node:child_process";
import type { CodexLaunch } from "../adapters/codex/launch.js";

// Optional convenience for a developer-selected demo script. This does not
// introduce task assignment or process control into the ContextMesh service.
export function startDemoAgent(launch: CodexLaunch, args: string[], repositoryPath: string, controller: AbortController, role: string, log: (message: string) => void) {
  const child = spawn(launch.command, [...launch.args, ...args], { cwd: repositoryPath, windowsHide: true, stdio: "ignore" });
  let finished = false;
  const done = new Promise<void>(resolve => {
    child.once("error", error => { finished = true; controller.abort(new Error("Cannot launch Codex " + role + ": " + error.message)); resolve(); });
    child.once("exit", code => {
      if (code !== 0 && !controller.signal.aborted) controller.abort(new Error("Codex " + role + " exited with code " + code + ". Check login, CLI compatibility and host permissions; use the printed separate-terminal scripts for diagnostics."));
      finished = true; log("Codex " + role.toUpperCase() + " exited (" + code + ")."); resolve();
    });
  });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
    if (process.platform === "win32") {
      // Kill only this demo-owned process tree, including npm/native children.
      await new Promise<void>(resolve => execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => resolve()));
    } else child.kill("SIGTERM");
    await done;
  };
  return { done, stop, get finished() { return finished; } };
}
