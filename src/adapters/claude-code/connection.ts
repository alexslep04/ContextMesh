import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { idSchema, textSchema } from "../../domain/schemas.js";
import { LocalApiClient } from "../../transport/http/client.js";
import { inspectRepository } from "../../infrastructure/git/inspect.js";
import type { ProcessorSnapshot } from "../../domain/state.js";
import { mcpNodeArguments, writeCodexScripts } from "../codex/connection.js";
import { writeHookFiles } from "../common/hook-config.js";

export async function prepareClaudeConnection(options: { projectId: string; repositoryPath: string; task: string; enabled?: boolean; baseDirectory?: string; client?: LocalApiClient }) {
  const projectId = idSchema.parse(options.projectId), task = textSchema.parse(options.task), repositoryPath = resolve(options.repositoryPath);
  const client = options.client ?? new LocalApiClient(), integrationId = randomUUID();
  const endpoint = new URL(client.baseUrl);
  if (endpoint.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) || endpoint.username || endpoint.password) throw new Error("Claude connections require a loopback service");
  const state = (await client.read("status", { projectId }) as { state: ProcessorSnapshot }).state;
  const evidence = await inspectRepository(projectId, repositoryPath), existing = state.projects.find(p => p.id === projectId);
  if (existing?.repositoryPath && (await inspectRepository(projectId, existing.repositoryPath)).commonDirectory !== evidence.commonDirectory) throw new Error("Project ID belongs to a different Git repository");
  const base = resolve(options.baseDirectory ?? ".contextmesh/connections"); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, "claude-"));
  const config = { agent: "claude_code" as const, enabled: options.enabled ?? false, projectId, repositoryPath, integrationId, baseUrl: client.baseUrl };
  const files = writeHookFiles(directory, config), mcpPath = join(directory, "mcp.json"), launchPath = join(directory, "launch.json");
  writeFileSync(mcpPath, JSON.stringify({ mcpServers: { contextmesh: { command: process.execPath, args: mcpNodeArguments(), env: { CONTEXTMESH_HOST: endpoint.hostname.replace(/^\[|\]$/g, ""), CONTEXTMESH_PORT: endpoint.port || "80" } } } }, null, 2));
  const instructions = "Use ContextMesh MCP for shared project context and meaningful reports. SessionStart supplies your project/session identity; do not register that session again. If no hook context is available, register a new unique session as claude_code with projectId " + JSON.stringify(projectId) + " and repositoryPath " + JSON.stringify(repositoryPath) + ". Retrieve context before edits. Report understood tasks and expected files, inspect overlap warnings, update changed scope, record decisions with rationale and blockers/resolutions. Use new requestIds for meaningful reports and stable IDs for exact retries. Complete tasks with honest handoffs and next steps. Hooks observe lifecycle and refresh Git, never mark work complete. If ContextMesh is unavailable, explain once and continue ordinary work. Do not store transcripts or infer authorship from other sessions' dirty files.";
  writeFileSync(launchPath, JSON.stringify({ hookConfigPath: files.configPath, repositoryPath, args: ["--settings", files.settingsPath, "--mcp-config", mcpPath, "--strict-mcp-config", "--append-system-prompt", instructions, task] }, null, 2));
  const scripts = writeCodexScripts(directory, "start-agent", { command: process.execPath, args: [], source: "Claude launcher" }, [...mcpNodeArguments("adapters/claude-code/run"), launchPath]);
  writeFileSync(join(directory, "README.txt"), "Claude integration: implemented, live validation pending.\nEnabled: " + config.enabled + "\nPrepare again with --enable-experimental-claude to opt in. No global configuration was changed.\n");
  return { projectId, repositoryPath, directory, enabled: config.enabled, liveVerified: false, ...files, ...scripts };
}
