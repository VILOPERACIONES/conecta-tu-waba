// Canonical WhatsApp id normalization.
//
// The source of truth is Meta's `messages[0].from`, which arrives already
// canonical (e.g. "5219993670065" for a Mexican mobile). n8n / Chatwoot /
// admin flows may pass shorter or "+"-prefixed variants of the same number,
// which used to create duplicate conversations. Normalize everywhere.
//
// Rules (MX-first heuristic; safe no-op for other countries):
//   - strip everything that is not a digit
//   - length 10                          → prepend "521"  (MX mobile no CC)
//   - length 11 & starts with "1"        → keep (US/CA)
//   - length 12 & starts with "52"       → insert "1" after "52" (MX mobile)
//   - otherwise                          → return as-is
export function normalizeWaId(value: string | null | undefined): string {
  if (value == null) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `521${digits}`;
  if (digits.length === 12 && digits.startsWith("52") && !digits.startsWith("521")) {
    return `521${digits.slice(2)}`;
  }
  return digits;
}
