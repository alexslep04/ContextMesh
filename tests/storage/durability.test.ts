import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { EventProcessor } from "../../src/application/event-processor.js";
import { SqliteEventPersistence } from "../../src/storage/sqlite-event-persistence.js";
import { createDatabase } from "../../src/storage/client.js";
import { events, temporaryDirectory } from "../helpers.js";
describe("durable application records", () => {
  it("preserves file-backed handoffs, versions, FTS currentness, and replay identity across reopen", () => {
    const temp = temporaryDirectory(), file = join(temp.path, "state.db"), clock = events();
    let database = createDatabase(file);
    try {
      const processor = new EventProcessor(new SqliteEventPersistence(database.sqlite));
      processor.ingest(clock.event("session_started"));
      processor.ingest(clock.event("task_started", { taskId: "t", title: "Auth" }));
      processor.ingest(clock.event("decision_recorded", { memoryId: "choice", decision: "obsoleteword", rationale: "Old" }));
      processor.ingest(clock.event("decision_recorded", { memoryId: "choice", decision: "currentword", rationale: "New" }));
      const done = clock.event("task_completed", { taskId: "t", summary: "Implemented", importantFiles: ["src/auth.ts"], nextSteps: ["Add tests"] });
      processor.ingest(done); database.sqlite.close(); database = createDatabase(file);
      const restored = new EventProcessor(new SqliteEventPersistence(database.sqlite));
      expect(restored.snapshot().tasks[0]).toMatchObject({ status: "completed", summary: "Implemented", nextSteps: ["Add tests"] });
      expect(restored.snapshot().memoryVersions).toHaveLength(3);
      expect(restored.ingest(done).reason).toBe("duplicate");
      expect(database.sqlite.prepare("SELECT count(*) AS n FROM cm_memory_search WHERE cm_memory_search MATCH 'obsoleteword'").get()).toEqual({ n: 0 });
      expect(database.sqlite.prepare("SELECT count(*) AS n FROM cm_memory_search WHERE cm_memory_search MATCH 'currentword'").get()).toEqual({ n: 1 });
      expect(restored.history("p")).toHaveLength(5);
    } finally { database.sqlite.close(); temp.remove(); }
  });
  it("upgrades the existing cm schema without losing legacy sessions or tasks", () => {
    const database = createDatabase(":memory:");
    try {
      database.sqlite.exec(readFileSync("src/storage/migrations/0000_contextmesh.sql", "utf8"));
      database.sqlite.prepare("INSERT INTO cm_sessions (id, project_id, agent_type, status, last_activity_at) VALUES ('a', 'p', 'codex', 'active', '2026-10-20T10:00:00.000Z')").run();
      database.sqlite.prepare("INSERT INTO cm_tasks (id, project_id, session_id, title, status, expected_files, modified_files, updated_at) VALUES ('t', 'p', 'a', 'Legacy', 'active', '[]', '[\"auth.ts\"]', '2026-10-20T10:00:00.000Z')").run();
      const legacy = { eventId: "legacy-event", sourceEventId: "legacy-source", source: "mock" as const, type: "task_started" as const, projectId: "p", sessionId: "a", occurredAt: "2026-10-20T10:00:00.000Z", payload: { taskId: "t", title: "Legacy", expectedFiles: [] } };
      const identity = JSON.stringify(["mock", "p", "a", "legacy-source"]);
      database.sqlite.prepare("INSERT INTO cm_events (id, event_id, identity, scope, source, source_event_id, type, project_id, session_id, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(identity, legacy.eventId, identity, '["p","task","t"]', "mock", legacy.sourceEventId, legacy.type, "p", "a", JSON.stringify(legacy.payload), legacy.occurredAt);
      const restored = new EventProcessor(new SqliteEventPersistence(database.sqlite));
      expect(restored.ingest(legacy).reason).toBe("duplicate");
      expect(restored.snapshot().sessions[0].agentType).toBe("codex");
      expect(restored.snapshot().tasks[0]).toMatchObject({ title: "Legacy", reportedFiles: ["auth.ts"], modifiedFiles: [] });
      expect(database.sqlite.prepare("SELECT count(*) AS n FROM cm_schema_migrations").get()).toEqual({ n: 2 });
      new SqliteEventPersistence(database.sqlite);
      expect(database.sqlite.prepare("SELECT count(*) AS n FROM cm_tasks").get()).toEqual({ n: 1 });
    } finally { database.sqlite.close(); }
  });
  it("rolls back both event and projection writes on a database failure", () => {
    const database = createDatabase(":memory:"), clock = events();
    try {
      const processor = new EventProcessor(new SqliteEventPersistence(database.sqlite)); processor.ingest(clock.event("session_started"));
      database.sqlite.exec("CREATE TRIGGER simulate_disk_failure BEFORE INSERT ON cm_memory_versions BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END");
      expect(() => processor.ingest(clock.event("decision_recorded", { memoryId: "x", decision: "Choice", rationale: "Reason" }))).toThrow("simulated write failure");
      expect(database.sqlite.prepare("SELECT count(*) AS n FROM cm_events").get()).toEqual({ n: 1 });
      expect(processor.snapshot().memoryVersions).toEqual([]);
    } finally { database.sqlite.close(); }
  });
});
