import { describe, expect, it } from "vitest";
import { EventProcessor } from "../../src/application/event-processor.js";
import { createDatabase } from "../../src/storage/client.js";
import { SqliteEventPersistence } from "../../src/storage/sqlite-event-persistence.js";

const sessionStarted = {
  eventId: "event-1",
  sourceEventId: "host-1",
  source: "mock" as const,
  type: "session_started" as const,
  projectId: "project-1",
  sessionId: "session-1",
  occurredAt: "2026-10-01T12:00:00.000Z",
  payload: {},
};

describe("SqliteEventPersistence", () => {
  it("restores accepted events and projections after processor recreation", () => {
    const database = createDatabase(":memory:");
    const first = new EventProcessor(new SqliteEventPersistence(database.sqlite));

    expect(first.ingest(sessionStarted).accepted).toBe(true);

    const second = new EventProcessor(new SqliteEventPersistence(database.sqlite));
    expect(second.ingest(sessionStarted).accepted).toBe(false);
    expect(second.snapshot().sessions).toEqual([
      expect.objectContaining({ id: "session-1", status: "active" }),
    ]);

    database.sqlite.close();
  });

  it("restores per-task ordering watermarks", () => {
    const database = createDatabase(":memory:");
    const first = new EventProcessor(new SqliteEventPersistence(database.sqlite));

    first.ingest(sessionStarted);
    first.ingest({
      ...sessionStarted,
      eventId: "task-started",
      sourceEventId: "task-started",
      type: "task_started",
      payload: { taskId: "task-1", title: "Authentication", expectedFiles: [] },
    });
    first.ingest({
      ...sessionStarted,
      eventId: "task-completed",
      sourceEventId: "task-completed",
      type: "task_completed",
      occurredAt: "2026-10-01T13:00:00.000Z",
      payload: { taskId: "task-1", summary: "Authentication implemented" },
    });

    const second = new EventProcessor(new SqliteEventPersistence(database.sqlite));
    const delayed = second.ingest({
      ...sessionStarted,
      eventId: "delayed-start",
      sourceEventId: "delayed-start",
      type: "task_started",
      occurredAt: "2026-10-01T12:30:00.000Z",
      payload: { taskId: "task-1", title: "Old replay", expectedFiles: [] },
    });

    expect(delayed.accepted).toBe(false);
    expect(second.snapshot().tasks[0]).toEqual(expect.objectContaining({ status: "completed" }));
    database.sqlite.close();
  });
});
