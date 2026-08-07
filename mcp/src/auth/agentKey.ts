const AGENT_KEY_PREFIX = "bn_agent_";

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

export function assertAgentKeyShape(agentKey: string): void {
  if (!agentKey.startsWith(AGENT_KEY_PREFIX) || agentKey.length < 20) {
    throw new Error("Invalid agent key format");
  }
}

export function agentKeyFingerprint(agentKey: string): string {
  // Never log raw key; last 4 chars only for support correlation.
  if (agentKey.length < 8) {
    return "****";
  }
  return `…${agentKey.slice(-4)}`;
}
