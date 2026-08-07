const AGENT_KEY_PREFIX = "bn_agent_";
const JWT_LIKE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

export type AgentKeyRejection =
  | "missing"
  | "jwt_not_allowed"
  | "invalid_format";

export function extractAgentKey(
  authorizationHeader: string | undefined,
  fallback?: string,
): string | undefined {
  if (authorizationHeader) {
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return fallback;
}

/**
 * Validate client credential for this gateway.
 * - Reject JWT-shaped tokens (token passthrough / wrong audience).
 * - Accept only bn_agent_* shape.
 */
export function validateAgentKey(
  agentKey: string | undefined,
): { ok: true; key: string } | { ok: false; reason: AgentKeyRejection } {
  if (!agentKey) {
    return { ok: false, reason: "missing" };
  }
  if (JWT_LIKE.test(agentKey)) {
    return { ok: false, reason: "jwt_not_allowed" };
  }
  if (!agentKey.startsWith(AGENT_KEY_PREFIX) || agentKey.length < 20) {
    return { ok: false, reason: "invalid_format" };
  }
  return { ok: true, key: agentKey };
}

export function assertAgentKeyShape(agentKey: string): void {
  const result = validateAgentKey(agentKey);
  if (!result.ok) {
    throw new Error(`Invalid agent key: ${result.reason}`);
  }
}

export function agentKeyFingerprint(agentKey: string): string {
  // Never log raw key; last 4 chars only for support correlation.
  if (agentKey.length < 8) {
    return "****";
  }
  return `…${agentKey.slice(-4)}`;
}

export function rejectionMessage(reason: AgentKeyRejection): string {
  switch (reason) {
    case "missing":
      return "Missing Agent Key (Authorization: Bearer bn_agent_*)";
    case "jwt_not_allowed":
      return "Admin/user JWT is not accepted. Use Agent Key (bn_agent_*) only.";
    case "invalid_format":
      return "Invalid Agent Key format. Expected bn_agent_*";
  }
}
