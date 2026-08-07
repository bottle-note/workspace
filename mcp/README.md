# mcp

Bottle Note **Admin MCP gateway**. Isolated process: no domain DB access.

```
Admin / Agent client (Claude, Codex, Cursor)
        |  Streamable HTTP  /mcp
        |  Authorization: Bearer bn_agent_*
        v
 mcp  (this directory)
        |  allowlisted HTTP only
        |  Agent Key → Admin JWT (never returned)
        v
 bottlenote-admin-api (existing APIs)
   POST /auth/agent
   GET  /alcohols
   GET  /alcohols/{id}
```

규범·페르소나 교차 검토: [`docs/PRINCIPLES.md`](./docs/PRINCIPLES.md)

## Prerequisites

- Node.js 22+
- Secrets: private `environment-variables` / k8s Secret only. Never commit keys.

## Local run

```bash
cp .env.example .env
# ADMIN_API_BASE_URL required for real calls
# BOTTLENOTE_AGENT_KEY: local smoke only (forbidden when NODE_ENV=production)
npm install
npm run dev
```

- Health: `GET /healthz`
- Ready: `GET /readyz`
- MCP: `POST /mcp` with `Authorization: Bearer bn_agent_...`

### Client snippet

```json
{
  "mcpServers": {
    "bottlenote-admin": {
      "url": "https://mcp.bottlenote.com/mcp",
      "headers": {
        "Authorization": "Bearer bn_agent_REPLACE"
      }
    }
  }
}
```

## Tools (v0.1)

| Tool | Backend |
|------|---------|
| `bottlenote_whisky_search` | `GET /alcohols` |
| `bottlenote_whisky_get` | `GET /alcohols/{id}` |

Failures return MCP `isError: true` (no stack/token leakage).

## Security (must)

1. Client credential = **Agent Key only** (JWT-shaped Bearer → 401).
2. Admin JWT stays in-process after `/auth/agent` exchange.
3. Logs redact `bn_agent_*` / JWT.
4. Outbound allowlist: method + path (see `src/policy/allowlist.ts`).
5. `BOTTLENOTE_AGENT_KEY` **rejected in production**.

## Docker (multi-arch)

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/bottle-note/mcp:0.1.0 --push .
```

## Related

- bottle-note/workspace#370
- #340 Agent Key · #341 audit (future)
