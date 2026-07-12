/**
 * Tenant-isolated, consent-bound AI memory (T-31 / AI Constitution Art. V; AI-M1..6; ADR-0007).
 *
 * PURE. AI memory is a PRIVILEGE bounded by tenancy, consent, and purpose — never a system of record.
 * This module is the SSOT for the three guarantees Art. V demands:
 *
 *   AI-M1  tenant isolation is ABSOLUTE — nothing learned in one society is ever visible to another;
 *   AI-M2/M3 consent- and purpose-bound — a member's PII enters memory only under an active consent
 *          for the stated purpose (composing T-19), and pseudonymous `identityRef` is preferred over
 *          raw PII (minimization);
 *   AI-M2/M6 right-to-erasure — an erasure request PURGES AI memory of that individual (honored via
 *          the identity tombstoning seam, T-17); because memory is not the books, the purge loses no
 *          financial data.
 *
 * No I/O; deterministic. The per-tenant store and its persistence are the wire layer's job.
 */
import { consentAllows, type ConsentArtifact } from '../identity/consent';

/** AI-M4: conversation context (transient, session-scoped) vs durable knowledge (society
 *  preferences, CoA conventions). Durable memory is admin-transparent; neither is a system of record. */
export type MemoryScope = 'ephemeral' | 'durable';

export interface MemoryEntry {
  id: string;
  /** AI-M1 — the single society this memory belongs to. */
  tenantId: string;
  scope: MemoryScope;
  /** AI-M2 — what the data is remembered for. */
  purpose: string;
  /** AI-M3 — the pseudonymous subject reference, preferred over raw PII. */
  identityRef?: string;
  /** True if the entry embeds member PII — discouraged; requires an active consent to admit. */
  containsPii?: boolean;
  content: unknown;
}

export interface AdmitResult {
  ok: boolean;
  reason?: string;
}

/**
 * PURE — AI-M2/M3: may this entry be written to AI memory? A non-PII (pseudonymous) entry is
 * admitted freely. A PII-bearing entry requires a known subject AND an ACTIVE consent for its exact
 * purpose (T-19 consentAllows) — otherwise it is refused, so member PII never silently accumulates
 * in AI memory beyond purpose.
 */
export function admitToMemory(entry: MemoryEntry, consents: readonly ConsentArtifact[]): AdmitResult {
  if (!entry.containsPii) return { ok: true };
  if (!entry.identityRef) {
    return { ok: false, reason: 'a PII-bearing memory entry needs an identityRef to check consent (AI-M3)' };
  }
  if (!consentAllows(entry.identityRef, consents, entry.purpose)) {
    return { ok: false, reason: `no active consent for purpose "${entry.purpose}" — PII cannot enter AI memory (AI-M2)` };
  }
  return { ok: true };
}

/**
 * PURE — AI-M1: the memory visible to a tenant. ONLY that tenant's entries are ever returned —
 * nothing learned in another society is reachable. (A store should already be per-tenant; this is
 * the enforced read.)
 */
export function readMemory(store: readonly MemoryEntry[], tenantId: string): MemoryEntry[] {
  return store.filter((e) => e.tenantId === tenantId);
}

/**
 * PURE — AI-M1 leak guard: the entries in a store that DON'T belong to `tenantId`. A per-tenant
 * memory should yield [] here; anything else is a cross-tenant leak (AI-N5) and a defect.
 */
export function crossTenantLeak(store: readonly MemoryEntry[], tenantId: string): MemoryEntry[] {
  return store.filter((e) => e.tenantId !== tenantId);
}

/**
 * PURE — AI-M2 right-to-erasure: remove every memory entry referencing an identity (ephemeral and
 * durable), honored via the tombstoning seam (T-17/T-19). Returns the store without those entries.
 * AI memory is not a system of record (AI-M6), so this purge loses no books — the pseudonymous
 * financial history is untouched.
 */
export function purgeIdentity(store: readonly MemoryEntry[], identityRef: string): MemoryEntry[] {
  return store.filter((e) => e.identityRef !== identityRef);
}
