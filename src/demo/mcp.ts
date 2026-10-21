import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../transport/mcp/server.js";
import { LocalApiClient } from "../transport/http/client.js";
import { receiptGateway } from "./receipts.js";
const { CONTEXTMESH_DEMO_RECEIPTS: path, CONTEXTMESH_DEMO_PROJECT: projectId, CONTEXTMESH_DEMO_SESSION: sessionId } = process.env;
if (!path || !projectId || !sessionId) throw new Error("Demo MCP requires its isolated receipt path and session/project identity");
const server = createMcpServer(receiptGateway(new LocalApiClient(), path, projectId, sessionId));
await server.connect(new StdioServerTransport());
