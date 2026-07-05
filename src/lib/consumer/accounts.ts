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

export const MEMBER_RECEIVABLE_SUBTYPE = 'member_receivable';
export const PATRONAGE_DISTRIBUTION_SUBTYPE = 'patronage_distribution';
export const REBATE_PAYABLE_SUBTYPE = 'rebate_payable';
export const DIVIDEND_DISTRIBUTION_SUBTYPE = 'dividend_distribution';
export const DIVIDEND_PAYABLE_SUBTYPE = 'dividend_payable';
export const SALES_RETURN_SUBTYPE = 'sales_return';

export function resolveMemberReceivableAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, MEMBER_RECEIVABLE_SUBTYPE, ['member purchase receivable', 'सदस्य खरीद प्राप्य', 'member receivable']);
}

export function resolvePatronageDistributionAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, PATRONAGE_DISTRIBUTION_SUBTYPE, ['patronage rebate distribution', 'संरक्षण रिबेट वितरण', 'patronage distribution']);
}

export function resolveRebatePayableAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, REBATE_PAYABLE_SUBTYPE, ['member rebate payable', 'देय सदस्य रिबेट', 'rebate payable']);
}

export function resolveDividendDistributionAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, DIVIDEND_DISTRIBUTION_SUBTYPE, ['dividend distribution', 'लाभांश वितरण']);
}

export function resolveDividendPayableAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, DIVIDEND_PAYABLE_SUBTYPE, ['dividend payable', 'देय लाभांश']);
}

export function resolveSalesReturnAccountId(accounts: ReadonlyArray<Acc>): string | null {
  return resolveBy(accounts, SALES_RETURN_SUBTYPE, ['sales return', 'returns inward', 'बिक्री वापसी']);
}
