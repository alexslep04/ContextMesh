import { describe, expect, it } from "vitest";
import { EventProcessor } from "../../src/application/event-processor.js";
import { createApp } from "../../src/transport/http/server.js";

describe("HTTP transport", () => {
  it("validates and ingests normalized events", async () => {
    const app = createApp({ processor: new EventProcessor() });
    const response = await app.inject({
      method: "POST",
      url: "/v1/events",
      payload: {
        eventId: "event-1",
        source: "mock",
        type: "session_started",
        projectId: "project-1",
        sessionId: "session-1",
        occurredAt: "2026-10-01T12:00:00.000Z",
        payload: {},
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().accepted).toBe(true);
    await app.close();
  });

  it("rejects invalid events without mutating state", async () => {
    const app = createApp();
    const response = await app.inject({ method: "POST", url: "/v1/events", payload: { type: "invalid" } });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_event");
    await app.close();
  });

  it("returns a client error for invalid event payloads", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/events",
      payload: {
        eventId: "event-1",
        sourceEventId: "host-1",
        source: "mock",
        type: "task_started",
        projectId: "project-1",
        sessionId: "session-1",
        occurredAt: "2026-10-01T12:00:00.000Z",
        payload: { taskId: "task-1" },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_event_payload");
    await app.close();
  });
});
