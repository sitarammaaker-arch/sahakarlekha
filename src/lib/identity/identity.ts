/**
 * Identity & PII separation (T-17 / ADR-0007; Canonical CL-6; IRR-3; DPDP).
 *
 * PURE. Personal data must NOT live in a financial row. A financial record references a
 * PSEUDONYMOUS KEY (identityRef); the PII — name, contact, nominee, government IDs — lives in a
 * separate identity context, joined to the ledger only by that key. This is what lets the DPDP
 * right-to-erasure be honoured WITHOUT breaking a statutorily-retained financial history: erase
 * (tombstone) the identity, keep the pseudonymous financial events intact (IRR-3).
 *
 * The pseudonymous key is INJECTED (a UUID at the call site) and is NOT derived from PII, so it
 * cannot be reversed into a person. This module is the SSOT for the split a migration runs over
 * history and a write-guard runs on every save; it holds NO PII itself and reads nothing.
 */

/** A stable, opaque reference to an identity — the only identity token a financial row carries. */
export type IdentityRef = string;

/** The fields that are PII and must live in the identity context, NEVER in a financial table.
 *  Aligned with the audit-log PII set; extend as new personal fields appear. */
export const PII_FIELDS: ReadonlySet<string> = new Set([
  'name', 'nameHi', 'fatherName', 'motherName', 'spouseName',
  'address', 'addressLine1', 'addressLine2', 'phone', 'email',
  'nomineeName', 'nomineeRelation', 'nomineePhone',
  'pan', 'entityPan', 'deducteePan', 'aadhaar', 'aadhaarNo', 'dob', 'photo',
]);

export type IdentityStatus = 'active' | 'tombstoned';

export interface IdentityRecord {
  identityRef: IdentityRef;
  /** The PII — held here, joined to financial records by identityRef only. Empty when tombstoned. */
  attributes: Record<string, unknown>;
  status: IdentityStatus;
}

export interface SplitResult<T> {
  /** The financial record with every PII field stripped, carrying identityRef instead. */
  financial: T & { identityRef: IdentityRef };
  /** The extracted identity (the PII), keyed by the same pseudonymous ref. */
  identity: IdentityRecord;
}

/**
 * PURE — split a record (e.g. a member) into a PII-FREE financial record + an identity record,
 * joined by a pseudonymous key. Every PII field moves to the identity side; everything else
 * (memberNo, share capital, dates, refs) stays on the financial side with identityRef added.
 * The exact transform a one-time migration and a write-guard both run.
 */
export function splitIdentity<T extends Record<string, unknown>>(record: T, identityRef: IdentityRef): SplitResult<T> {
  const financial: Record<string, unknown> = { identityRef };
  const attributes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (PII_FIELDS.has(k)) attributes[k] = v;
    else financial[k] = v;
  }
  return {
    financial: financial as T & { identityRef: IdentityRef },
    identity: { identityRef, attributes, status: 'active' },
  };
}

/** PURE — the PII fields a record still carries (present + non-null). A financial write-guard
 *  uses this to REJECT a row that would leak PII into a financial table (CL-6). */
export function piiLeaks(record: Record<string, unknown>): string[] {
  return Object.keys(record).filter((k) => PII_FIELDS.has(k) && record[k] != null).sort();
}

/** PURE — is this a clean financial record (no PII present)? */
export function isFinancialClean(record: Record<string, unknown>): boolean {
  return piiLeaks(record).length === 0;
}

/**
 * PURE — tombstone an identity for erasure (DPDP right-to-erasure): drop every PII attribute,
 * keep the identityRef and mark it tombstoned. The financial records that reference this ref are
 * UNCHANGED — statutory financial history survives, the person's data does not (erasure vs
 * retention reconciled). The CONSENT gate that authorises this is T-19.
 */
export function tombstoneIdentity(identity: IdentityRecord): IdentityRecord {
  return { identityRef: identity.identityRef, attributes: {}, status: 'tombstoned' };
}
