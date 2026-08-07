import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdminBackendClient } from "../backend/adminClient.js";
import { agentKeyFingerprint, assertAgentKeyShape } from "../auth/agentKey.js";
import { logInfo } from "../logging/redact.js";

type SessionAuth = {
  agentKey: string;
  accessToken: string;
  expiresAtMs: number;
};

/**
 * Per-request auth cache only. Multi-pod safe: no process-global agent state.
 * Access token is never returned to MCP clients.
 */
export class RequestAuthCache {
  private entry: SessionAuth | undefined;

  constructor(
    private readonly client: AdminBackendClient,
    private readonly agentKey: string,
  ) {
    assertAgentKeyShape(agentKey);
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.entry && this.entry.expiresAtMs > now + 5_000) {
      return this.entry.accessToken;
    }
    const token = await this.client.exchangeAgentKey(this.agentKey);
    this.entry = {
      agentKey: this.agentKey,
      accessToken: token.accessToken,
      // Prefer short in-process TTL; backend access is typically 24h but we re-exchange often.
      expiresAtMs: now + 10 * 60_000,
    };
    logInfo("agent_token_exchanged", { agentFp: agentKeyFingerprint(this.agentKey) });
    return this.entry.accessToken;
  }
}

export function registerWhiskyTools(
  server: McpServer,
  client: AdminBackendClient,
  auth: RequestAuthCache,
): void {
  server.registerTool(
    "bottlenote_whisky_search",
    {
      title: "Search whiskies",
      description:
        "Search Bottle Note admin whiskies with compact fields for agent context. size max 50.",
      inputSchema: {
        keyword: z.string().min(1).max(100).optional(),
        regionId: z.number().int().positive().optional(),
        page: z.number().int().min(0).default(0),
        size: z.number().int().min(1).max(50).default(20),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ keyword, regionId, page, size }) => {
      const accessToken = await auth.getAccessToken();
      const result = await client.searchWhiskies(accessToken, {
        keyword,
        regionId,
        page,
        size,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );

  server.registerTool(
    "bottlenote_whisky_get",
    {
      title: "Get whisky detail",
      description: "Fetch one whisky by alcoholId with MCP-optimized admin fields.",
      inputSchema: {
        alcoholId: z.number().int().positive(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ alcoholId }) => {
      const accessToken = await auth.getAccessToken();
      const detail = await client.getWhisky(accessToken, alcoholId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(detail),
          },
        ],
      };
    },
  );
}
