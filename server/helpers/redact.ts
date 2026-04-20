// B12: cap log length and mask obvious header/credential fragments before logging.
// Use this on any external-API response body or error payload before passing to
// console.*. The value is SIGNAL, not forensic — full bodies should go to a
// structured log store, not stderr.

const HEADER_COLON_RE = /((?:x-api-key|authorization|api[-_]?key)\s*[:=]\s*)[^\s,\n"]+/gi;
const JSON_QUOTED_RE = /("?(?:x-api-key|authorization|api[-_]?key)"?\s*:\s*")[^"]*(")/gi;
const BEARER_RE = /\b(bearer\s+)[^\s,\n"]+/gi;

export function redact(value: unknown, maxLen = 200): string {
  const raw = typeof value === "string" ? value : (() => {
    if (value instanceof Error) return String(value);
    try { return JSON.stringify(value); } catch { return String(value); }
  })();

  let out = raw;
  out = out.replace(HEADER_COLON_RE, (_match, prefix: string) => `${prefix}[redacted]`);
  out = out.replace(JSON_QUOTED_RE, (_match, prefix: string, suffix: string) => `${prefix}[redacted]${suffix}`);
  out = out.replace(BEARER_RE, (_match, prefix: string) => `${prefix}[redacted]`);

  return out.length > maxLen ? out.slice(0, maxLen) + "…[truncated]" : out;
}
