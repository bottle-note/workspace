# mcp

Bottle Note **Admin MCP gateway**. Isolated process: no domain DB access.

```
Admin / Agent client (Claude, Codex, Cursor)
        |  Streamable HTTP  /mcp
        |  Authorization: Bearer bn_agent_*
        v
 mcp  (this directory)
        |  internal HTTP only (allowlisted paths)
        |  Agent Key -> Admin JWT exchange (JWT never returned to client)
        v
 bottlenote-admin-api  (existing APIs only)
   POST /admin/api/v1/auth/agent
   GET  /admin/api/v1/alcohols
   GET  /admin/api/v1/alcohols/{id}
```


## Prerequisites

- Node.js 22+
- Private env/config lives in `bottle-note/environment-variables` (not vendored here). Do not commit keys.

## Local run

```bash
cp .env.example .env
# set ADMIN_API_BASE_URL; optional BOTTLENOTE_AGENT_KEY for local smoke only
npm install
npm run dev
```

- Health: `GET http://localhost:3100/healthz`
- MCP: `POST http://localhost:3100/mcp` with `Authorization: Bearer bn_agent_...`

### Client snippet (Claude / Codex)

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

| Tool | Backend (existing Admin API) |
|------|---------|
| `bottlenote_whisky_search` | `GET /admin/api/v1/alcohols` |
| `bottlenote_whisky_get` | `GET /admin/api/v1/alcohols/{id}` |

No dedicated backend `/mcp/*` endpoints. MCP maps/reduces fields for agents.
Never exposed: delete, bulk, free-form proxy, token minting tools.


## Docker (multi-arch)

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/bottle-note/mcp:0.1.0 \
  --push .
```

Local:

```bash
docker build -t mcp:local .
docker run --rm -p 3100:3100 \
  -e ADMIN_API_BASE_URL=http://host.docker.internal:8080/admin/api/v1 \
  mcp:local
```

## Security

1. Clients send **Agent Key only** (never Admin JWT).
2. Gateway exchanges key via `POST /admin/api/v1/auth/agent` and keeps JWT in memory for the request.
3. Logs redact `bn_agent_*` and JWTs.
4. Outbound paths allowlisted (`/auth/agent`, `/alcohols`, `/alcohols/{id}` only).

## Related

- bottle-note/workspace#370
- Agent Key exchange: #340
- Audit actor model: #341
