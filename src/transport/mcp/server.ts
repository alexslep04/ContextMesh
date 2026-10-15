import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EventProcessor } from "../../application/event-processor.js";
import { taskPayloadSchema } from "../../domain/schemas.js";
import { loadConfig } from "../../config.js";
import { createDatabase } from "../../storage/client.js";
import { SqliteEventPersistence } from "../../storage/sqlite-event-persistence.js";

export function createMcpServer(
  processor = new EventProcessor(),
  processorFactory: () => EventProcessor = () => processor,
) {
  const server = new McpServer({ name: "contextmesh", version: "0.1.0" });

  server.registerTool(
    "get_project_context",
    {
      description: "Retrieve relevant ContextMesh project context.",
      inputSchema: { projectId: z.string().min(1) },
    },
    async ({ projectId }) => ({
      content: [{ type: "text", text: JSON.stringify({ projectId, state: processorFactory().snapshot(projectId) }) }],
    }),
  );

  server.registerTool(
    "report_task",
    {
      description: "Report a task to ContextMesh.",
      inputSchema: {
        projectId: z.string().min(1),
        sessionId: z.string().min(1),
        ...taskPayloadSchema.shape,
      },
    },
    async ({ projectId, sessionId, taskId, title, expectedFiles }) => {
      const currentProcessor = processorFactory();
      const now = new Date().toISOString();
      const result = currentProcessor.ingest({
        eventId: `mcp-task-${sessionId}-${taskId}`,
        sourceEventId: `mcp-task-${sessionId}-${taskId}`,
        source: "mcp",
        type: "task_started",
        projectId,
        sessionId,
        occurredAt: now,
        payload: { taskId, title, expectedFiles },
      });
      return { content: [{ type: "text", text: JSON.stringify(result.snapshot) }] };
    },
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const config = loadConfig();
  const database = createDatabase(config.databasePath);
  const createProcessor = () => new EventProcessor(new SqliteEventPersistence(database.sqlite));
  const server = createMcpServer(createProcessor(), createProcessor);
  await server.connect(new StdioServerTransport());
}
