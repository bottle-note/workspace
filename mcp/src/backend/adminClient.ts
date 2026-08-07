import type { AppConfig } from "../config.js";
import { assertAgentKeyShape } from "../auth/agentKey.js";
import { assertOutboundAllowed } from "../policy/allowlist.js";
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

export type RequestContext = {
  correlationId?: string;
};

/**
 * Outbound client: MCP → existing Admin API only (P5 isolation).
 */
export class AdminBackendClient {
  constructor(private readonly config: AppConfig) {}

  async exchangeAgentKey(
    agentKey: string,
    ctx: RequestContext = {},
  ): Promise<TokenItem> {
    assertAgentKeyShape(agentKey);
    const body = await this.requestJson<GlobalResponseEnvelope<TokenItem>>(
      "POST",
      "/auth/agent",
      { agentKey },
      undefined,
      ctx,
    );
    const token = body.data;
    if (!token?.accessToken) {
      throw new Error("Agent login response missing accessToken");
    }
    // Never surface refreshToken to tool layer.
    return { accessToken: token.accessToken };
  }

  async searchWhiskies(
    accessToken: string,
    params: { keyword?: string; page?: number; size?: number; regionId?: number },
    ctx: RequestContext = {},
  ): Promise<McpWhiskySearchResult> {
    const page = params.page ?? 0;
    const size = Math.min(params.size ?? 20, 50);
    const query = new URLSearchParams();
    if (params.keyword) query.set("keyword", params.keyword);
    if (params.regionId != null) query.set("regionId", String(params.regionId));
    query.set("page", String(page));
    query.set("size", String(size));

    const body = await this.requestJson<GlobalResponseEnvelope<AdminAlcoholItem[]>>(
      "GET",
      `/alcohols?${query.toString()}`,
      undefined,
      accessToken,
      ctx,
    );

    const rows = Array.isArray(body.data) ? body.data : [];
    const meta = body.meta ?? {};
    const totalElements =
      typeof meta.totalElements === "number" ? meta.totalElements : null;
    const hasNext = typeof meta.hasNext === "boolean" ? meta.hasNext : null;

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

  async getWhisky(
    accessToken: string,
    alcoholId: number,
    ctx: RequestContext = {},
  ): Promise<McpWhiskyDetail> {
    const body = await this.requestJson<GlobalResponseEnvelope<AdminAlcoholDetail>>(
      "GET",
      `/alcohols/${alcoholId}`,
      undefined,
      accessToken,
      ctx,
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
      description: truncate(d.description ?? null, this.config.maxDescriptionChars),
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
    ctx: RequestContext,
  ): Promise<T> {
    const pathOnly = assertOutboundAllowed(method, path);
    const url = `${this.config.adminApiBaseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.adminApiTimeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (ctx.correlationId) {
      headers["x-correlation-id"] = ctx.correlationId;
    }
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
        correlationId: ctx.correlationId,
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

function truncate(value: string | null, max: number): string | null {
  if (value == null) return null;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}
