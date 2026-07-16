/**
 * Placement configuration (T-36 / DP-P4) — PURE.
 *
 * Turns the operator's DECLARED storage facts into the `CopyPlacement[]` that `evaluate321`
 * grades. It is deliberately dumb: it asserts nothing it was not told.
 *
 * THE HONESTY RULE. We never guess a region or a jurisdiction. The backup bytes sit in a bucket
 * somewhere, but the code cannot know WHERE — only the operator does. If a copy's physical
 * location has not been declared, the placement is NOT evaluable, and Backup Health stays
 * honestly "placement never evaluated" (amber) instead of claiming a residency we cannot prove.
 * A fabricated jurisdiction would be worse than no verdict: it would silently SUPPRESS a real
 * residency deficiency (ADR-0009) and turn the card green on a guess.
 *
 * The secondary copy is only ever included when it ACTUALLY LANDED — a configured-but-failed
 * replication is not a copy, and must not count toward 3-2-1.
 *
 * Pure and deterministic: no I/O, no env access, no clock. The caller reads env and passes it in.
 * Tested by scripts/test-backup-placement-config.mjs.
 */

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * PURE — build the placement description for one society's backup run.
 *
 * @param {object} cfg
 * @param {{provider?: string, region?: string, jurisdiction?: string}} cfg.primary
 *        Where the PRIMARY copy (the Supabase bucket) physically lives, as declared by the operator.
 * @param {{provider?: string, region?: string, jurisdiction?: string}|null} [cfg.secondary]
 *        The off-vendor copy — pass it ONLY when the replication actually succeeded; null otherwise.
 * @returns {{evaluable: boolean, copies: Array<{provider: string, region: string, jurisdiction: string}>, reasons: string[]}}
 *        `evaluable:false` ⇒ do not call evaluate321; report the placement as unevaluated.
 */
export function resolvePlacements(cfg) {
  const reasons = [];
  const p = cfg?.primary ?? {};
  const primary = {
    provider: clean(p.provider),
    region: clean(p.region),
    jurisdiction: clean(p.jurisdiction),
  };

  // The primary must be fully declared or nothing can be graded — a copy of unknown location
  // cannot be checked for residency, and "off-region" is meaningless without a reference region.
  if (!primary.provider) reasons.push('BACKUP_PRIMARY_PROVIDER is not set — the primary copy has no declared provider');
  if (!primary.region) reasons.push('BACKUP_PRIMARY_REGION is not set — the primary copy has no declared region');
  if (!primary.jurisdiction) reasons.push('BACKUP_PRIMARY_JURISDICTION is not set — the primary copy has no declared residency jurisdiction');
  if (reasons.length > 0) return { evaluable: false, copies: [], reasons };

  const copies = [primary];

  // A secondary counts ONLY if the bytes actually landed there AND its location is declared.
  const s = cfg?.secondary;
  if (s) {
    const secondary = {
      provider: clean(s.provider),
      region: clean(s.region),
      jurisdiction: clean(s.jurisdiction),
    };
    if (!secondary.provider || !secondary.region || !secondary.jurisdiction) {
      // Declared badly ⇒ the copy exists but cannot be graded. Refuse to grade the whole
      // placement rather than silently drop the copy and under-report the deficiency.
      reasons.push('the off-vendor copy landed but its provider/region/jurisdiction is not fully declared');
      return { evaluable: false, copies: [], reasons };
    }
    copies.push(secondary);
  }

  return { evaluable: true, copies, reasons };
}
