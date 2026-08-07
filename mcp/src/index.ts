import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { AdminBackendClient } from "./backend/adminClient.js";
import { createMcpServer } from "./server.js";
import {
  agentKeyFingerprint,
  extractAgentKey,
} from "./auth/agentKey.js";
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

  app.get("/readyz", (_req, res) => {
    res.status(200).json({ status: "ready", service: "mcp" });
  });

  /**
   * Stateless Streamable HTTP:
   * - no sticky session requirement across pods
   * - Agent Key from Authorization: Bearer bn_agent_*
   * - Admin JWT never returned to client
   */
  app.all(config.mcpPath, async (req, res) => {
    const correlationId = (req.header("x-correlation-id") ?? randomUUID()).toString();
    res.setHeader("x-correlation-id", correlationId);

    const agentKey = extractAgentKey(
      req.header("authorization") ?? undefined,
      config.defaultAgentKey,
    );
    if (!agentKey) {
      res.status(401).json({
        error: "unauthorized",
        message: "Missing Agent Key (Authorization: Bearer bn_agent_*)",
        correlationId,
      });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    const server = createMcpServer(client, agentKey);

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
        // ignore close races
      }
      try {
        await server.close();
      } catch {
        // ignore close races
      }
    }
  });

  app.listen(config.port, () => {
    logInfo("mcp listening", {
      port: config.port,
      mcpPath: config.mcpPath,
      adminApiBaseUrl: config.adminApiBaseUrl,
    });
  });
}

main().catch((err) => {
  logError("fatal", err);
  process.exit(1);
});
