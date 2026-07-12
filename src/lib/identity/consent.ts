/**
 * Consent lifecycle & gated erasure (T-19 / ADR-0007; IRR-3; DPDP; AI-M2; API IE-6).
 *
 * PURE. The DPDP right-to-erasure is reconciled with a cooperative's statutory retention: a
 * member's PII may be erased (tombstoned, T-17) ONLY when there is no longer a lawful reason to
 * keep it AND no statutory retention hold is active — while the PSEUDONYMOUS financial history
 * is retained regardless (it is not PII after the split). Erasure is:
 *
 *   BLOCKED by  • an active statutory retention hold (financial/KYC records within their period);
 *               • an active binding basis (legal_obligation / contract still in force);
 *               • consent still active (the member must withdraw it first).
 *   ALLOWED when none of those apply — then the identity is tombstoned; its financial refs are
 *               untouched, so the audited history survives while the person's data does not.
 *
 * Consent also gates SHARING: `consentAllows` says whether PII may be included for a purpose,
 * so an export/AI use redacts an identity that has not consented (API IE-6 / AI-M2). Everything
 * here is point-in-time (`asOf` injected), deterministic, and holds no data.
 */
import { tombstoneIdentity, type IdentityRecord, type IdentityRef } from './identity';

export type ConsentBasis = 'consent' | 'contract' | 'legal_obligation' | 'legitimate_use';
export type ConsentStatus = 'active' | 'withdrawn';

export interface ConsentArtifact {
  identityRef: IdentityRef;
  /** What the PII is processed for, e.g. 'membership' | 'kyc' | 'communication'. */
  purpose: string;
  basis: ConsentBasis;
  grantedAt: string;
  status: ConsentStatus;
  withdrawnAt?: string;
}

/** A statutory obligation that BLOCKS erasure until it lapses — retention wins for its period. */
export interface RetentionHold {
  identityRef: IdentityRef;
  reason: string; // 'financial_records' | 'kyc' | 'litigation'
  /** ISO — the hold is active while `until` is in the future. */
  until: string;
}

export interface ErasureRequest {
  identityRef: IdentityRef;
  consents: readonly ConsentArtifact[];
  holds: readonly RetentionHold[];
  /** When the erasure is evaluated (ISO). */
  asOf: string;
}

export interface ErasureVerdict {
  ok: boolean;
  problems: string[];
}

/**
 * PURE — may this identity's PII be erased as-of `asOf`? Erasure is refused while a retention
 * hold is active, while a binding lawful basis (legal_obligation/contract) is active, or while
 * consent is still active (withdraw it first). The pseudonymous financial history is never in
 * scope — it is retained regardless (IRR-3).
 */
export function authorizeErasure(req: ErasureRequest): ErasureVerdict {
  const asOfMs = Date.parse(req.asOf);
  const problems: string[] = [];
  if (Number.isNaN(asOfMs)) return { ok: false, problems: ['the evaluation time is unknown'] };

  for (const h of req.holds) {
    if (h.identityRef !== req.identityRef) continue;
    const untilMs = Date.parse(h.until);
    if (Number.isNaN(untilMs) || untilMs > asOfMs) {
      problems.push(`statutory retention hold (${h.reason}) blocks erasure until ${h.until}`);
    }
  }

  for (const c of req.consents) {
    if (c.identityRef !== req.identityRef || c.status !== 'active') continue;
    if (c.basis === 'legal_obligation' || c.basis === 'contract') {
      problems.push(`an active ${c.basis} basis (${c.purpose}) still requires the data`);
    } else if (c.basis === 'consent') {
      problems.push(`consent for "${c.purpose}" is still active — withdraw it to request erasure`);
    }
  }

  return { ok: problems.length === 0, problems };
}

export interface ErasureOutcome {
  identity: IdentityRecord;
  erased: boolean;
  problems: string[];
}

/**
 * PURE — erase (tombstone) the identity IF authorized, else return it UNCHANGED with the
 * reasons. Erasure is gated and auditable; the financial records that reference the identityRef
 * are never touched.
 */
export function eraseIfAuthorized(identity: IdentityRecord, req: ErasureRequest): ErasureOutcome {
  const verdict = authorizeErasure(req);
  return verdict.ok
    ? { identity: tombstoneIdentity(identity), erased: true, problems: [] }
    : { identity, erased: false, problems: verdict.problems };
}

/**
 * PURE — may PII be included for `purpose` as-of `asOf`? True only while a consent for that
 * purpose is active. An export or AI use of PII checks this and REDACTS an identity that has
 * not consented (API IE-6 / AI-M2 / API-P6).
 */
export function consentAllows(
  identityRef: IdentityRef,
  consents: readonly ConsentArtifact[],
  purpose: string,
  _asOf?: string,
): boolean {
  return consents.some((c) => c.identityRef === identityRef && c.purpose === purpose && c.status === 'active');
}
