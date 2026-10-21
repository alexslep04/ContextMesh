import { Command } from "commander";
import { runDemo } from "./workflow.js";
import { runTwoAgentDemo } from "./two-agents.js";
const program = new Command().description("Rehearse ContextMesh in an isolated fixture repository and database")
  .option("--live", "Wait for one real Codex session; simulate its peer")
  .option("--two-live", "Use two real Codex sessions with overlap, scope update and handoff")
  .option("--two-simulated", "Rehearse the two-agent workflow with deterministic MCP peers")
  .option("--operator-edit", "Let the harness make labeled fixture edits on a restricted live host")
  .option("--timeout <seconds>", "Maximum wait for each agent phase", "300");
program.parse();
const options = program.opts();
const timeoutMs = Number(options.timeout) * 1000;
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 3600000) throw new Error("Timeout must be between 1 and 3600 seconds");
if ([options.live, options.twoLive, options.twoSimulated].filter(Boolean).length > 1) throw new Error("Choose only one demo mode");
if (options.operatorEdit && !options.live && !options.twoLive) throw new Error("--operator-edit requires --live or --two-live");
try {
  if (options.twoLive || options.twoSimulated) await runTwoAgentDemo({ live: Boolean(options.twoLive), operatorEdit: options.operatorEdit, timeoutMs, log: console.log });
  else await runDemo({ live: options.live, operatorEdit: options.operatorEdit, timeoutMs, log: console.log });
}
catch (error) { console.error("Demo failed: " + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; }
