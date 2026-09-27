/**
 * Consumer C3 — resolve the "Member Purchase Receivable" control account.
 *
 * NOT hardcoded to a code (3306 is already "Rent Receivable" in the CMS chart). Like the
 * Dairy dedicated ledgers, the account is created via core addAccount (auto-id) and resolved
 * by a dedicated subtype, falling back to name. Per-member outstanding is DERIVED from sales +
 * recoveries (see credit.ts) rather than per-member sub-ledgers, so the chart stays small.
 */

type Acc = { id: string; name?: string; subtype?: string; isGroup?: boolean };

const resolveBy = (accounts: ReadonlyArray<Acc>, subtype: string, nameHints: string[]): string | null => {
  const bySubtype = accounts.find(a => !a.isGroup && a.subtype === subtype);
  if (bySubtype) return bySubtype.id;
  const byName = accounts.find(a => !a.isGroup && a.name && nameHints.includes(a.name.trim().toLowerCase()));
  return byName ? byName.id : null;
};

/**
 * True when `a` is one the resolver for (subtype, nameHints) COULD pick — the union of its two
 * passes. The resolver returns only the first hit; this lets a diagnostic list every candidate
 * (e.g. the duplicates the old load-time seeder created) without changing which one is chosen.
 */
export const consumerAccountMatches = (a: Acc, subtype: string, nameHints: ReadonlyArray<string>): boolean =>
  !a.isGroup && (a.subtype === subtype || (!!a.name && nameHints.includes(a.name.trim().toLowerCase())));

export const MEMBER_RECEIVABLE_SUBTYPE = 'member_receivable';
export const PATRONAGE_DISTRIBUTION_SUBTYPE = 'patronage_distribution';
export const REBATE_PAYABLE_SUBTYPE = 'rebate_payable';
export const DIVIDEND_DISTRIBUTION_SUBTYPE = 'dividend_distribution';
export const DIVIDEND_PAYABLE_SUBTYPE = 'dividend_payable';
export const SALES_RETURN_SUBTYPE = 'sales_return';

/** Lower-case exact-name fallbacks each resolver accepts (shared with consumerAccountMatches). */
export const MEMBER_RECEIVABLE_HINTS = ['member purchase receivable', 'सदस्य खरीद प्राप्य', 'member receivable'];
export const PATRONAGE_DISTRIBUTION_HINTS = ['patronage rebate distribution', 'संरक्षण रिबेट वितरण', 'patronage distribution'];
export const REBATE_PAYABLE_HINTS = ['member rebate payable', 'देय सदस्य रिबेट', 'rebate payable'];
export const DIVIDEND_DISTRIBUTION_HINTS = ['dividend distribution', 'लाभांश वितरण'];
export const DIVIDEND_PAYABLE_HINTS = ['dividend payable', 'देय लाभांश'];
export const SALES_RETURN_HINTS = ['sales return', 'returns inward', 'बिक्री वापसी'];

export function resolveMemberReceivableAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, MEMBER_RECEIVABLE_SUBTYPE, MEMBER_RECEIVABLE_HINTS);
}

export function resolvePatronageDistributionAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, PATRONAGE_DISTRIBUTION_SUBTYPE, PATRONAGE_DISTRIBUTION_HINTS);
}

export function resolveRebatePayableAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, REBATE_PAYABLE_SUBTYPE, REBATE_PAYABLE_HINTS);
}

export function resolveDividendDistributionAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, DIVIDEND_DISTRIBUTION_SUBTYPE, DIVIDEND_DISTRIBUTION_HINTS);
}

export function resolveDividendPayableAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, DIVIDEND_PAYABLE_SUBTYPE, DIVIDEND_PAYABLE_HINTS);
}

export function resolveSalesReturnAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, SALES_RETURN_SUBTYPE, SALES_RETURN_HINTS);
}
