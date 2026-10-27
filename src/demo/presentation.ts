import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TwoAgentDemoReport } from "./two-agents.js";
import type { ProjectContext } from "../application/context.js";
import { nodeArguments } from "./processes.js";
import { powershellQuote } from "../adapters/codex/connection.js";

export function writePresentation(report: TwoAgentDemoReport, context: ProjectContext) {
  const memories = context.items.filter(i => ["decision", "handoff", "progress"].includes(i.kind));
  writeFileSync(join(report.directory, "presentation.md"), [
    "# ContextMesh Snake demo", "", "Mode: " + report.mode + (report.operatorEdit ? " (operator edits)" : ""),
    "Elapsed: " + report.elapsedSeconds + " seconds", "",
    ...report.checks.map(check => "- PASS: " + check), "", "## Retrieved after service restart", "",
    ...memories.map(item => "- [" + item.kind + "] " + item.sessionId + ": " + item.summary + (item.rationale ? " — " + item.rationale : "")),
    "", "The overlap is deliberately introduced by developer demo instructions. ContextMesh warns; it does not assign tasks or prevent edits.",
    "The post-restart reader is a deterministic MCP verifier, not a third live model.",
  ].join("\n") + "\n");
  const args = [...nodeArguments("demo/play"), report.directory];
  writeFileSync(join(report.directory, "play.ps1"), "& " + [process.execPath, ...args].map(powershellQuote).join(" ") + "\nexit $LASTEXITCODE\n");
}
