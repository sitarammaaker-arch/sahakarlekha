/**
 * Jurisdiction — the SINGLE source of truth for a society's residency / compliance scope
 * (T-01 / ADR-0009, Canonical CL-5, gap IRR-4).
 *
 * PURE. A society's jurisdiction is resolved from its `state`. Every financial row must
 * carry (society_id, jurisdiction); `stampTenant` is the ONE seam both keys are applied
 * through, so a new write path cannot forget one — the anti-IRR-4 device (you cannot
 * re-place or residency-scope, years later, data that was written without the key).
 *
 * The canonical jurisdiction CODE is owned here and nowhere else — not in SQL, not inline in
 * a caller. State spellings that mean the same place (a 2-letter code, an English name, a
 * Devanagari name) collapse to one code, so 'HR', 'Haryana' and 'हरियाणा' are ONE
 * jurisdiction, never three (RULE 8: UTF-8 throughout).
 */

/** State spellings that map to a canonical code. Extend as states are onboarded. */
const JURISDICTION_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  hr: 'hr',
  haryana: 'hr',
  'हरियाणा': 'hr',
});

/**
 * PURE — the canonical jurisdiction code for a society's `state`.
 *
 * Returns the empty string (never null/undefined) when the state is unknown, so a
 * jurisdiction is always a defined key. A known alias collapses to its code; anything else
 * normalizes to a trimmed, lower-cased slug — still a stable key, just not yet aliased.
 */
export function resolveJurisdiction(state?: string | null): string {
  const s = (state ?? '').trim().toLowerCase();
  if (!s) return '';
  return JURISDICTION_ALIASES[s] ?? s;
}

/** The two keys every financial row carries (Canonical CL-5). */
export interface TenantScope {
  societyId: string;
  jurisdiction: string;
}

/**
 * PURE — stamp (society_id, jurisdiction) onto a row.
 *
 * The SINGLE place both tenancy keys are applied, so no write path can persist a financial
 * row missing either (IRR-4). Returns a NEW object; never mutates the input. The scope
 * values WIN over anything the row already carried — a row's tenancy is set by the writer's
 * context, not by whatever the row happened to hold.
 */
export function stampTenant<T extends Record<string, unknown>>(
  row: T,
  scope: TenantScope,
): T & { society_id: string; jurisdiction: string } {
  return { ...row, society_id: scope.societyId, jurisdiction: scope.jurisdiction };
}
