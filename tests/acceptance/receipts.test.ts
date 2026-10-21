import { it, expect } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { receiptGateway, readReceipts } from "../../src/demo/receipts.js";
import { LocalApiClient } from "../../src/transport/http/client.js";
import { createRuntime } from "../../src/runtime.js";
import { events, temporaryDirectory } from "../helpers.js";

it("records operation/provenance metadata while rejecting another session and excluding content", async () => {
  const temp = temporaryDirectory(), clock = events();
  const runtime = createRuntime({ host: "127.0.0.1", port: 0, databasePath: join(temp.path, "state.db"), logLevel: "silent", timeoutMs: 5000 });
  const api = new LocalApiClient(await runtime.app.listen({ host: "127.0.0.1", port: 0 }));
  const path = join(temp.path, "receipts.jsonl"), gateway = receiptGateway(api, path, "p", "a");
  try {
    await gateway.ingest(clock.event("session_started"));
    await gateway.ingest(clock.event("decision_recorded", { memoryId: "d", decision: "DO-NOT-RETAIN-CONTENT", rationale: "DO-NOT-RETAIN-RATIONALE" }));
    await gateway.read("context", { projectId: "p", sessionId: "a" });
    expect(readReceipts(path).at(-1)?.items?.[0]).toMatchObject({ kind: "decision", sessionId: "a" });
    const serialized = readFileSync(path, "utf8");
    expect(serialized).not.toContain("DO-NOT-RETAIN");
    const count = runtime.service.processor.snapshot().acceptedEventCount;
    await expect(gateway.ingest(clock.event("session_started", {}, "b"))).rejects.toThrow("identity");
    await expect(gateway.read("context", { projectId: "other" })).rejects.toThrow("identity");
    await expect(gateway.refresh({ projectId: "p", sessionId: "b" })).rejects.toThrow("identity");
    expect(runtime.service.processor.snapshot().acceptedEventCount).toBe(count);
  } finally { await runtime.app.close(); temp.remove(); }
});
