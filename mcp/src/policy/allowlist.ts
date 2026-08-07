/** Allowed Admin API surface for this MCP gateway (isolation boundary). */
export type AllowedOutbound = {
  method: "GET" | "POST";
  pathPattern: RegExp;
  description: string;
};

export const OUTBOUND_ALLOWLIST: AllowedOutbound[] = [
  {
    method: "POST",
    pathPattern: /^\/auth\/agent$/,
    description: "Agent Key → Admin JWT exchange",
  },
  {
    method: "GET",
    pathPattern: /^\/alcohols$/,
    description: "Whisky search/list",
  },
  {
    method: "GET",
    pathPattern: /^\/alcohols\/\d+$/,
    description: "Whisky detail",
  },
];

export function assertOutboundAllowed(method: string, pathWithQuery: string): string {
  const pathOnly = pathWithQuery.split("?")[0] ?? pathWithQuery;
  const upper = method.toUpperCase();
  const ok = OUTBOUND_ALLOWLIST.some(
    (rule) => rule.method === upper && rule.pathPattern.test(pathOnly),
  );
  if (!ok) {
    throw new Error(`Outbound not allowlisted: ${upper} ${pathOnly}`);
  }
  return pathOnly;
}

/** MCP transport methods we accept on /mcp (Streamable HTTP). */
export const MCP_HTTP_METHODS = new Set(["GET", "POST", "DELETE"]);
