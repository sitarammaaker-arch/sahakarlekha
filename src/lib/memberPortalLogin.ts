/**
 * Member Portal S3 — browser side of the member login identity.
 *
 * MUST derive byte-for-byte the same email as memberLoginEmail() in
 * supabase/functions/_shared/member-portal-core.mjs (the Edge Function that creates the login).
 * scripts/test-member-portal-view.mjs imports both and asserts they agree.
 */

export const MEMBER_EMAIL_DOMAIN = 'm.sahakarlekha.com';

/** Canonical member number: trimmed and upper-cased, so "m-001 " and "M-001" are one login. */
export function normalizeMemberNo(memberNo: string | undefined | null): string {
  return String(memberNo ?? '').trim().toUpperCase();
}

/** `m-<first 40 hex of sha256("<societyId>|<MEMBER NO>")>@m.sahakarlekha.com` (WebCrypto). */
export async function memberLoginEmail(societyId: string, memberNo: string): Promise<string> {
  const sid = String(societyId ?? '').trim();
  const no = normalizeMemberNo(memberNo);
  if (!sid || !no) throw new Error('societyId and memberNo are required');
  const bytes = new TextEncoder().encode(`${sid}|${no}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  return `m-${hex.slice(0, 40)}@${MEMBER_EMAIL_DOMAIN}`;
}

/** The portal's public path for a society (shared by the admin hand-out and the router). */
export function memberPortalPath(societyId: string): string {
  return `/member/${encodeURIComponent(societyId)}`;
}
