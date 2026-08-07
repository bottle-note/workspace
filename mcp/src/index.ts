import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { AdminBackendClient } from "./backend/adminClient.js";
import { createMcpServer } from "./server.js";
import {
  agentKeyFingerprint,
  extractAgentKey,
  rejectionMessage,
  validateAgentKey,
} from "./auth/agentKey.js";
import { MCP_HTTP_METHODS } from "./policy/allowlist.js";
import { logError, logInfo, redactSecrets } from "./logging/redact.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new AdminBackendClient(config);
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", service: "mcp" });
  });

  // Process is ready to accept traffic (no sticky session / no warm Admin dependency).
  app.get("/readyz", (_req, res) => {
    res.status(200).json({ status: "ready", service: "mcp", nodeEnv: config.nodeEnv });
  });

  /**
   * Stateless Streamable HTTP (P1):
   * - no sticky session across pods
   * - Agent Key only (P2); Admin JWT never returned
   */
  app.all(config.mcpPath, async (req, res) => {
    const correlationId = (req.header("x-correlation-id") ?? randomUUID()).toString();
    res.setHeader("x-correlation-id", correlationId);

    if (!MCP_HTTP_METHODS.has(req.method.toUpperCase())) {
      res.status(405).json({
        error: "method_not_allowed",
        message: `Method ${req.method} not allowed on MCP endpoint`,
        correlationId,
      });
      return;
    }

    const rawKey = extractAgentKey(
      req.header("authorization") ?? undefined,
      config.defaultAgentKey,
    );
    const validated = validateAgentKey(rawKey);
    if (!validated.ok) {
      res.status(401).json({
        error: "unauthorized",
        message: rejectionMessage(validated.reason),
        correlationId,
      });
      return;
    }
    const agentKey = validated.key;

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServer(client, agentKey, { correlationId });

    try {
      await server.connect(transport);
      logInfo("mcp_request", {
        correlationId,
        method: req.method,
        path: config.mcpPath,
        agentFp: agentKeyFingerprint(agentKey),
      });
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logError("mcp_request_failed", { correlationId, err: redactSecrets(err) });
      if (!res.headersSent) {
        res.status(500).json({
          error: "internal_error",
          message: "MCP request failed",
          correlationId,
        });
      }
    } finally {
      try {
        await transport.close();
      } catch {
        // ignore
      }
      try {
        await server.close();
      } catch {
        // ignore
      }
    }
  });

  const server = app.listen(config.port, () => {
    logInfo("mcp listening", {
      port: config.port,
      mcpPath: config.mcpPath,
      // host only — no secrets
      adminApiBaseUrl: config.adminApiBaseUrl,
      nodeEnv: config.nodeEnv,
    });
  });

  const shutdown = (signal: string) => {
    logInfo("shutdown", { signal });
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logError("fatal", err);
  process.exit(1);
});
