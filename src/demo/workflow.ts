import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LocalApiClient } from "../transport/http/client.js";
import type { ProcessorSnapshot } from "../domain/state.js";
import type { ProjectContext } from "../application/context.js";
import type { ContextMeshEvent } from "../domain/events.js";
import { availablePort, launchService, nodeArguments, sourceRoot, waitFor } from "./processes.js";
import { codexLauncherSource, resolveCodexLaunch } from "./codex.js";
import { codexExecArguments } from "../adapters/codex/connection.js";
const execute = promisify(execFile);
export interface DemoOptions { live?: boolean; operatorEdit?: boolean; timeoutMs?: number; baseDirectory?: string; log?: (message: string) => void }
export interface DemoReport { mode: "live-agent-and-simulated-peer" | "fully-simulated"; operatorEdit: boolean; projectId: string; directory: string; repositoryPath: string; checks: string[] }
export async function runDemo(options: DemoOptions = {}): Promise<DemoReport> {
  const log = options.log ?? (() => {});
  // Fail before starting a service if the live host cannot be located.
  const codex = options.live ? resolveCodexLaunch() : undefined;
  const base = resolve(options.baseDirectory ?? ".contextmesh/demos"); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, "demo-")), repositoryPath = join(directory, "repository"), projectId = "demo-" + directory.split(/[\\/]/).at(-1);
  mkdirSync(join(repositoryPath, "src"), { recursive: true });
  writeFileSync(join(repositoryPath, ".gitignore"), "DEMO_PROMPT.md\n");
  writeFileSync(join(repositoryPath, "src/auth.ts"), "export function authenticate(token: string): boolean { return false; }\n");
  const git = (...args: string[]) => execute("git", ["-C", repositoryPath, ...args], { windowsHide: true, timeout: 5000 });
  await git("init"); await git("add", "."); await git("-c", "user.name=ContextMesh Demo", "-c", "user.email=demo@example.invalid", "commit", "-m", "Demo fixture baseline");
  const port = await availablePort(), url = "http://127.0.0.1:" + port, api = new LocalApiClient(url);
  let service = await launchService(directory, port);
  const agent = new Client({ name: "contextmesh-demo-verifier", version: "1" });
  const env = Object.fromEntries(Object.entries(service.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const transport = new StdioClientTransport({ command: process.execPath, args: nodeArguments("mcp"), cwd: sourceRoot, env, stderr: "pipe" });
  transport.stderr?.on("data", data => log("MCP diagnostic: " + String(data).trim()));
  const checks: string[] = [];
  const pass = (message: string) => { checks.push(message); log("PASS: " + message); };
  const status = async () => (await api.read("status", { projectId }) as { state: ProcessorSnapshot }).state;
  let sequence = 0;
  const report = async (type: ContextMeshEvent["type"], payload: Record<string, unknown>, sessionId = "simulated-peer") => {
    const event: ContextMeshEvent = { eventId: "simulated-" + sequence++, source: "mock", type, projectId, sessionId, occurredAt: new Date().toISOString(), payload };
    return { event, response: await api.ingest(event) };
  };
  const tool = async (name: string, args: Record<string, unknown>) => {
    const response = await agent.callTool({ name, arguments: { projectId, ...args } });
    const value = JSON.parse((response.content as { text: string }[])[0].text);
    assert(!response.isError, JSON.stringify(value)); return value;
  };
  const context = () => tool("get_project_context", { projectId, budget: 16000 }) as Promise<ProjectContext>;
  try {
    await agent.connect(transport);
    log("Artifacts: " + directory + "\nService: " + url + "\nProject: " + projectId);
    let liveSessionId: string;
    if (options.live) {
      const prompt = livePrompt(projectId, repositoryPath, options.operatorEdit ?? false);
      const configuration = 'mcp_servers.contextmesh={command=' + JSON.stringify(process.execPath.replaceAll("\\", "/")) + ',args=' + JSON.stringify(nodeArguments("mcp").map(p => p.replaceAll("\\", "/"))) + ',env={CONTEXTMESH_HOST="127.0.0.1",CONTEXTMESH_PORT="' + port + '"},startup_timeout_sec=20,default_tools_approval_mode="approve",enabled_tools=["register_session","get_project_context","report_task","report_file_activity","refresh_repository","get_conflicts","record_decision","complete_task"]}';
      const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
      const agentArgs = codexExecArguments(repositoryPath, configuration, prompt, options.operatorEdit);
      // Node preserves embedded TOML quotes that Windows PowerShell 5 strips
      // when forwarding an inline configuration directly to a native process.
      const launcher = codexLauncherSource(codex!, agentArgs);
      writeFileSync(join(directory, "start-agent.mjs"), launcher);
      writeFileSync(join(directory, "codex-cli.mjs"), codexLauncherSource(codex!));
      writeFileSync(join(directory, "check-login.ps1"), "& " + quote(process.execPath) + " " + quote(join(directory, "codex-cli.mjs")) + " login status\n");
      const command = "& " + quote(process.execPath) + " " + quote(join(directory, "start-agent.mjs"));
      writeFileSync(join(repositoryPath, "DEMO_PROMPT.md"), prompt);
      writeFileSync(join(directory, "start-agent.ps1"), command + "\n");
      writeFileSync(join(directory, "connection.json"), JSON.stringify({ url, projectId, repositoryPath, configuration, codex }, null, 2));
      log("Codex: " + codex!.command + " (" + codex!.source + ")\nLogin check: & " + quote(join(directory, "check-login.ps1")));
      log("LIVE MODE: in another PowerShell terminal run:\n& " + quote(join(directory, "start-agent.ps1")));
      let operatorEdited = false;
      const liveTask = await waitFor(async () => {
        const state = await status();
        const session = state.sessions.find(s => s.agentType !== "mock" && s.status === "active");
        const task = state.tasks.find(t => t.sessionId === session?.id && t.status === "active" && t.expectedFiles.includes("src/auth.ts"));
        if (task && options.operatorEdit && !operatorEdited) {
          writeFileSync(join(repositoryPath, "src/auth.ts"), 'export function authenticate(token: string): boolean { return token === "demo-token"; }\n');
          operatorEdited = true;
          log("OPERATOR EDIT: harness changed the disposable fixture; this edit is not attributed to the live agent.");
          await api.refresh({ projectId, sessionId: task.sessionId });
        }
        return task && state.evidence.some(e => e.files.some(f => f.path === "src/auth.ts")) ? task : undefined;
      }, "live agent registration, task, file edit and Git refresh", options.timeoutMs ?? 300000);
      liveSessionId = liveTask.sessionId;
      pass(options.operatorEdit ? "Live agent reported work; Git verified the explicitly labeled operator edit" : "Live agent reported work and Git verified its fixture change");
    } else {
      liveSessionId = "simulated-agent-a";
      log("FULLY SIMULATED REHEARSAL: both sessions are simulated; MCP, HTTP, Git and persistence are real.");
      await tool("register_session", { sessionId: liveSessionId, requestId: "register-a", agentType: "mock", repositoryPath });
      await tool("report_task", { sessionId: liveSessionId, requestId: "task-a", taskId: "auth-task", title: "Implement fixture authentication", expectedFiles: ["src/auth.ts"] });
      writeFileSync(join(repositoryPath, "src/auth.ts"), 'export function authenticate(token: string): boolean { return token === "demo-token"; }\n');
      await tool("refresh_repository", { sessionId: liveSessionId });
      pass("MCP session reported work and Git verified a real fixture edit");
    }
    const registered = await report("session_started", { agentType: "mock", repositoryPath });
    const beforeTask = await api.read("context", { projectId, sessionId: "simulated-peer", budget: 16000 }) as ProjectContext;
    assert(beforeTask.items.some(i => i.kind === "active_task" && i.sessionId === liveSessionId));
    assert(beforeTask.items.some(i => i.kind === "git_evidence" && i.files?.includes("src/auth.ts")));
    pass("Simulated peer retrieved related active work and Git evidence");
    const overlap = await report("task_started", { taskId: "peer-tests", title: "SIMULATED PEER: add authentication tests", expectedFiles: ["src/auth.ts"] });
    assert.equal(overlap.response.snapshot.warnings.length, 1);
    assert.equal((await tool("get_conflicts", {})).length, 1);
    pass("HTTP and MCP agree on an explained expected-file overlap warning");
    if (!options.live) {
      await tool("record_decision", { sessionId: liveSessionId, requestId: "decision-a", memoryId: "auth-contract", taskId: "auth-task", decision: "Keep authentication in src/auth.ts", rationale: "A single fixture interface lets the peer add focused tests.", relatedFiles: ["src/auth.ts"] });
      await tool("complete_task", { sessionId: liveSessionId, requestId: "complete-a", taskId: "auth-task", summary: "Implemented fixture token authentication", importantFiles: ["src/auth.ts"], decisions: ["Authentication remains in src/auth.ts"], remainingIssues: [], nextSteps: ["Add invalid-token and expiry tests"] });
    } else {
      await waitFor(async () => {
        const state = await status();
        return state.tasks.some(t => t.sessionId === liveSessionId && t.status === "completed") && state.memoryVersions.some(m => m.kind === "decision" && m.sourceSessionId === liveSessionId) ? true : undefined;
      }, "live agent decision and completion handoff", options.timeoutMs ?? 300000);
    }
    assert((await context()).items.some(i => i.kind === "handoff"));
    pass("Decision rationale and completion next steps are retrievable");
    await service.stop(); service = await launchService(directory, port);
    await report("session_started", { agentType: "mock", repositoryPath }, "later-session");
    const recovered = await context();
    assert(recovered.items.some(i => i.kind === "decision" && i.rationale));
    assert(recovered.items.some(i => i.kind === "handoff" && Array.isArray(i.data?.nextSteps) && i.data.nextSteps.length > 0));
    pass("A real service process restart preserves the decision and handoff");
    const beforeReplay = (await status()).acceptedEventCount;
    assert.equal((await api.ingest(registered.event)).reason, "duplicate");
    assert.equal((await status()).acceptedEventCount, beforeReplay);
    pass("Replayed delivery creates no duplicate state or memory");
    const cli = await execute(process.execPath, [...nodeArguments("cli/index"), "status", "--project", projectId, "--json"], { cwd: sourceRoot, env: service.env, windowsHide: true, timeout: 10000 });
    assert.equal(JSON.parse(cli.stdout).state.acceptedEventCount, beforeReplay);
    const doctor = await execute(process.execPath, [...nodeArguments("cli/index"), "doctor", "--json"], { cwd: sourceRoot, env: service.env, windowsHide: true, timeout: 10000 });
    assert.equal(JSON.parse(doctor.stdout).ok, true);
    pass("CLI inspection and doctor see the same healthy persistent service");
    const result: DemoReport = { mode: options.live ? "live-agent-and-simulated-peer" : "fully-simulated", operatorEdit: Boolean(options.live && options.operatorEdit), projectId, directory, repositoryPath, checks };
    writeFileSync(join(directory, "report.json"), JSON.stringify(result, null, 2));
    log("Demo passed. Service stopped; fixture, database, diagnostics and report remain in " + directory);
    return result;
  } finally { await agent.close(); await service.stop(); }
}
function livePrompt(projectId: string, repositoryPath: string, operatorEdit: boolean): string {
  return `# ContextMesh live demonstration
Work only in this disposable fixture repository. The second session is simulated by the demo harness.
Use ContextMesh MCP tools for reporting, not direct HTTP requests or database writes.
Project ID: ${projectId}
Repository path: ${repositoryPath}
Session ID: live-codex
Use a different stable requestId for each meaningful report, and reuse it only for an exact retry.

1. Call register_session with projectId, sessionId, requestId register-live, agentType codex, and repositoryPath above.
2. Call get_project_context, then report_task with requestId task-live, taskId auth-task, title Implement fixture authentication, expectedFiles [src/auth.ts].
${operatorEdit ? "3. OPERATOR-EDIT MODE: do not call file or shell tools. The harness operator will edit src/auth.ts after your task report. This is not your edit; do not claim authorship. Use refresh_repository and get_project_context to observe it." : "3. Edit src/auth.ts so authenticate returns true exactly when token equals the literal demo-token. This is a demonstration fixture, not production authentication."}
${operatorEdit ? "4. Call refresh_repository for your session until it shows src/auth.ts changed. Do not report_file_activity: the file was edited by the operator." : "4. Call report_file_activity for task auth-task and path src/auth.ts, requestId file-live. Call refresh_repository for your session."}
5. Call get_conflicts. The harness will create a simulated peer task once it sees your Git evidence. If no warning is present yet, wait briefly and retry for up to 30 seconds. Retrieve context and acknowledge the overlap; do not edit the peer's work.
6. Call record_decision with requestId decision-live, memoryId auth-contract, taskId auth-task, decision Keep authentication in src/auth.ts, rationale A single fixture interface lets the simulated peer add focused tests, relatedFiles [src/auth.ts].
7. Call complete_task with requestId complete-live, taskId auth-task, summary ${operatorEdit ? "Reviewed operator fixture token authentication" : "Implemented fixture token authentication"}, importantFiles [src/auth.ts], decisions [Keep authentication in src/auth.ts], remainingIssues [], nextSteps [Add invalid-token and expiry tests].
8. Finish with a short summary. Do not run more tools after completion; the harness now restarts the service and verifies the handoff.
`;
}
