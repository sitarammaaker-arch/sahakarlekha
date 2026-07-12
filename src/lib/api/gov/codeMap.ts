/**
 * Government external-code mapping (T-27 / API Constitution Art. VI cross-cutting; IRR-9, ADR-0008).
 *
 * PURE. At the boundary, every canonical head/enum is mapped to a STABLE EXTERNAL CODE — an
 * adapter never sends a raw internal enum to a government system, and never trusts an inbound
 * external code without mapping it back to canonical (IRR-9). The code VALUES are DATA supplied at
 * the boundary (a scheme's code list), not baked in here — this module is the mapping MECHANISM,
 * so it fabricates no statutory codes (NABARD-CAS and any unshipped scheme stay parked).
 *
 * Two invariants the mechanism guarantees:
 *   • Fail CLOSED — an unmapped code is REFUSED, never silently passed to the government (IE-4).
 *   • Point-in-time — external code schemes evolve; a changed code is a NEW effective-dated entry,
 *     never a silent redefinition, and a mapping is resolved as-of a date (VER-4/VER-6).
 *
 * No I/O; deterministic.
 */

/** One directional-neutral mapping: canonical ⇄ external within a named scheme, effective-dated.
 *  `effectiveTo` is exclusive; absent = open-ended. */
export interface CodeMapEntry {
  scheme: string;         // e.g. 'NCD', 'TRACES_SECTION', 'GSTN_HSN', 'RCS_HARYANA'
  canonical: string;      // internal canonical code/head
  external: string;       // the partner's code
  effectiveFrom: string;  // ISO date
  effectiveTo?: string;   // ISO date, exclusive
}

export type MapResult =
  | { ok: true; code: string }
  | { ok: false; reason: string };

/** Is an entry in force at `asOfMs`? */
function inForce(e: CodeMapEntry, asOfMs: number): boolean {
  const from = Date.parse(e.effectiveFrom);
  if (Number.isNaN(from) || from > asOfMs) return false;
  if (e.effectiveTo != null) {
    const to = Date.parse(e.effectiveTo);
    if (!Number.isNaN(to) && asOfMs >= to) return false;
  }
  return true;
}

/** Pick the entry in force with the LATEST effectiveFrom among those matching `pred`. */
function resolve(entries: readonly CodeMapEntry[], asOf: string, pred: (e: CodeMapEntry) => boolean): CodeMapEntry | null {
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(asOfMs)) return null;
  let best: CodeMapEntry | null = null;
  let bestFrom = -Infinity;
  for (const e of entries) {
    if (!pred(e) || !inForce(e, asOfMs)) continue;
    const from = Date.parse(e.effectiveFrom);
    if (from > bestFrom) { best = e; bestFrom = from; }
  }
  return best;
}

/**
 * PURE — map a canonical code to its external code in a scheme, as-of a date. Fail-CLOSED: an
 * unmapped canonical code is refused, so an adapter can never emit an internal enum or a guess to
 * the government (IRR-9/IE-4).
 */
export function mapToExternal(canonical: string, scheme: string, asOf: string, entries: readonly CodeMapEntry[]): MapResult {
  const hit = resolve(entries, asOf, (e) => e.scheme === scheme && e.canonical === canonical);
  return hit
    ? { ok: true, code: hit.external }
    : { ok: false, reason: `no ${scheme} external code mapped for canonical "${canonical}" as of ${asOf}` };
}

/**
 * PURE — reverse-map an inbound external code to canonical, as-of a date. Inbound codes are
 * untrusted (API-P7): an unrecognized external code is refused, never coerced into a canonical head.
 */
export function mapFromExternal(external: string, scheme: string, asOf: string, entries: readonly CodeMapEntry[]): MapResult {
  const hit = resolve(entries, asOf, (e) => e.scheme === scheme && e.external === external);
  return hit
    ? { ok: true, code: hit.canonical }
    : { ok: false, reason: `unrecognized ${scheme} external code "${external}" as of ${asOf}` };
}
