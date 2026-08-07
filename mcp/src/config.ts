export type AppConfig = {
  port: number;
  mcpPath: string;
  logLevel: string;
  adminApiBaseUrl: string;
  adminApiTimeoutMs: number;
  defaultAgentKey: string | undefined;
};

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? "3100"),
    mcpPath: process.env.MCP_PATH ?? "/mcp",
    logLevel: process.env.LOG_LEVEL ?? "info",
    adminApiBaseUrl: requireEnv(
      "ADMIN_API_BASE_URL",
      "http://localhost:8080/admin/api/v1",
    ).replace(/\/$/, ""),
    adminApiTimeoutMs: Number(process.env.ADMIN_API_TIMEOUT_MS ?? "15000"),
    defaultAgentKey: process.env.BOTTLENOTE_AGENT_KEY,
  };
}
