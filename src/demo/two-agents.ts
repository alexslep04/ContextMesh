import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LocalApiClient } from "../transport/http/client.js";
import type { ProcessorSnapshot } from "../domain/state.js";
import type { ContextMeshEvent } from "../domain/events.js";
import type { ProjectContext } from "../application/context.js";
import { codexLauncherSource, resolveCodexLaunch } from "../adapters/codex/launch.js";
import { codexExecArguments, codexMcpConfiguration, powershellQuote, writeCodexScripts } from "../adapters/codex/connection.js";
import { availablePort, launchService, nodeArguments, sourceRoot, waitFor } from "./processes.js";
import { twoAgentPrompt } from "./two-agent-prompts.js";
import { readReceipts } from "./receipts.js";
import { peerTools, simulatePair } from "./simulated-pair.js";
import { seedSnakeFixture, snakeImplementation, writeSnakeBrowser } from "./snake-fixture.js";
import { startDemoAgent } from "./live-agent.js";
import { writePresentation } from "./presentation.js";
import { verifyFixture } from "./verify-fixture.js";

const execute = promisify(execFile);
export interface TwoAgentDemoOptions { live: boolean; operatorEdit?: boolean; launchAgents?: boolean; timeoutMs?: number; baseDirectory?: string; log?: (message: string) => void }
export interface TwoAgentDemoReport {
  mode: "two-live-codex" | "two-simulated-mcp-peers"; operatorEdit: boolean;
  projectId: string; directory: string; repositoryPath: string; checks: string[];
  sessionIds: string[]; fixtureTestsPassed: boolean; fixture: "snake"; elapsedSeconds: number;
}
export async function runTwoAgentDemo(options: TwoAgentDemoOptions): Promise<TwoAgentDemoReport> {
  if (options.operatorEdit && !options.live) throw new Error("Operator-edit mode requires live agents");
  if (options.launchAgents && !options.live) throw new Error("Launching agents requires live mode");
  const started = Date.now();
  const log = options.log ?? (() => {}), codex = options.live ? resolveCodexLaunch() : undefined;
  const base = resolve(options.baseDirectory ?? ".contextmesh/demos"); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, "pair-")), repositoryPath = join(directory, "repository"), projectId = "pair-" + directory.split(/[\\/]/).at(-1);
  seedSnakeFixture(repositoryPath);
  const git = (...args: string[]) => execute("git", ["-C", repositoryPath, ...args], { windowsHide: true, timeout: 5000 });
  await git("init"); await git("add", "."); await git("-c", "user.name=ContextMesh Demo", "-c", "user.email=demo@example.invalid", "commit", "-m", "Two-session fixture baseline");
  const port = await availablePort(), url = "http://127.0.0.1:" + port, api = new LocalApiClient(url);
  const receiptPath = (id: string) => join(directory, id + "-receipts.jsonl");
  const envFor = (id: string) => ({ CONTEXTMESH_HOST: "127.0.0.1", CONTEXTMESH_PORT: String(port), CONTEXTMESH_DEMO_RECEIPTS: receiptPath(id), CONTEXTMESH_DEMO_PROJECT: projectId, CONTEXTMESH_DEMO_SESSION: id });
  const controller = new AbortController(), interrupt = () => controller.abort(new Error("Demo interrupted"));
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  let service: Awaited<ReturnType<typeof launchService>> | undefined;
  const clients: Client[] = [], checks: string[] = [];
  const agents: ReturnType<typeof startDemoAgent>[] = [];
  let simulation: Promise<void> | undefined, simulationFailure: unknown;
  const pass = (message: string) => { checks.push(message); log("PASS: " + message); };
  const status = async () => (await api.read("status", { projectId }) as { state: ProcessorSnapshot }).state;
  let editedA = false, editedB = false;
  let overlapExplanation: string | undefined;
  const sample = async () => {
    const state = await status();
    overlapExplanation ??= state.warnings.find(w => w.kind === "expected_overlap")?.message;
    const failure = state.blockers.find(b => b.status === "open" && b.id !== "waiting-for-snake");
    if (failure) {
      controller.abort(new Error("Session " + failure.sessionId + " reported a blocker: " + failure.description));
      controller.signal.throwIfAborted();
    }
    if (options.operatorEdit && !editedA && state.tasks.some(t => t.id === "snake-task")) {
      writeFileSync(join(repositoryPath, "snake.js"), snakeImplementation); editedA = true;
      log("OPERATOR EDIT: harness wrote snake.js; this is not attributed to Codex A.");
      await api.refresh({ projectId, sessionId: "codex-a" });
    }
    if (options.operatorEdit && !editedB && state.blockers.some(b => b.id === "waiting-for-snake" && b.status === "resolved")) {
      writeSnakeBrowser(repositoryPath); editedB = true;
      log("OPERATOR EDIT: harness wrote index.html, app.js and tests/snake.test.mjs; not attributed to Codex B.");
      await api.refresh({ projectId, sessionId: "codex-b" });
    }
    return state;
  };
  const wait = <T>(label: string, check: (state: ProcessorSnapshot) => T | undefined) => waitFor(async () => {
    if (simulationFailure) { controller.abort(simulationFailure); controller.signal.throwIfAborted(); }
    return check(await sample());
  }, label, options.timeoutMs ?? 300000, controller.signal);
  const connect = async (id: string) => {
    const client = new Client({ name: "contextmesh-" + id, version: "1" }); clients.push(client);
    const env = Object.fromEntries(Object.entries({ ...process.env, ...envFor(id) }).filter((e): e is [string, string] => typeof e[1] === "string"));
    await client.connect(new StdioClientTransport({ command: process.execPath, args: nodeArguments("demo/mcp"), cwd: sourceRoot, env, stderr: "inherit" }));
    return client;
  };
  try {
    service = await launchService(directory, port);
    log("Artifacts: " + directory + "\nService: " + url + "\nProject: " + projectId);
    log(options.live ? "TWO LIVE CODEX SESSIONS: both peers report through independent MCP bridges." : "SIMULATED PAIR: deterministic peers; actual independent MCP/HTTP/Git/SQLite processes.");
    if (codex) {
      writeFileSync(join(directory, "codex-cli.mjs"), codexLauncherSource(codex));
      writeFileSync(join(directory, "check-login.ps1"), "& " + powershellQuote(process.execPath) + " " + powershellQuote(join(directory, "codex-cli.mjs")) + " login status\nexit $LASTEXITCODE\n");
      log("Login check: & " + powershellQuote(join(directory, "check-login.ps1")));
      for (const role of ["a", "b"] as const) {
        const prompt = twoAgentPrompt(role, projectId, repositoryPath, Boolean(options.operatorEdit));
        const configuration = codexMcpConfiguration(url, "demo/mcp", envFor("codex-" + role));
        const scripts = writeCodexScripts(directory, "start-agent-" + role, codex, codexExecArguments(repositoryPath, configuration, prompt, options.operatorEdit));
        writeFileSync(join(directory, "prompt-" + role + ".md"), prompt);
        log("Terminal " + (role === "a" ? "2 (Codex A)" : "3 (Codex B)") + ":\n" + scripts.command);
      }
      writeFileSync(join(directory, "connection.json"), JSON.stringify({ url, projectId, repositoryPath, codex, sessionIds: ["codex-a", "codex-b"] }, null, 2));
      if (options.launchAgents) {
        for (const role of ["a", "b"] as const) {
          const prompt = twoAgentPrompt(role, projectId, repositoryPath, Boolean(options.operatorEdit));
          const configuration = codexMcpConfiguration(url, "demo/mcp", envFor("codex-" + role));
          agents.push(startDemoAgent(codex, codexExecArguments(repositoryPath, configuration, prompt, options.operatorEdit), repositoryPath, controller, role, log));
        }
        log("Both Codex sessions launched. Only coordination checkpoints are displayed; conversations are not recorded.");
      }
    } else {
      const a = await connect("codex-a"), b = await connect("codex-b");
      simulation = simulatePair(a, b, projectId, repositoryPath, controller.signal).catch(error => { simulationFailure = error; controller.abort(error); });
    }
    await wait("A's task, Git evidence and readiness checkpoint", state => {
      const ready = state.memoryVersions.some(m => m.memoryId === "snake-ready");
      const changed = state.evidence.some(e => e.files.some(f => f.path === "snake.js"));
      return ready && changed ? true : undefined;
    });
    pass("Session A reported its task and Git verified a real fixture change");
    await wait("B to receive active work and overlap warning", () => {
      const receipts = readReceipts(receiptPath("codex-b"));
      const task = receipts.findIndex(r => r.operation === "task_started" && r.warningIds?.length);
      const sawActiveWork = receipts.slice(0, task).some(r => r.operation === "context" && r.items?.some(i => i.kind === "active_task" && i.id === "snake-task") && r.items.some(i => i.kind === "git_evidence"));
      return task >= 0 && sawActiveWork && receipts.some(r => r.operation === "context" && r.items?.some(i => i.kind === "warning")) ? true : undefined;
    });
    const overlap = (await api.read("history", { projectId, limit: 500 }) as ContextMeshEvent[]).find(e => e.sessionId === "codex-b" && e.type === "progress_checkpoint" && String(e.payload.content).startsWith("Overlap acknowledged"));
    log("OVERLAP: " + (overlapExplanation ?? (overlap ? overlap.payload.content : "Both sessions initially expect to edit snake.js; receipt verified.")));
    pass("Session B retrieved A's active context and received the real overlap warning");
    await wait("B's narrowed task and dependency blocker", state => state.tasks.some(t => t.id === "browser-task" && t.expectedFiles.length === 3 && ["index.html", "app.js", "tests/snake.test.mjs"].every(p => t.expectedFiles.includes(p))) && state.blockers.some(b => b.id === "waiting-for-snake") ? true : undefined);
    assert.equal((await status()).warnings.length, 0);
    pass("B narrowed its scope; overlap cleared and its dependency blocker was recorded");
    await wait("B to retrieve A's decision and handoff", state => {
      const received = readReceipts(receiptPath("codex-b")).some(r => r.operation === "context" && r.items?.some(i => i.kind === "handoff" && i.taskId === "snake-task" && i.sessionId === "codex-a") && r.items.some(i => i.kind === "decision" && i.sessionId === "codex-a"));
      return received && state.memoryVersions.some(m => m.memoryId === "handoff-consumed-b") && state.blockers.some(b => b.id === "waiting-for-snake" && b.status === "resolved") ? true : undefined;
    });
    const decision = (await status()).memoryVersions.find(m => m.kind === "decision");
    if (decision) log("SHARED DECISION: " + decision.content + " | Why: " + decision.rationale);
    pass("B retrieved A's decision and completion handoff, then resolved its blocker");
    const completed = await wait("both task completions and session endings", state => state.tasks.length === 2 && state.tasks.every(t => t.status === "completed") && state.sessions.length === 2 && state.sessions.every(s => s.status === "ended") ? state : undefined);
    assert(completed.sessions.every(s => s.agentType === (options.live ? "codex" : "mock")));
    assert(completed.evidence.some(e => e.files.some(f => f.path === "tests/snake.test.mjs")));
    const testOutput = await verifyFixture(repositoryPath);
    writeFileSync(join(directory, "fixture-test-results.txt"), testOutput);
    pass("Both tasks completed and sessions ended; the harness independently passed the fixture tests");
    await simulation;
    if (agents.length) await waitFor(async () => agents.every(agent => agent.finished) ? true : undefined, "Codex processes to exit", options.timeoutMs ?? 300000, controller.signal);
    controller.signal.throwIfAborted();
    const history = await api.read("history", { projectId, limit: 500 }) as ContextMeshEvent[];
    const registration = history.find(e => e.type === "session_started" && e.sessionId === "codex-a"); assert(registration);
    await service.stop(); service = await launchService(directory, port);
    const verifier = peerTools(await connect("restart-verifier"), projectId, "restart-verifier");
    const recovered = await verifier<ProjectContext>("get_project_context", { budget: 24000 });
    assert(recovered.items.some(i => i.kind === "handoff" && i.sessionId === "codex-a"));
    assert(recovered.items.some(i => i.kind === "handoff" && i.sessionId === "codex-b"));
    assert(recovered.items.some(i => i.kind === "decision"));
    pass("A new MCP connection retrieved both handoffs and the decision after a real service restart");
    const before = (await status()).acceptedEventCount;
    assert.equal((await api.ingest(registration)).reason, "duplicate");
    assert.equal((await status()).acceptedEventCount, before);
    pass("Replaying a session registration created no duplicate state or memory");
    const cli = await execute(process.execPath, [...nodeArguments("cli/index"), "status", "--project", projectId, "--json"], { cwd: sourceRoot, env: service.env, windowsHide: true, timeout: 10000 });
    assert.equal(JSON.parse(cli.stdout).state.acceptedEventCount, before);
    const doctor = await api.read("doctor"); assert.equal((doctor as { ok: boolean }).ok, true);
    pass("CLI and service agree on healthy, persistent project state");
    const result: TwoAgentDemoReport = { mode: options.live ? "two-live-codex" : "two-simulated-mcp-peers", operatorEdit: Boolean(options.operatorEdit), projectId, directory, repositoryPath, sessionIds: ["codex-a", "codex-b"], fixtureTestsPassed: true, fixture: "snake", elapsedSeconds: Math.round((Date.now() - started) / 1000), checks };
    writeFileSync(join(directory, "report.json"), JSON.stringify(result, null, 2));
    writePresentation(result, recovered);
    log("Demo passed. Artifacts retained in " + directory); return result;
  } catch (error) {
    writeFileSync(join(directory, "failure.json"), JSON.stringify({ checks, message: error instanceof Error ? error.message : "Demo failed" }, null, 2)); throw error;
  } finally {
    controller.abort(); await simulation;
    await Promise.allSettled(agents.map(agent => agent.stop()));
    await Promise.allSettled(clients.map(client => client.close()));
    await service?.stop(); process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt);
  }
}
