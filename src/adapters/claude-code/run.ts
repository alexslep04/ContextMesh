import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { hookConfigSchema } from "../common/hook-delivery.js";

export function resolveClaudeLaunch(env = process.env) {
  const explicit = env.CONTEXTMESH_CLAUDE;
  if (explicit && !isAbsolute(explicit)) throw new Error("CONTEXTMESH_CLAUDE must be an absolute executable or CLI entry path");
  const candidates = explicit ? [explicit] : [join(homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude"), ...(env.PATH ?? env.Path ?? "").split(process.platform === "win32" ? ";" : ":").filter(Boolean).flatMap(p => [join(p, process.platform === "win32" ? "claude.exe" : "claude"), join(p, "node_modules", "@anthropic-ai", "claude-code", "cli.js")])];
  for (const candidate of candidates) {
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
    if (/\.[cm]?js$/i.test(candidate)) return { command: process.execPath, args: [resolve(candidate)] };
    if (!/\.(cmd|bat|ps1)$/i.test(candidate)) return { command: resolve(candidate), args: [] };
  }
  throw new Error("Claude CLI was not found. Install it or set CONTEXTMESH_CLAUDE to its absolute native executable or installed cli.js entry point.");
}
export async function launchClaude(path: string): Promise<number> {
  const input = z.object({ hookConfigPath: z.string(), repositoryPath: z.string(), args: z.array(z.string()) }).parse(JSON.parse(readFileSync(path, "utf8")));
  const config = hookConfigSchema.parse(JSON.parse(readFileSync(input.hookConfigPath, "utf8")));
  if (!config.enabled) throw new Error("Claude integration is disabled pending live validation. Prepare with --enable-experimental-claude to opt in.");
  const launch = resolveClaudeLaunch();
  return new Promise(resolve => { const child = spawn(launch.command, [...launch.args, ...input.args], { cwd: input.repositoryPath, stdio: "inherit", windowsHide: true }); child.once("error", () => resolve(1)); child.once("exit", code => resolve(code ?? 1)); });
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { process.exitCode = await launchClaude(process.argv[2]); } catch (error) { console.error(error instanceof Error ? error.message : "Claude launch failed"); process.exitCode = 1; }
}
