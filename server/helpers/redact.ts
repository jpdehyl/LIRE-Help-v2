// B12: cap log length and mask obvious header/credential fragments before logging.
// Use this on any external-API response body or error payload before passing to
// console.*. The value is SIGNAL, not forensic — full bodies should go to a
// structured log store, not stderr.

const REDACT_PATTERNS = [
  /((?:x-api-key|authorization|api[-_]?key|bearer)\s*[:=]\s*)[^,\n"]*/gi,
  /("?(?:x-api-key|authorization|api[-_]?key|bearer)"?\s*:\s*")[^"]*(")/gi,
];

export function redact(value: unknown, maxLen = 200): string {
  const raw = typeof value === "string" ? value : (() => {
    try { return JSON.stringify(value); } catch { return String(value); }
  })();
  let out = raw;
  for (const re of REDACT_PATTERNS) out = out.replace(re, (_m, p1, p2 = "") => `${p1}[redacted]${p2}`);
  return out.length > maxLen ? out.slice(0, maxLen) + "…[truncated]" : out;
}
