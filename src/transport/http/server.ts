import Fastify, { type FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { z } from "zod";
import { EventProcessor } from "../../application/event-processor.js";
import { ContextMeshService, readResources } from "../../application/service.js";
import { contextMeshEventSchema } from "../../domain/events.js";
import { projectQuerySchema } from "../../domain/schemas.js";
import { ApplicationError } from "../../domain/errors.js";
export interface AppDependencies { processor?: EventProcessor; service?: ContextMeshService; logger?: Logger }
export function createApp(dependencies: AppDependencies = {}) {
  const service = dependencies.service ?? new ContextMeshService(dependencies.processor ?? new EventProcessor());
  const app = Fastify(dependencies.logger ? { loggerInstance: dependencies.logger } : { logger: false });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: request.method === "POST" && request.url === "/v1/events" ? "invalid_event_payload" : "invalid_input", message: "Input validation failed", issues: error.issues });
    if (error instanceof ApplicationError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) return reply.code(statusCode).send({ error: "invalid_request", message: "Request could not be parsed" });
    app.log.error({ err: error }, "Application request failed");
    return reply.code(500).send({ error: "internal_error", message: "ContextMesh could not complete this operation" });
  });
  app.get("/health", async () => ({ status: "ok", service: "contextmesh" }));
  for (const resource of readResources) app.get("/v1/" + resource, async request => {
    const query = { ...(request.query as Record<string, unknown>) };
    if (typeof query.files === "string") query.files = [query.files];
    return service.read(resource, query);
  });
  app.get("/v1/memories/export", async request => {
    const { projectId } = projectQuerySchema.parse(request.query);
    return { schemaVersion: 1, projectId, versions: service.processor.snapshot(projectId).memoryVersions };
  });
  app.get("/v1/memories/:id", async request => {
    const { projectId } = projectQuerySchema.parse(request.query);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return service.memoryHistory(projectId, id);
  });
  for (const [method, action] of [["PATCH", "revise"], ["DELETE", "delete"]] as const) app.route({ method, url: "/v1/memories/:id", handler: async request => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return service.modifyMemory(action, id, request.body);
  } });
  app.post("/v1/repository/refresh", request => service.refresh(request.body));
  app.post("/v1/events", async (request, reply) => {
    const parsed = contextMeshEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_event", message: "Invalid event envelope", issues: parsed.error.issues });
    const result = service.processor.ingestValidated(parsed.data);
    app.log.info({ eventId: parsed.data.eventId, type: parsed.data.type, projectId: parsed.data.projectId, sessionId: parsed.data.sessionId, accepted: result.accepted, reason: result.reason }, "Event processed");
    return reply.code(result.accepted ? 202 : 200).send({ ...result, state: result.snapshot });
  });
  return app;
}
