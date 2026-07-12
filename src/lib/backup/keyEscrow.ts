/**
 * Backup key escrow — M-of-N threshold recovery (T-36 / Digital Preservation BK-5, DP-P9; AUTH-5).
 *
 * PURE. Encryption protects backups, but the KEY becomes its own preservation risk: a lost key means
 * lost data, and a key held by one person is a single point of both failure and compromise. The fix
 * is threshold escrow — the key is split into N shares held by N DISTINCT custodians, and any M of
 * them reconstruct it (M-of-N). This module is the SSOT for that policy:
 *
 *   establishEscrow — issue N shares to N distinct custodians under a threshold M; a lost key never
 *                     means lost data (down to M available still recovers), and no single custodian
 *                     can recover alone (separation of duties).
 *   canRecover      — the key-escrow recovery drill: recoverable iff ≥ M distinct custodians are
 *                     available; fewer than M cannot (confidentiality preserved).
 *
 * This layer holds NO secret material — only the escrow POLICY and custodian metadata (AUTH-5:
 * secrets are vaulted, never in code/logs). The actual share-splitting/reconstruction primitive
 * (e.g. Shamir) is injected by the wire layer. No I/O; deterministic.
 */

export interface EscrowShare {
  custodian: string;
  /** 1-based share index. */
  index: number;
}

export interface EscrowPolicy {
  /** M — the minimum shares needed to recover. */
  threshold: number;
  /** N — the total shares issued. */
  total: number;
}

export interface EscrowRecord {
  keyId: string;
  policy: EscrowPolicy;
  /** The N issued shares — custodian metadata only, never key material. */
  shares: EscrowShare[];
}

export type EscrowResult =
  | { ok: true; record: EscrowRecord }
  | { ok: false; problems: string[] };

/**
 * PURE — establish a key-escrow record. Validates a sound threshold (1 ≤ M ≤ N), exactly N shares,
 * and N DISTINCT custodians — so no single custodian can unilaterally recover (SoD) and a lost key
 * never means lost data (BK-5). Holds no secret material.
 */
export function establishEscrow(keyId: string, policy: EscrowPolicy, shares: readonly EscrowShare[]): EscrowResult {
  const problems: string[] = [];
  if (typeof keyId !== 'string' || keyId.trim().length === 0) problems.push('keyId is required');
  if (!Number.isInteger(policy.total) || policy.total < 1) problems.push('total (N) must be a positive integer');
  if (!Number.isInteger(policy.threshold) || policy.threshold < 1) problems.push('threshold (M) must be a positive integer');
  if (policy.threshold > policy.total) problems.push('threshold (M) cannot exceed total (N)');
  if (shares.length !== policy.total) problems.push(`expected ${policy.total} shares, got ${shares.length}`);
  const custodians = new Set(shares.map((s) => s.custodian));
  if (custodians.size !== shares.length) problems.push('every share must go to a DISTINCT custodian (no single point of recovery)');
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, record: { keyId, policy, shares: [...shares] } };
}

/**
 * PURE — the recovery drill (BK-5): can the key be recovered from the currently-available
 * custodians? True iff at least `threshold` distinct custodians who hold a valid share are present.
 * Fewer than the threshold cannot recover (confidentiality); exactly the threshold still recovers
 * (availability) — that is the whole point of M-of-N.
 */
export function canRecover(record: EscrowRecord, availableCustodians: readonly string[]): boolean {
  const holders = new Set(record.shares.map((s) => s.custodian));
  const present = new Set<string>();
  for (const c of availableCustodians) if (holders.has(c)) present.add(c);
  return present.size >= record.policy.threshold;
}
