export type AppConfig = {
  port: number;
  mcpPath: string;
  logLevel: string;
  nodeEnv: string;
  adminApiBaseUrl: string;
  adminApiTimeoutMs: number;
  /** Local/dev smoke only. Forbidden in production. */
  defaultAgentKey: string | undefined;
  /** Truncate long free-text fields returned to agents. */
  maxDescriptionChars: number;
};

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const defaultAgentKey = process.env.BOTTLENOTE_AGENT_KEY;

  if (nodeEnv === "production" && defaultAgentKey) {
    throw new Error(
      "BOTTLENOTE_AGENT_KEY must not be set in production (clients must send Authorization header)",
    );
  }

  return {
    port: Number(process.env.PORT ?? "3100"),
    mcpPath: process.env.MCP_PATH ?? "/mcp",
    logLevel: process.env.LOG_LEVEL ?? "info",
    nodeEnv,
    adminApiBaseUrl: requireEnv(
      "ADMIN_API_BASE_URL",
      "http://localhost:8080/admin/api/v1",
    ).replace(/\/$/, ""),
    adminApiTimeoutMs: Number(process.env.ADMIN_API_TIMEOUT_MS ?? "15000"),
    defaultAgentKey,
    maxDescriptionChars: Number(process.env.MAX_DESCRIPTION_CHARS ?? "800"),
  };
}
