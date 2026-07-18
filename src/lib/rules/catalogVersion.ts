/**
 * Catalog versioning — the change-audit trail ADR-0008 names `catalog_versions`, and the
 * CAIOS blueprint's Slice 2 finish line ("turn a code deploy into a data change").
 *
 * WHAT THIS IS, AND IS NOT. The rules ENGINE (engine.ts) is pure and reads an in-memory
 * catalog; today the catalogs (TDS_RULES, UCAS_RULES) ship in the bundle. This module does
 * NOT change that — runtime resolution still reads the bundle, so a wrong DB row can never
 * make the assistant state a wrong tax figure. It is the ADDITIVE first half of the
 * repo's proven additive-then-flip pattern (T-09 ledger cutover, T-20 appropriation):
 * first record every catalog version as auditable data, prove it, and only LATER (a
 * separate, parity-gated slice) let the engine read from it.
 *
 * WHAT IT BUYS NOW. A catalog is data with a version. `catalog_versions` records which
 * version was in force — its content hash, how many rules, how many are `verified: true`
 * (a named human owns the figure, tax.ts) vs unverified, and a per-key effective summary.
 * That is the auditability that is the whole point of "policy is data": an auditor can
 * tie a recorded figure to the exact catalog version that produced it, and see the moment
 * a rate changed. The full rule VALUES stay in git (the bundle); the table records the
 * version metadata + hash, so the two cannot silently disagree.
 *
 * PURE. No I/O. The caller (a migration seed today, a service-role writer later) persists
 * the returned row. The hash is a deterministic change-detector, NOT a security digest.
 */

import type { RuleCatalog, RuleValue } from './engine';

export interface CatalogVersion {
  catalogName: string;
  /** Deterministic over the catalog's content — changes iff any rule value changes. */
  contentHash: string;
  /** Number of keys (rules) in the catalog. */
  ruleCount: number;
  /** Total RuleValues across all rules and jurisdictions. */
  valueCount: number;
  /** RuleValues carrying `verified: true` (a named human owns the figure — tax.ts). */
  verifiedCount: number;
  /** RuleValues carrying `verified: false` (seeded but not human-confirmed). */
  unverifiedCount: number;
  /**
   * Per-key audit summary — jurisdictions covered, earliest effective date, highest
   * version, and whether every value under the key is verified. Enough to reconstruct
   * "what was in force" without duplicating the whole catalog into the row.
   */
  effectiveSummary: Record<string, KeySummary>;
}

export interface KeySummary {
  jurisdictions: string[];
  earliestEffectiveFrom: string | null;
  maxVersion: number;
  values: number;
  allVerified: boolean;
}

/** A RuleValue may (tax) or may not (UCAS) carry `verified`. Read it defensively. */
const isVerified = (v: RuleValue): boolean | undefined =>
  (v as { verified?: boolean }).verified;

/**
 * Canonical JSON: object keys sorted recursively, so the string is identical regardless
 * of the source's key order or environment. Arrays keep their order (a rule's value
 * series is ordered by meaning). This is what the hash runs over.
 */
function canonical(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  const obj = x as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
}

/**
 * FNV-1a, 64-bit, as 16 hex chars. Deterministic and dependency-free — it runs identically
 * in the browser, the Deno seam and a node test. This is CHANGE DETECTION, not security:
 * we need "did the catalog change?", not collision resistance against an adversary.
 */
function fnv1a64(s: string): string {
  // 64-bit FNV-1a in BigInt so it is exact across engines.
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/** PURE — snapshot a catalog into an auditable version row. */
export function buildCatalogVersion(catalogName: string, catalog: RuleCatalog): CatalogVersion {
  const keys = Object.keys(catalog).sort();
  let valueCount = 0;
  let verifiedCount = 0;
  let unverifiedCount = 0;
  const effectiveSummary: Record<string, KeySummary> = {};

  for (const key of keys) {
    const rule = catalog[key];
    const jurisdictions = Object.keys(rule.byJurisdiction).sort();
    let earliest: string | null = null;
    let maxVersion = 0;
    let values = 0;
    let allVerified = true;
    for (const j of jurisdictions) {
      for (const v of rule.byJurisdiction[j]) {
        values++;
        valueCount++;
        const ver = isVerified(v);
        if (ver === true) verifiedCount++;
        else if (ver === false) unverifiedCount++;
        // A value with no `verified` field (UCAS policy defaults) counts as neither, but
        // it still breaks `allVerified` only if it is explicitly false — undefined is not
        // a tax figure claiming to be checked.
        if (ver === false) allVerified = false;
        if (v.effectiveFrom && (earliest === null || v.effectiveFrom < earliest)) earliest = v.effectiveFrom;
        if (typeof v.version === 'number' && v.version > maxVersion) maxVersion = v.version;
      }
    }
    effectiveSummary[key] = { jurisdictions, earliestEffectiveFrom: earliest, maxVersion, values, allVerified };
  }

  return {
    catalogName,
    contentHash: fnv1a64(canonical(catalog)),
    ruleCount: keys.length,
    valueCount,
    verifiedCount,
    unverifiedCount,
    effectiveSummary,
  };
}
