import { describe, expect, it } from "vitest";
import { contextMeshEventSchema } from "../../src/domain/events.js";

describe("context mesh events", () => {
  it("accepts a normalized task event", () => {
    const result = contextMeshEventSchema.safeParse({
      eventId: "event-1",
      sourceEventId: "host-1",
      source: "mock",
      type: "task_started",
      projectId: "project-1",
      sessionId: "session-1",
      occurredAt: "2026-10-01T12:00:00.000Z",
      payload: { taskId: "task-1", title: "Implement auth", expectedFiles: ["src/auth.ts"] },
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown event types", () => {
    const result = contextMeshEventSchema.safeParse({
      eventId: "event-1",
      source: "mock",
      type: "tool_opened",
      projectId: "project-1",
      sessionId: "session-1",
      occurredAt: "2026-10-01T12:00:00.000Z",
      payload: {},
    });

    expect(result.success).toBe(false);
  });
});
