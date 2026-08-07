import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdminBackendClient, RequestContext } from "../backend/adminClient.js";
import { agentKeyFingerprint, assertAgentKeyShape } from "../auth/agentKey.js";
import { logInfo, redactSecrets } from "../logging/redact.js";

type SessionAuth = {
  accessToken: string;
  expiresAtMs: number;
};

/**
 * Per-request auth cache only. Multi-pod safe: no process-global agent state.
 * Access token is never returned to MCP clients (P2).
 */
export class RequestAuthCache {
  private entry: SessionAuth | undefined;

  constructor(
    private readonly client: AdminBackendClient,
    private readonly agentKey: string,
    private readonly ctx: RequestContext,
  ) {
    assertAgentKeyShape(agentKey);
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.entry && this.entry.expiresAtMs > now + 5_000) {
      return this.entry.accessToken;
    }
    const token = await this.client.exchangeAgentKey(this.agentKey, this.ctx);
    this.entry = {
      accessToken: token.accessToken,
      expiresAtMs: now + 10 * 60_000,
    };
    logInfo("agent_token_exchanged", {
      agentFp: agentKeyFingerprint(this.agentKey),
      correlationId: this.ctx.correlationId,
    });
    return this.entry.accessToken;
  }
}

function toolError(err: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: redactSecrets(err instanceof Error ? err.message : String(err)),
      },
    ],
  };
}

export function registerWhiskyTools(
  server: McpServer,
  client: AdminBackendClient,
  auth: RequestAuthCache,
  ctx: RequestContext,
): void {
  server.registerTool(
    "bottlenote_whisky_search",
    {
      title: "Search whiskies",
      description:
        "Search Bottle Note admin whiskies. Returns compact fields for agent context. " +
        "size default 20, max 50. Use keyword and/or regionId. Prefer this before get.",
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
      try {
        const accessToken = await auth.getAccessToken();
        const result = await client.searchWhiskies(
          accessToken,
          { keyword, regionId, page, size },
          ctx,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "bottlenote_whisky_get",
    {
      title: "Get whisky detail",
      description:
        "Fetch one whisky by alcoholId. Long description may be truncated. " +
        "Use alcoholId from bottlenote_whisky_search.",
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
      try {
        const accessToken = await auth.getAccessToken();
        const detail = await client.getWhisky(accessToken, alcoholId, ctx);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(detail) }],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
