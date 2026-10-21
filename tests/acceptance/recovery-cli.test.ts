import { it, expect } from "vitest";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRuntime } from "../../src/runtime.js";
import { nodeArguments } from "../../src/demo/processes.js";
import { events, temporaryDirectory } from "../helpers.js";

it("uses CLI memory history/revision/search/deletion and recovers an interrupted session", async () => {
  const temp = temporaryDirectory(), clock = events();
  const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
  const endpoint = new URL(await runtime.app.listen({ host: "127.0.0.1", port: 0 }));
  const cli = async (...args: string[]) => JSON.parse((await promisify(execFile)(process.execPath, [...nodeArguments("cli/index"), ...args], { cwd: temp.path, env: { ...process.env, CONTEXTMESH_HOST: "127.0.0.1", CONTEXTMESH_PORT: endpoint.port }, windowsHide: true, timeout: 10000 })).stdout);
  try {
    runtime.service.processor.ingest(clock.event("session_started"));
    runtime.service.processor.ingest(clock.event("task_started", { taskId: "t", title: "Unfinished task", expectedFiles: ["auth.ts"] }));
    runtime.service.processor.ingest(clock.event("decision_recorded", { memoryId: "d", decision: "Original", rationale: "Original reason" }));
    const original = await cli("memory", "show", "d", "--project", "p");
    await cli("memory", "revise", "d", "--project", "p", "--session", "a", "--expected-version", original.current.id, "--reason", "Clarify", "--content", "findableword");
    expect(await cli("memories", "--project", "p", "--query", "findableword", "--json")).toHaveLength(1);
    const revised = await cli("memory", "show", "d", "--project", "p");
    await cli("memory", "delete", "d", "--project", "p", "--session", "a", "--expected-version", revised.current.id, "--reason", "Obsolete");
    expect(await cli("memories", "--project", "p", "--json")).toEqual([]);
    const end = await cli("end-session", "--project", "p", "--session", "a", "--reason", "Terminal was closed", "--request-id", "recover-a"); expect(end.accepted).toBe(true);
    const retry = await cli("end-session", "--project", "p", "--session", "a", "--reason", "Terminal was closed", "--request-id", "recover-a"); expect(retry.reason).toBe("duplicate");
    expect(runtime.service.processor.snapshot("p").sessions[0].status).toBe("ended");
    expect(runtime.service.processor.snapshot("p").tasks[0].status).toBe("active");
  } finally { await runtime.app.close(); temp.remove(); }
}, 20000);
