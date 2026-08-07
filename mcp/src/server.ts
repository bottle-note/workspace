import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdminBackendClient, RequestContext } from "./backend/adminClient.js";
import { MCP_SERVER_INSTRUCTIONS } from "./policy/instructions.js";
import { registerWhiskyTools, RequestAuthCache } from "./tools/whisky.js";

export function createMcpServer(
  client: AdminBackendClient,
  agentKey: string,
  ctx: RequestContext = {},
): McpServer {
  const server = new McpServer(
    {
      name: "mcp",
      version: "0.1.0",
    },
    {
      instructions: MCP_SERVER_INSTRUCTIONS,
      capabilities: {
        tools: {},
      },
    },
  );

  const auth = new RequestAuthCache(client, agentKey, ctx);
  registerWhiskyTools(server, client, auth, ctx);
  return server;
}
