/**
 * Audit year helpers — the Audit Register and the Audit Certificate must agree on ONE
 * year format: the society's financial-year string ("2026-27"). The register used to
 * default to the calendar year ("2026"), so objections saved with the default never
 * matched the certificate's FY filter and silently vanished from it.
 *
 * PURE — no React, no Supabase.
 */

const FY_RE = /^(\d{4})-(\d{2})$/;

/** "2026-27" style FY string? (legacy calendar-year rows like "2026" are NOT.) */
export function isFyString(s: string | null | undefined): boolean {
  const m = FY_RE.exec((s || '').trim());
  if (!m) return false;
  const start = parseInt(m[1], 10);
  return String((start + 1) % 100).padStart(2, '0') === m[2];
}

/** Shift an FY string by n years: shiftFy("2026-27", -1) → "2025-26". '' for a non-FY input. */
export function shiftFy(fy: string, n: number): string {
  if (!isFyString(fy)) return '';
  const start = parseInt(fy.slice(0, 4), 10) + n;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * Options for the audit-year picker: the current FY and the five before it (audits run
 * behind the books), plus any value already used on existing rows that is not in that
 * window — including legacy "YYYY" rows, so editing such a row shows its real value and
 * the user can move it to the correct FY. Newest first; legacy non-FY values last.
 */
export function auditYearOptions(currentFy: string, existing: ReadonlyArray<string | null | undefined> = []): string[] {
  const window: string[] = [];
  if (isFyString(currentFy)) for (let i = 0; i <= 5; i++) window.push(shiftFy(currentFy, -i));
  const extra = Array.from(new Set(existing.map(v => (v || '').trim()).filter(v => v && !window.includes(v))));
  const extraFy = extra.filter(isFyString).sort().reverse();
  const legacy = extra.filter(v => !isFyString(v)).sort().reverse();
  return [...new Set([...window, ...extraFy].sort().reverse()), ...legacy];
}
