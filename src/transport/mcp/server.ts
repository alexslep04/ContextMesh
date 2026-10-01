import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EventProcessor } from "../../application/event-processor.js";
import { taskPayloadSchema } from "../../domain/schemas.js";

export function createMcpServer(processor = new EventProcessor()) {
  const server = new McpServer({ name: "contextmesh", version: "0.1.0" });

  server.registerTool(
    "get_project_context",
    {
      description: "Retrieve relevant ContextMesh project context.",
      inputSchema: { projectId: z.string().min(1) },
    },
    async ({ projectId }) => ({
      content: [{ type: "text", text: JSON.stringify({ projectId, state: processor.snapshot(projectId) }) }],
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
      const now = new Date().toISOString();
      const result = processor.ingest({
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
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}
