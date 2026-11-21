/**
 * DB-09 (product audit 2026-11-17) — PAN / Aadhaar / bank details of customers, suppliers, farmers, employees and
 * workers live in `party_identity` (migration 195, role-scoped RLS), the same split `member_identity` did for members
 * (src/lib/memberIdentity.ts). PURE: no React, no I/O — DataContext / LabourDataContext only wire it in.
 *
 * Two modes, decided at load by whether the table exists:
 *   LEGACY (195 not run): nothing changes — the fields stay on the party rows.
 *   SPLIT  (table present): party upserts never carry these fields; they are read from / written to party_identity;
 *          a role that may not read them gets them stripped on screen too (RLS is the real boundary once 196 blanks
 *          the party columns).
 */
import { PII_ROLES } from './memberIdentity';

export type PartyType = 'customer' | 'supplier' | 'farmer' | 'employee' | 'worker';

/** The entity's own property names that are PII — must equal the field lists in migration 195. */
export const PARTY_PII_FIELDS: Readonly<Record<PartyType, readonly string[]>> = {
  customer: ['pan', 'bankName', 'accountNo', 'ifsc'],
  supplier: ['pan', 'bankName', 'accountNo', 'ifsc'],
  farmer: ['bankName', 'bankAccountNo', 'ifsc'],
  employee: ['pan', 'bankAccount'],
  worker: ['pan', 'aadhaar', 'bankAccountNo', 'ifsc'],
};

/** Must equal public.jwt_can_read_party_pii(entity_type): the five PII roles, plus a procurementOfficer for farmers. */
export function canReadPartyPii(role: string | undefined | null, type: PartyType): boolean {
  if (!role) return false;
  return PII_ROLES.includes(role) || (type === 'farmer' && role === 'procurementOfficer');
}

export interface PartyIdentityRow { entity_type: string; entity_id: string; fields?: Record<string, unknown> | null }

/** PURE — a copy of the party row without its PII fields (what SPLIT mode sends to the party table). */
export function stripPartyPII<T extends object>(row: T, type: PartyType): T {
  const out = { ...(row as Record<string, unknown>) };
  for (const f of PARTY_PII_FIELDS[type]) delete out[f];
  return out as T;
}

/** PURE — only the PII fields of a party row (trimmed, empty dropped). */
export function pickPartyPII(row: object, type: PartyType): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of PARTY_PII_FIELDS[type]) {
    const v = (row as Record<string, unknown>)[f];
    const s = v == null ? '' : String(v).trim();
    if (s) out[f] = s;
  }
  return out;
}

/** PURE — did an edit change any PII field? */
export function partyPIIChanged(before: object, after: object, type: PartyType): boolean {
  const a = pickPartyPII(before, type), b = pickPartyPII(after, type);
  return PARTY_PII_FIELDS[type].some((f) => (a[f] ?? '') !== (b[f] ?? ''));
}

/**
 * PURE — overlay party_identity rows onto loaded party rows of one type.
 *  canRead: a party WITH an identity row takes its PII from that row only — a field cleared there stays cleared
 *           (the legacy column may still hold the old value until 196 blanks it). A party with NO identity row
 *           keeps what its own row held (not copied yet).
 *  !canRead: the PII fields are removed.
 */
export function applyPartyIdentity<T extends { id: string }>(rows: readonly T[], identity: readonly PartyIdentityRow[], type: PartyType, canRead: boolean): T[] {
  if (!canRead) return rows.map((r) => stripPartyPII(r, type));
  const byId = new Map(identity.filter((i) => i.entity_type === type).map((i) => [i.entity_id, i.fields ?? {}]));
  return rows.map((r) => {
    const f = byId.get(r.id);
    if (!f) return r;
    const merged = { ...(r as Record<string, unknown>) };
    for (const k of PARTY_PII_FIELDS[type]) {
      const v = (f as Record<string, unknown>)[k];
      if (v != null && String(v) !== '') merged[k] = v; else delete merged[k];
    }
    return merged as T;
  });
}

/** PURE — does this error mean "party_identity does not exist yet" (195 not run)? */
export function isMissingPartyIdentityTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205') return true;
  const m = (err.message || '').toLowerCase();
  return m.includes('party_identity') && (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find'));
}

/** PURE — the party_identity upsert row. Always a row (fields may be {}): an empty row records "cleared", so the old
 *  legacy-column value cannot show through again before 196 blanks it. */
export function partyIdentityRowFor(societyId: string, type: PartyType, entityId: string, row: object):
  { society_id: string; entity_type: PartyType; entity_id: string; fields: Record<string, string>; updated_at: string } {
  const fields = pickPartyPII(row, type);
  return { society_id: societyId, entity_type: type, entity_id: entityId, fields, updated_at: new Date().toISOString() };
}
