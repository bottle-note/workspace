import type { AppConfig } from "../config.js";
import { assertAgentKeyShape } from "../auth/agentKey.js";
import { logError, logInfo, redactSecrets } from "../logging/redact.js";

export type TokenItem = {
  accessToken: string;
  refreshToken?: string;
};

type GlobalResponseEnvelope<T> = {
  success?: boolean;
  data?: T;
  errors?: unknown;
  meta?: unknown;
};

export type McpWhiskySummary = {
  alcoholId: number;
  korName: string | null;
  engName: string | null;
  korCategory: string | null;
  engCategory: string | null;
  imageUrl: string | null;
};

export type McpWhiskyDetail = McpWhiskySummary & {
  abv: string | null;
  age: string | null;
  cask: string | null;
  volume: string | null;
  description: string | null;
  regionId: number | null;
  korRegion: string | null;
  engRegion: string | null;
  distilleryId: number | null;
  korDistillery: string | null;
  engDistillery: string | null;
  tastingTags: Array<{ id: number; korName: string | null; engName: string | null }>;
};

export type McpWhiskySearchResult = {
  items: McpWhiskySummary[];
  page: number;
  size: number;
  totalElements: number | null;
  hasNext: boolean | null;
};

/**
 * Outbound client: MCP process -> Admin backend only.
 * Allowlist is enforced by calling fixed path builders (no free-form URL proxy).
 */
export class AdminBackendClient {
  constructor(private readonly config: AppConfig) {}

  async exchangeAgentKey(agentKey: string): Promise<TokenItem> {
    assertAgentKeyShape(agentKey);
    const body = await this.requestJson<GlobalResponseEnvelope<TokenItem>>(
      "POST",
      "/auth/agent",
      { agentKey },
      undefined,
    );
    const token = body.data;
    if (!token?.accessToken) {
      throw new Error("Agent login response missing accessToken");
    }
    return token;
  }

  async searchWhiskies(
    accessToken: string,
    params: { keyword?: string; page?: number; size?: number; regionId?: number },
  ): Promise<McpWhiskySearchResult> {
    const query = new URLSearchParams();
    if (params.keyword) query.set("keyword", params.keyword);
    if (params.regionId != null) query.set("regionId", String(params.regionId));
    query.set("page", String(params.page ?? 0));
    query.set("size", String(Math.min(params.size ?? 20, 50)));

    const body = await this.requestJson<GlobalResponseEnvelope<McpWhiskySearchResult>>(
      "GET",
      `/mcp/whiskies?${query.toString()}`,
      undefined,
      accessToken,
    );
    if (!body.data) {
      throw new Error("MCP whisky search returned empty data");
    }
    return body.data;
  }

  async getWhisky(accessToken: string, alcoholId: number): Promise<McpWhiskyDetail> {
    const body = await this.requestJson<GlobalResponseEnvelope<McpWhiskyDetail>>(
      "GET",
      `/mcp/whiskies/${alcoholId}`,
      undefined,
      accessToken,
    );
    if (!body.data) {
      throw new Error("MCP whisky detail returned empty data");
    }
    return body.data;
  }

  private async requestJson<T>(
    method: string,
    path: string,
    jsonBody: unknown | undefined,
    accessToken: string | undefined,
  ): Promise<T> {
    // Path must stay under fixed allowlist prefixes.
    if (!path.startsWith("/auth/agent") && !path.startsWith("/mcp/")) {
      throw new Error(`Outbound path not allowlisted: ${path}`);
    }

    const url = `${this.config.adminApiBaseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.adminApiTimeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (jsonBody !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const started = Date.now();
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
        signal: controller.signal,
      });
      const text = await response.text();
      const durationMs = Date.now() - started;
      logInfo("admin_backend_call", {
        method,
        path: path.split("?")[0],
        status: response.status,
        durationMs,
      });

      if (!response.ok) {
        throw new Error(
          `Admin API ${method} ${path.split("?")[0]} failed: ${response.status} ${redactSecrets(text)}`,
        );
      }
      if (!text) {
        return {} as T;
      }
      return JSON.parse(text) as T;
    } catch (err) {
      logError("admin_backend_call_failed", err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
