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
  meta?: Record<string, unknown>;
};

/** Existing Admin alcohol list item fields (subset). */
type AdminAlcoholItem = {
  alcoholId: number;
  korName?: string | null;
  engName?: string | null;
  korCategoryName?: string | null;
  engCategoryName?: string | null;
  imageUrl?: string | null;
};

type AdminAlcoholDetail = {
  alcoholId: number;
  korName?: string | null;
  engName?: string | null;
  korCategory?: string | null;
  engCategory?: string | null;
  imageUrl?: string | null;
  abv?: string | null;
  age?: string | null;
  cask?: string | null;
  volume?: string | null;
  description?: string | null;
  regionId?: number | null;
  korRegion?: string | null;
  engRegion?: string | null;
  distilleryId?: number | null;
  korDistillery?: string | null;
  engDistillery?: string | null;
  tastingTags?: Array<{ id: number; korName?: string | null; engName?: string | null }>;
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
 * Outbound client: MCP process -> existing Admin API only.
 * No dedicated /mcp/* backend endpoints.
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
    const page = params.page ?? 0;
    const size = Math.min(params.size ?? 20, 50);
    const query = new URLSearchParams();
    if (params.keyword) query.set("keyword", params.keyword);
    if (params.regionId != null) query.set("regionId", String(params.regionId));
    query.set("page", String(page));
    query.set("size", String(size));

    // Existing Admin UI contract: GET /alcohols (fromPage → data list + meta)
    const body = await this.requestJson<GlobalResponseEnvelope<AdminAlcoholItem[]>>(
      "GET",
      `/alcohols?${query.toString()}`,
      undefined,
      accessToken,
    );

    const rows = Array.isArray(body.data) ? body.data : [];
    const meta = body.meta ?? {};
    const totalElements =
      typeof meta.totalElements === "number" ? meta.totalElements : null;
    const hasNext =
      typeof meta.hasNext === "boolean" ? meta.hasNext : null;

    return {
      items: rows.map((row) => ({
        alcoholId: row.alcoholId,
        korName: row.korName ?? null,
        engName: row.engName ?? null,
        korCategory: row.korCategoryName ?? null,
        engCategory: row.engCategoryName ?? null,
        imageUrl: row.imageUrl ?? null,
      })),
      page,
      size,
      totalElements,
      hasNext,
    };
  }

  async getWhisky(accessToken: string, alcoholId: number): Promise<McpWhiskyDetail> {
    const body = await this.requestJson<GlobalResponseEnvelope<AdminAlcoholDetail>>(
      "GET",
      `/alcohols/${alcoholId}`,
      undefined,
      accessToken,
    );
    const d = body.data;
    if (!d) {
      throw new Error("Whisky detail returned empty data");
    }
    return {
      alcoholId: d.alcoholId,
      korName: d.korName ?? null,
      engName: d.engName ?? null,
      korCategory: d.korCategory ?? null,
      engCategory: d.engCategory ?? null,
      imageUrl: d.imageUrl ?? null,
      abv: d.abv ?? null,
      age: d.age ?? null,
      cask: d.cask ?? null,
      volume: d.volume ?? null,
      description: d.description ?? null,
      regionId: d.regionId ?? null,
      korRegion: d.korRegion ?? null,
      engRegion: d.engRegion ?? null,
      distilleryId: d.distilleryId ?? null,
      korDistillery: d.korDistillery ?? null,
      engDistillery: d.engDistillery ?? null,
      tastingTags: (d.tastingTags ?? []).map((t) => ({
        id: t.id,
        korName: t.korName ?? null,
        engName: t.engName ?? null,
      })),
    };
  }

  private async requestJson<T>(
    method: string,
    path: string,
    jsonBody: unknown | undefined,
    accessToken: string | undefined,
  ): Promise<T> {
    // Allowlist: agent login + existing alcohol read APIs only.
    const pathOnly = path.split("?")[0] ?? path;
    const allowed =
      pathOnly === "/auth/agent" ||
      pathOnly === "/alcohols" ||
      /^\/alcohols\/\d+$/.test(pathOnly);
    if (!allowed) {
      throw new Error(`Outbound path not allowlisted: ${pathOnly}`);
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
        path: pathOnly,
        status: response.status,
        durationMs,
      });

      if (!response.ok) {
        throw new Error(
          `Admin API ${method} ${pathOnly} failed: ${response.status} ${redactSecrets(text)}`,
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
