/**
 * Dairy account resolvers (pure) — the C-A conflict resolution in code form.
 *
 * Milk procurement / bulk-sales must post to DEDICATED ledgers, never the generic 4101/5101
 * sales/purchase fallbacks (which the shared engine and Trading A/c key on). These resolvers
 * find the dedicated account for a society by, in order: (1) the subtype marker (robust to
 * renaming), (2) the template id, (3) a name hint. The caller freezes the returned id into the
 * voucher leg at posting time, so it stays stable per-society even though runtime-created
 * accounts carry a UUID id (addAccount mints its own id).
 */
import type { LedgerAccount } from '@/types';

/** Template ids used by NEW dairy societies (existing societies may carry UUIDs — resolve by subtype). */
export const DAIRY_ACCOUNT_IDS = {
  milkProcurement: '5108', // Milk Procurement (Direct)
  milkBulkSales: '4106',   // Milk Sales — Bulk / Union
  milkPayable: '2102',     // Milk Payment Payable
  unionReceivable: '3303', // Union Receivable (Sundry Debtors)
  memberInputReceivable: '3305', // Member Input Receivable (feed/medicine/AI on credit)
  bonusDistribution: '1210',     // Patronage Bonus Distribution (surplus appropriation)
  bonusPayable: '2106',          // Bonus Payable
  dividendDistribution: '1211',  // Dividend Distribution (surplus appropriation)
  dividendPayable: '2104',       // Dividend Payable
} as const;

type Acc = Pick<LedgerAccount, 'id' | 'name' | 'nameHi' | 'subtype'> & { isDeleted?: boolean };

const findBy = (
  accounts: ReadonlyArray<Acc>,
  subtype: string | null,
  id: string,
  nameHints: string[],
): string | null => {
  const live = accounts.filter((a) => !a.isDeleted);
  if (subtype) {
    const bySub = live.find((a) => a.subtype === subtype);
    if (bySub) return bySub.id;
  }
  const byId = live.find((a) => a.id === id);
  if (byId) return byId.id;
  const byName = live.find((a) =>
    nameHints.some((h) => (a.nameHi || '').includes(h) || (a.name || '').toLowerCase().includes(h.toLowerCase())),
  );
  return byName ? byName.id : null;
};

export const resolveMilkProcurementAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, 'milk_procurement', DAIRY_ACCOUNT_IDS.milkProcurement, ['दुग्ध खरीदी', 'दूध खरीद', 'Milk Procurement']);

export const resolveMilkBulkSalesAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, 'milk_sales', DAIRY_ACCOUNT_IDS.milkBulkSales, ['दुग्ध बिक्री', 'Milk Sales']);

export const resolveMilkPayableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.milkPayable, ['देय दुग्ध', 'दुग्ध भुगतान', 'Milk Payment Payable', 'Milk Payable']);

export const resolveUnionReceivableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.unionReceivable, ['विविध देनदार', 'Sundry Debtors', 'Union Receivable']);

export const resolveMemberInputReceivableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.memberInputReceivable, ['सदस्य आदान प्राप्य', 'Member Input Receivable']);

export const resolveBonusDistributionAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.bonusDistribution, ['संरक्षण बोनस वितरण', 'Patronage Bonus Distribution']);
export const resolveBonusPayableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.bonusPayable, ['देय बोनस', 'Bonus Payable']);
export const resolveDividendDistributionAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.dividendDistribution, ['लाभांश वितरण', 'Dividend Distribution']);
export const resolveDividendPayableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.dividendPayable, ['देय लाभांश', 'Dividend Payable']);
