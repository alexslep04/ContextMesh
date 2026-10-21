import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HookConfig } from "./hook-delivery.js";
import { mcpNodeArguments } from "../codex/connection.js";

export function writeHookFiles(directory: string, config: HookConfig) {
  const configPath = join(directory, "hook-config.json"), scriptPath = join(directory, "hook-handler.mjs");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  writeFileSync(scriptPath, "import { spawn } from 'node:child_process';\nconst child = spawn(" + JSON.stringify(process.execPath) + ", " + JSON.stringify([...mcpNodeArguments("adapters/common/hook-run"), configPath]) + ", { stdio: 'inherit', windowsHide: true });\nchild.on('error', () => { console.error('ContextMesh hook could not start; host work may continue.'); console.log('{}'); });\n");
  // Hook commands run in the host's shell. Double quotes cover Windows paths;
  // reject metacharacters instead of expanding an unsafe shell command.
  const quote = (path: string) => { if (/["\r\n$`%]/.test(path)) throw new Error("Hook paths contain unsupported shell metacharacters"); return '"' + path + '"'; };
  const command = "node " + quote(scriptPath.replaceAll("\\", "/"));
  const hooks: Record<string, unknown> = {};
  for (const name of ["SessionStart", "SessionEnd", "PostToolUse", "UserPromptSubmit", "Stop"]) hooks[name] = [{ ...(name === "PostToolUse" ? { matcher: config.agent === "codex" ? "Bash|apply_patch|Edit|Write" : "Edit|Write|MultiEdit|Bash|PowerShell" } : {}), hooks: [{ type: "command", command, timeout: 10 }] }];
  const settingsPath = join(directory, config.agent === "codex" ? "codex-hooks.json" : "claude-settings.json");
  writeFileSync(settingsPath, JSON.stringify({ hooks }, null, 2));
  return { configPath, settingsPath };
}
