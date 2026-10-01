import Fastify, { type FastifyInstance } from "fastify";
import { EventProcessor } from "../../application/event-processor.js";
import { contextMeshEventSchema } from "../../domain/events.js";

export interface AppDependencies {
  processor?: EventProcessor;
}

export function createApp(dependencies: AppDependencies = {}): FastifyInstance {
  const processor = dependencies.processor ?? new EventProcessor();
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok", service: "contextmesh" }));

  app.get("/v1/status", async () => ({
    service: "contextmesh",
    state: processor.snapshot(),
  }));

  app.post("/v1/events", async (request, reply) => {
    const parsed = contextMeshEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_event",
        issues: parsed.error.issues,
      });
    }

    try {
      const result = processor.ingestValidated(parsed.data);
      return reply.code(result.accepted ? 202 : 200).send({
        accepted: result.accepted,
        state: result.snapshot,
      });
    } catch (error) {
      return reply.code(400).send({
        error: "invalid_event_payload",
        message: error instanceof Error ? error.message : "Invalid event payload",
      });
    }
  });

  return app;
}
