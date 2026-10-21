import { describe, it, expect } from "vitest";
import { EventProcessor } from "../../src/application/event-processor.js";
import { emptySnapshot } from "../../src/domain/state.js";
import { events } from "../helpers.js";
function setup() { const processor = new EventProcessor(); const clock = events(); processor.ingest(clock.event("session_started")); return { processor, ...clock }; }
describe("coordination boundaries", () => {
  it("rejects missing sessions, invalid payloads, wrong owners, and completed-task edits without state changes", () => {
    const { processor, event } = setup();
    expect(() => processor.ingest(event("task_started", { taskId: "t", title: "Work" }, "missing"))).toThrow("Register");
    expect(() => processor.ingest(event("task_started", { taskId: "t" }))).toThrow();
    processor.ingest(event("task_started", { taskId: "t", title: "Work" }));
    processor.ingest(event("session_started", {}, "b"));
    expect(() => processor.ingest(event("task_updated", { taskId: "t", title: "Hijack" }, "b"))).toThrow("another session");
    processor.ingest(event("task_completed", { taskId: "t", summary: "Done", nextSteps: ["Add tests"] }));
    const before = processor.snapshot();
    expect(() => processor.ingest(event("task_updated", { taskId: "t", title: "Reopen" }))).toThrow("finished");
    expect(processor.snapshot()).toEqual(before);
    expect(processor.memories("p")[0].data?.nextSteps).toEqual(["Add tests"]);
  });
  it("preserves immutable decision versions and distinguishes retries from conflicting identities", () => {
    const { processor, event } = setup();
    const first = event("decision_recorded", { memoryId: "auth", decision: "Use tokens", rationale: "Local API", relatedFiles: ["src/auth.ts"] });
    processor.ingest(first);
    expect(processor.ingest({ ...first, eventId: "another" }).reason).toBe("duplicate");
    expect(() => processor.ingest({ ...first, payload: { ...first.payload, decision: "Changed retry" } })).toThrow("identity");
    const old = processor.memories("p")[0];
    processor.ingest(event("decision_recorded", { memoryId: "auth", decision: "Use short-lived tokens", rationale: "Reduce exposure" }));
    expect(processor.memories("p")[0]).toMatchObject({ version: 2, supersedesVersionId: old.id });
    expect(processor.snapshot().memoryVersions[0]).toEqual(old);
  });
  it("keeps reports unverified and clears active warnings when a session ends without completing its task", () => {
    const { processor, event } = setup();
    processor.ingest(event("session_started", {}, "b"));
    processor.ingest(event("task_started", { taskId: "a-task", title: "A", expectedFiles: ["src\\auth.ts"] }));
    processor.ingest(event("task_started", { taskId: "b-task", title: "B", expectedFiles: ["src/auth.ts"] }, "b"));
    processor.ingest(event("file_modified", { taskId: "a-task", path: "src/auth.ts" }));
    processor.ingest(event("file_modified", { taskId: "b-task", path: "src/auth.ts" }, "b"));
    expect(processor.snapshot().warnings.map(w => w.kind)).toEqual(["expected_overlap"]);
    expect(processor.snapshot().tasks[0].modifiedFiles).toEqual([]);
    processor.ingest(event("session_ended", {}, "b"));
    expect(processor.snapshot().warnings).toEqual([]);
    expect(processor.snapshot().tasks[1].status).toBe("active");
    expect(() => processor.ingest(event("task_updated", { taskId: "b-task", title: "Continue" }, "b"))).toThrow("new session");
  });
  it("handles multiple blockers and saves a durable resolution", () => {
    const { processor, event } = setup();
    processor.ingest(event("task_started", { taskId: "t", title: "Work" }));
    for (const id of ["one", "two"]) processor.ingest(event("blocker_recorded", { blockerId: id, taskId: "t", description: "Waiting on " + id }));
    expect(() => processor.ingest(event("task_completed", { taskId: "t", summary: "Done" }))).toThrow("Resolve");
    processor.ingest(event("blocker_resolved", { blockerId: "one", resolution: "Interface ready" }));
    expect(processor.snapshot().tasks[0].status).toBe("blocked");
    processor.ingest(event("blocker_resolved", { blockerId: "two", resolution: "Dependency ready" }));
    expect(processor.snapshot().tasks[0].status).toBe("active");
    expect(processor.memories("p").filter(m => m.kind === "blocker_resolution")).toHaveLength(2);
  });
  it("rolls back application state and history when persistence throws", () => {
    const clock = events(); let fail = false;
    const processor = new EventProcessor({ load: () => ({ snapshot: emptySnapshot(), events: [], eventIdentities: [], latestEventAt: {} }), persist: () => { if (fail) throw new Error("disk full"); return true; }, saveEvidence() {} });
    processor.ingest(clock.event("session_started")); const before = processor.snapshot(); fail = true;
    const report = clock.event("task_started", { taskId: "t", title: "Work" });
    expect(() => processor.ingest(report)).toThrow("disk full");
    expect(processor.snapshot()).toEqual(before);
    expect(processor.history("p")).toHaveLength(1);
    fail = false; expect(processor.ingest(report).accepted).toBe(true);
  });
  it("rejects delayed task and session events behind blocker/activity projections", () => {
    const { processor, event } = setup();
    processor.ingest(event("task_started", { taskId: "t", title: "Work" }));
    const delayedUpdate = event("task_updated", { taskId: "t", title: "Old scope" });
    const delayedEnd = event("session_ended");
    processor.ingest(event("blocker_recorded", { blockerId: "b", taskId: "t", description: "Waiting" }));
    processor.ingest(event("blocker_resolved", { blockerId: "b", resolution: "Ready" }));
    expect(processor.ingest(delayedUpdate).reason).toBe("stale");
    expect(processor.ingest(delayedEnd).reason).toBe("stale");
    expect(processor.snapshot().tasks[0]).toMatchObject({ title: "Work", status: "active" });
    expect(processor.snapshot().sessions[0].status).toBe("active");
  });
});
