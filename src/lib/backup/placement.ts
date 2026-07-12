/**
 * Preservation placement — 3-2-1 / LOCKSS + WORM (T-36 / Digital Preservation DP-P4, DP-P5, BK-3,
 * BK-4; ADR-0009).
 *
 * PURE. A backup with all copies at one vendor is one outage (or one ransomware event, or one
 * vendor's 2051 bankruptcy) from total loss. This module is the SSOT for two preservation guarantees
 * above the existing backup pipeline:
 *
 *   evaluate321 — DP-P4/BK-3: the placement must satisfy the 3-2-1 rule plus LOCKSS diversity —
 *                 ≥3 copies, ≥2 providers (never all with one vendor — organizational diversity),
 *                 and ≥1 copy that is BOTH off-provider AND off-region, every placement respecting
 *                 the tenant's jurisdiction (residency, ADR-0009). Reports every deficiency.
 *   sealObject / verifyWorm — BK-4/DP-P5: backups are WRITE-ONCE and tamper-evident. A sealed object
 *                 cannot be overwritten (ransomware/insider resistance); a fixity mismatch means the
 *                 archive was altered/corrupted and is detectable.
 *
 * The live replication transport is the wire layer; the policy is here. No I/O; deterministic.
 */
import { digestsEqual } from './integrity';

/** A physical placement of a backup copy. copies[0] is treated as the primary (same-vendor) copy. */
export interface CopyPlacement {
  provider: string;      // storage vendor id, e.g. 'vendor-a' | 'vendor-b' | 'offline-vault'
  region: string;        // geographic region
  jurisdiction: string;  // residency jurisdiction (ADR-0009)
  offline?: boolean;     // air-gapped copy (BK-4 highest tier)
}

export interface Placement321Verdict {
  ok: boolean;
  copies: number;
  providers: number;
  /** True iff at least one copy is both off-provider and off-region relative to the primary. */
  offProviderOffRegion: boolean;
  deficiencies: string[];
}

/**
 * PURE — evaluate a placement against 3-2-1 + LOCKSS (DP-P4/BK-3). All copies must sit within the
 * tenant's jurisdiction (residency); diversity is achieved across REGION and PROVIDER, not by
 * crossing jurisdictions.
 */
export function evaluate321(copies: readonly CopyPlacement[], tenantJurisdiction: string): Placement321Verdict {
  const deficiencies: string[] = [];
  const providers = new Set(copies.map((c) => c.provider)).size;

  if (copies.length < 3) deficiencies.push(`needs ≥3 copies, has ${copies.length} (3-2-1)`);
  if (providers < 2) deficiencies.push(`needs ≥2 providers, has ${providers} (never all with one vendor)`);

  const primary = copies[0];
  const offProviderOffRegion = primary != null &&
    copies.some((c) => c !== primary && c.provider !== primary.provider && c.region !== primary.region);
  if (!offProviderOffRegion) deficiencies.push('needs ≥1 copy that is both off-provider and off-region (DP-P4)');

  const misplaced = copies.filter((c) => c.jurisdiction !== tenantJurisdiction);
  if (misplaced.length > 0) {
    deficiencies.push(`${misplaced.length} copy/copies outside the tenant jurisdiction "${tenantJurisdiction}" (residency, ADR-0009)`);
  }

  return { ok: deficiencies.length === 0, copies: copies.length, providers, offProviderOffRegion, deficiencies };
}

/** A sealed, write-once backup object (BK-4). Immutable and tamper-evident once sealed. */
export interface WormObject {
  id: string;
  /** Fixity checksum captured at seal time. */
  digest: string;
  /** Injected ISO seal time. */
  sealedAt: string;
}

export type WormWrite =
  | { ok: true; object: WormObject }
  | { ok: false; reason: string };

/**
 * PURE — seal an object write-once. If the id is already sealed, the write is REFUSED — a backup is
 * write-once, never silently replaced (ransomware/insider resistance, BK-4). Returns the sealed
 * object to record; the caller adds it to the sealed set.
 */
export function sealObject(existing: ReadonlyMap<string, WormObject>, id: string, digest: string, sealedAt: string): WormWrite {
  if (typeof id !== 'string' || id.trim().length === 0) return { ok: false, reason: 'a WORM object needs an id' };
  if (typeof digest !== 'string' || digest.trim().length === 0) return { ok: false, reason: 'a WORM object needs a fixity digest' };
  if (existing.has(id)) return { ok: false, reason: `object "${id}" is already sealed — WORM backups are write-once` };
  return { ok: true, object: { id, digest, sealedAt } };
}

/**
 * PURE — verify a sealed object against a freshly-recomputed fixity digest (DP-P5). A mismatch means
 * the archive was altered or has bit-rotted — tamper/corruption is detectable. Constant-time compare.
 */
export function verifyWorm(object: WormObject, currentDigest: string): boolean {
  return digestsEqual(object.digest, currentDigest);
}
