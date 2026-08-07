/**
 * Server-level instructions exposed to MCP clients (P1 + P4).
 * Keep short: agents load this every session.
 */
export const MCP_SERVER_INSTRUCTIONS = `
Bottle Note Admin MCP (read-only gateway).

Auth: send Authorization: Bearer bn_agent_*. Never send Admin JWT.
This server exchanges the key internally; tokens are never returned to you.

Tools (v0.1):
- bottlenote_whisky_search: paginated whisky search (size max 50).
- bottlenote_whisky_get: one whisky by alcoholId.

Do NOT attempt delete, bulk edit, free-form HTTP, or external web search via this server.
Prefer search then get. Use alcoholId from search results for detail.
`.trim();
