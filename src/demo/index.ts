import { Command } from "commander";
import { runDemo } from "./workflow.js";
import { runTwoAgentDemo } from "./two-agents.js";
import { presentSnake } from "./preview.js";
import { powershellQuote } from "../adapters/codex/connection.js";
import { resolveCodexLaunch } from "../adapters/codex/launch.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const program = new Command().description("Build Snake with two Codex sessions in a disposable Git project")
  .option("--two-live", "Use two real Codex sessions (prints separate-terminal launchers)")
  .option("--live", "Alias for --two-live")
  .option("--two-simulated", "Deterministic rehearsal without model usage (default)")
  .option("--launch-agents", "Launch both live Codex processes automatically; display checkpoints only")
  .option("--serve", "After success, keep a local Snake preview running until Ctrl+C")
  .option("--operator-edit", "Explicitly let the harness write labeled fixture files for restricted hosts")
  .option("--legacy-auth", "Run the earlier simulated authentication smoke check")
  .option("--timeout <seconds>", "Maximum wait for each agent phase", "300");
program.parse();
const options = program.opts();
try {
  const timeoutMs = Number(options.timeout) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 3600000) throw new Error("Timeout must be between 1 and 3600 seconds");
  const live = Boolean(options.twoLive || options.live);
  if ([live, options.twoSimulated, options.legacyAuth].filter(Boolean).length > 1) throw new Error("Choose only one demo mode");
  if (options.operatorEdit && !live) throw new Error("--operator-edit requires live agents");
  if (options.launchAgents && !live) throw new Error("--launch-agents requires --two-live");
  if (options.legacyAuth && options.serve) throw new Error("--serve requires the Snake demo");
  if (options.launchAgents) {
    const codex = resolveCodexLaunch();
    try {
      await promisify(execFile)(codex.command, [...codex.args, "login", "status"], { windowsHide: true, timeout: 15000 });
      console.log("Codex found and login check passed: " + codex.command);
    } catch { throw new Error("Codex login check failed. Run codex login (or the resolved executable with login), then retry. See docs/codex.md."); }
  }
  if (options.legacyAuth) await runDemo({ timeoutMs, log: console.log });
  else {
    const report = await runTwoAgentDemo({ live, launchAgents: options.launchAgents, operatorEdit: options.operatorEdit, timeoutMs, log: console.log });
    console.log("\nPresentation evidence: " + report.directory + "/presentation.md\nReplay later: npm run demo:play -- " + powershellQuote(report.directory));
    if (options.serve) await presentSnake(report.repositoryPath);
  }
} catch (error) { console.error("Demo failed: " + (error instanceof Error ? error.message : "Demo failed")); process.exitCode = 1; }
