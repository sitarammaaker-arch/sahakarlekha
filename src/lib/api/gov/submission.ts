/**
 * Government statutory-submission lifecycle (T-27 / API Constitution Art. VI, API-P8; RULE 6, API-P9).
 *
 * PURE. The governing rule for every government adapter: SahakarLekha PREPARES a statutory return
 * (a projection of the ledger), but the return is FILED under explicit HUMAN authority — never
 * autonomously (API-P8, RULE 6). This module is the SSOT for that lifecycle:
 *
 *   prepared  — a versioned projection is assembled; nothing has left the building.
 *   authorized— a HUMAN authorized officer, INDEPENDENT of the preparer (SoD), signs it off.
 *   filed     — the return is submitted, IDEMPOTENTLY: re-filing the same (scheme, key) is a replay,
 *               never a double-file (API-P9).
 *
 * The projection content itself comes from the Rules Engine / ledger (T-16/T-06) — never an LLM
 * (AI-P3); this module carries it as an opaque, versioned payload. No I/O; deterministic.
 */

export type SubmissionStatus = 'prepared' | 'authorized' | 'filed';

export interface GovSubmission {
  id: string;
  /** Which government system — 'GSTN' | 'TRACES' | 'RCS' | 'NCD' | 'PFMS' | … */
  scheme: string;
  tenantId: string;
  jurisdiction: string;
  /** Idempotency (API-P9): the same return (period/type) carries the same key; re-filing is a replay. */
  idempotencyKey: string;
  status: SubmissionStatus;
  /** Who prepared it (system/user) — SoD baseline. */
  preparedBy: string;
  /** The human authorized officer who signed the filing off (set at authorize; SoD ≠ preparedBy). */
  authorizedBy?: string;
  schemaVersion: number;
  /** The versioned, projected return payload (opaque here). */
  payload: unknown;
}

export interface PrepareInput {
  id: string;
  scheme: string;
  tenantId: string;
  jurisdiction: string;
  idempotencyKey: string;
  preparedBy: string;
  payload: unknown;
  schemaVersion?: number;
}

/**
 * PURE — prepare a statutory return. Starts in 'prepared' and is NOT filed — filing requires human
 * authority (API-P8/RULE 6). Throws on a malformed submission: a bad statutory filing is worse than
 * a rejected one.
 */
export function prepareSubmission(input: PrepareInput): GovSubmission {
  const req = (v: unknown, name: string) => {
    if (typeof v !== 'string' || v.trim().length === 0) throw new RangeError(`gov submission: ${name} is required`);
  };
  req(input.id, 'id');
  req(input.scheme, 'scheme');
  req(input.tenantId, 'tenantId');
  req(input.jurisdiction, 'jurisdiction');
  req(input.idempotencyKey, 'idempotencyKey');
  req(input.preparedBy, 'preparedBy');
  return {
    id: input.id,
    scheme: input.scheme,
    tenantId: input.tenantId,
    jurisdiction: input.jurisdiction,
    idempotencyKey: input.idempotencyKey,
    status: 'prepared',
    preparedBy: input.preparedBy,
    schemaVersion: input.schemaVersion ?? 1,
    payload: input.payload,
  };
}

export interface FilingResult {
  ok: boolean;
  submission?: GovSubmission;
  /** True on fileSubmission when the key was already filed — replayed, not re-filed (API-P9). */
  replayed?: boolean;
  reason?: string;
}

/** The authorizing officer — must be a human for a statutory filing (API-P8/AUTH-6). */
export interface AuthorizingOfficer {
  id: string;
  isHuman: boolean;
}

/**
 * PURE — authorize a prepared return for filing under HUMAN authority + SoD. Refused unless the
 * submission is in 'prepared', the officer is human, and the officer is INDEPENDENT of the preparer
 * (preparer ≠ authorizer). A return is never filed autonomously (API-P8/RULE 6).
 */
export function authorizeFiling(sub: GovSubmission, officer: AuthorizingOfficer): FilingResult {
  if (sub.status !== 'prepared') return { ok: false, reason: `only a prepared submission can be authorized (is "${sub.status}")` };
  if (!officer.isHuman || !officer.id) return { ok: false, reason: 'a statutory filing requires a human authorized officer (API-P8)' };
  if (officer.id === sub.preparedBy) return { ok: false, reason: 'separation of duties: the preparer cannot authorize the filing (RULE 6/AUTH-6)' };
  return { ok: true, submission: { ...sub, status: 'authorized', authorizedBy: officer.id } };
}

/** PURE — the idempotency identity of a submission (scheme + key). */
export function submissionKey(sub: Pick<GovSubmission, 'scheme' | 'idempotencyKey'>): string {
  return `${sub.scheme}::${sub.idempotencyKey}`;
}

/**
 * PURE — file an AUTHORIZED return, idempotently against the set of already-filed keys. Re-filing
 * the same (scheme, idempotencyKey) is a REPLAY (ok, no state change), never a double-file
 * (API-P9). Refused unless the submission has been authorized.
 */
export function fileSubmission(sub: GovSubmission, filedKeys: ReadonlySet<string>): FilingResult {
  if (sub.status === 'filed') return { ok: true, submission: sub, replayed: true };
  if (filedKeys.has(submissionKey(sub))) return { ok: true, submission: { ...sub, status: 'filed' }, replayed: true };
  if (sub.status !== 'authorized') return { ok: false, reason: `only an authorized submission can be filed (is "${sub.status}")` };
  return { ok: true, submission: { ...sub, status: 'filed' }, replayed: false };
}
