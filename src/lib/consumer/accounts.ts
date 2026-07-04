/**
 * Consumer C3 — resolve the "Member Purchase Receivable" control account.
 *
 * NOT hardcoded to a code (3306 is already "Rent Receivable" in the CMS chart). Like the
 * Dairy dedicated ledgers, the account is created via core addAccount (auto-id) and resolved
 * by a dedicated subtype, falling back to name. Per-member outstanding is DERIVED from sales +
 * recoveries (see credit.ts) rather than per-member sub-ledgers, so the chart stays small.
 */

export const MEMBER_RECEIVABLE_SUBTYPE = 'member_receivable';
const NAME_HINTS = ['member purchase receivable', 'सदस्य खरीद प्राप्य', 'member receivable'];

export function resolveMemberReceivableAccountId(
  accounts: ReadonlyArray<{ id: string; name?: string; subtype?: string; isGroup?: boolean }>,
): string | null {
  const bySubtype = accounts.find(a => !a.isGroup && a.subtype === MEMBER_RECEIVABLE_SUBTYPE);
  if (bySubtype) return bySubtype.id;
  const byName = accounts.find(a => !a.isGroup && a.name && NAME_HINTS.includes(a.name.trim().toLowerCase()));
  return byName ? byName.id : null;
}
