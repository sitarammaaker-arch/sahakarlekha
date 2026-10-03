/**
 * Member identity split — Phase 2 of docs/reports-audit/design/MEMBER-PII-ROLE-SCOPED-READ.md.
 *
 * PAN / Aadhaar live in `member_identity` (role-scoped RLS, see the Phase-1 SQL) instead of being
 * readable by every role through `members`. PURE: no React, no I/O — so it is unit-tested alone
 * (scripts/test-member-identity.mjs) and DataContext only wires it in.
 *
 * Two modes, decided at load time by whether the `member_identity` table exists:
 *   LEGACY  (table missing — migration not run yet): nothing changes, PII stays on `members`.
 *   SPLIT   (table present): `members` upserts never carry aadhaar/pan; PII is read from / written to
 *           `member_identity`; roles that may not read PII get the fields stripped client-side too.
 */

/** Must equal public.jwt_can_read_pii() in the Phase-1 SQL. Unknown / missing role → no access. */
export const PII_ROLES: readonly string[] = ['admin', 'societyAdmin', 'accountant', 'secretary', 'manager'];

export function canReadMemberPii(role: string | undefined | null): boolean {
  return !!role && PII_ROLES.includes(role);
}

export interface IdentityRow { member_id: string; aadhaar?: string | null; pan?: string | null }

type WithPii = { id: string; aadhaar?: string; pan?: string };

/** PURE — a copy of the member row without the PII columns (what SPLIT mode upserts to `members`). */
export function stripMemberPII<T extends object>(member: T): Omit<T, 'aadhaar' | 'pan'> {
  const { aadhaar: _a, pan: _p, ...rest } = member as T & { aadhaar?: unknown; pan?: unknown };
  return rest as Omit<T, 'aadhaar' | 'pan'>;
}

/**
 * PURE — overlay identity rows onto loaded members.
 *  • canRead: the identity value wins; a member with no identity row keeps whatever `members` held
 *    (not yet backfilled), so nothing is hidden from a role that is allowed to see it.
 *  • !canRead: aadhaar/pan are removed (defence in depth — RLS is the real boundary once Phase 3
 *    blanks the legacy columns).
 */
export function applyMemberIdentity<T extends WithPii>(
  members: readonly T[],
  rows: readonly IdentityRow[],
  canRead: boolean,
): T[] {
  if (!canRead) return members.map(m => stripMemberPII(m) as unknown as T);
  const byId = new Map(rows.map(r => [r.member_id, r]));
  return members.map(m => {
    const r = byId.get(m.id);
    if (!r) return m;
    return {
      ...m,
      aadhaar: r.aadhaar || m.aadhaar || undefined,
      pan: r.pan || m.pan || undefined,
    };
  });
}

/** PURE — does this PostgREST/Postgres error mean "member_identity does not exist yet"? */
export function isMissingIdentityTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205') return true;
  const m = (err.message || '').toLowerCase();
  return m.includes('member_identity') && (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find'));
}

/** PURE — the member_identity upsert row for one member; null when there is nothing to store. */
export function identityRowFor(
  societyId: string, memberId: string, pii: { aadhaar?: string; pan?: string },
): (IdentityRow & { society_id: string; updated_at: string }) | null {
  const aadhaar = (pii.aadhaar || '').trim();
  const pan = (pii.pan || '').trim();
  if (!aadhaar && !pan) return null;
  return { society_id: societyId, member_id: memberId, aadhaar: aadhaar || null, pan: pan || null, updated_at: new Date().toISOString() };
}
