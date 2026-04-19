// Phone-number normalization used across SMS and WhatsApp adapters.

// Strip WhatsApp's "whatsapp:" prefix if present, collapse whitespace, and
// normalise to bare E.164 (leading "+", digits only). Returns null when the
// input can't be confidently resolved to E.164.
export function normalizePhoneE164(raw: string): string | null {
  const trimmed = raw.replace(/^whatsapp:/i, "").replace(/\s+/g, "");
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  // US 10-digit fallback — accept e.g. "(415) 555-1234" from seeded data.
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
