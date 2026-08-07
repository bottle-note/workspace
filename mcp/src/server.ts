import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdminBackendClient } from "./backend/adminClient.js";
import { registerWhiskyTools, RequestAuthCache } from "./tools/whisky.js";

export function createMcpServer(
  client: AdminBackendClient,
  agentKey: string,
): McpServer {
  const server = new McpServer({
    name: "mcp",
    version: "0.1.0",
  });

  const auth = new RequestAuthCache(client, agentKey);
  registerWhiskyTools(server, client, auth);
  return server;
}
