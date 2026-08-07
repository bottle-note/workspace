const AGENT_KEY_PATTERN = /bn_agent_[A-Za-z0-9_-]{20,}/g;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER_PATTERN = /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;

/** Scrub secrets before any log/error surface leaves the process. */
export function redactSecrets(input: unknown): string {
  let text: string;
  try {
    text = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    text = String(input);
  }
  return text
    .replace(AGENT_KEY_PATTERN, "bn_agent_[REDACTED]")
    .replace(JWT_PATTERN, "[JWT_REDACTED]")
    .replace(BEARER_PATTERN, "$1[REDACTED]");
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  const payload = meta ? ` ${redactSecrets(meta)}` : "";
  console.log(`[info] ${message}${payload}`);
}

export function logError(message: string, err?: unknown): void {
  const detail = err === undefined ? "" : ` ${redactSecrets(err)}`;
  console.error(`[error] ${message}${detail}`);
}
