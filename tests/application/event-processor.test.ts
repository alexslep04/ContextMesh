import { describe, expect, it } from "vitest";
import { EventProcessor } from "../../src/application/event-processor.js";

const event = (type: "session_started" | "task_started", sessionId: string, payload: Record<string, unknown>, sourceEventId = `${type}-${sessionId}`, projectId = "project-1", occurredAt = "2026-10-01T12:00:00.000Z") => ({
  eventId: `${sourceEventId}-event`,
  sourceEventId,
  source: "mock" as const,
  type,
  projectId,
  sessionId,
  occurredAt,
  payload,
});

describe("EventProcessor", () => {
  it("tracks sessions and warns about expected file overlap", () => {
    const processor = new EventProcessor();
    processor.ingest(event("session_started", "session-a", {}));
    processor.ingest(event("session_started", "session-b", {}));
    processor.ingest(event("task_started", "session-a", {
      taskId: "task-a",
      title: "Authentication",
      expectedFiles: ["src/auth.ts"],
    }));
    const result = processor.ingest(event("task_started", "session-b", {
      taskId: "task-b",
      title: "Password reset",
      expectedFiles: ["src/auth.ts"],
    }));

    expect(result.snapshot.tasks).toHaveLength(2);
    expect(result.snapshot.warnings).toEqual([
      expect.objectContaining({
        kind: "expected_overlap",
        files: ["src/auth.ts"],
        taskIds: ["task-a", "task-b"],
      }),
    ]);
  });

  it("ignores replayed source events", () => {
    const processor = new EventProcessor();
    const started = event("session_started", "session-a", {}, "same-event");

    expect(processor.ingest(started).accepted).toBe(true);
    expect(processor.ingest({ ...started, eventId: "different-event" }).accepted).toBe(false);
    expect(processor.snapshot().sessions).toHaveLength(1);
  });

  it("scopes source-event deduplication to the project", () => {
    const processor = new EventProcessor();
    const first = event("session_started", "session-a", {}, "same-event", "project-a");
    const second = event("session_started", "session-b", {}, "same-event", "project-b");

    expect(processor.ingest(first).accepted).toBe(true);
    expect(processor.ingest(second).accepted).toBe(true);
    expect(processor.snapshot().sessions).toHaveLength(2);
  });

  it("keeps same task IDs isolated between projects", () => {
    const processor = new EventProcessor();
    const payload = { taskId: "shared-task-id", title: "Shared title", expectedFiles: [] };

    processor.ingest(event("task_started", "session-a", payload, "event-a", "project-a"));
    processor.ingest(event("task_started", "session-b", payload, "event-b", "project-b"));

    expect(processor.snapshot().tasks).toHaveLength(2);
  });

  it("does not let an older event regress a completed task", () => {
    const processor = new EventProcessor();
    processor.ingest(event("task_started", "session-a", {
      taskId: "task-a",
      title: "Authentication",
      expectedFiles: [],
    }));
    processor.ingest({
      ...event("task_started", "session-a", {
        taskId: "task-a",
        title: "Authentication",
        expectedFiles: [],
      }, "completion-event", "project-1", "2026-10-01T13:00:00.000Z"),
      type: "task_completed",
      payload: { taskId: "task-a" },
    });

    const delayed = processor.ingest(event("task_started", "session-a", {
      taskId: "task-a",
      title: "Old task replay",
      expectedFiles: [],
    }, "delayed-event", "project-1", "2026-10-01T12:30:00.000Z"));

    expect(delayed.accepted).toBe(false);
    expect(processor.snapshot().tasks[0]).toEqual(expect.objectContaining({ status: "completed" }));
  });
});
