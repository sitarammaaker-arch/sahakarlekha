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

type Acc = Pick<LedgerAccount, 'id' | 'name' | 'nameHi' | 'subtype'> & { isDeleted?: boolean; isGroup?: boolean };

const nameHit = (a: Acc, nameHints: ReadonlyArray<string>): boolean =>
  nameHints.some((h) => (a.nameHi || '').includes(h) || (a.name || '').toLowerCase().includes(h.toLowerCase()));

const findBy = (
  accounts: ReadonlyArray<Acc>,
  subtype: string | null,
  id: string,
  nameHints: ReadonlyArray<string>,
): string | null => {
  // A group is a heading, never a posting target — a name/id hit on one (e.g. "Sundry Debtors" once 3303
  // became a group) must not be returned: the voucher would be refused. Resolve to a ledger instead.
  const live = accounts.filter((a) => !a.isDeleted && !a.isGroup);
  if (subtype) {
    const bySub = live.find((a) => a.subtype === subtype);
    if (bySub) return bySub.id;
  }
  const byId = live.find((a) => a.id === id && !isOtherChartsHead(a));
  if (byId) return byId.id;
  const byName = live.find((a) => nameHit(a, nameHints));
  return byName ? byName.id : null;
};

/**
 * The template ids above are the DAIRY chart's. Other charts use the same ids for unrelated heads — a
 * multipurpose / PACS / marketing society (storage.ts) has 5108 Wastage, 4106 Agricultural Implements
 * Sales, 2102 Expenses Payable, 3305 Subsidy Receivable, 1210 Social / Cooperative Dev Fund, 2106 Member
 * Payable. Matching those by id alone posted milk cost to Wastage and milk sales to implements sales
 * (staging demo 2026-11-10), and the Ledger Hygiene card called them "OK", so "Create domain accounts"
 * never made the dedicated ledgers. An account still carrying one of these names is NOT the dairy ledger:
 * the id pass skips it (the subtype and name passes are unchanged, so a renamed milk ledger still resolves).
 */
const OTHER_CHART_HEADS: ReadonlyArray<string> = [
  'Wastage', 'Wastage / Shortage', 'बर्बादी व्यय', 'बर्बादी / कमी व्यय',
  'Agricultural Implements Sales', 'कृषि यंत्र बिक्री',
  'Expenses Payable', 'देय व्यय', 'Cane Price Payable', 'देय गन्ना मूल्य',
  'Subsidy Receivable', 'प्राप्य अनुदान', 'Long-term Loans', 'दीर्घकालीन ऋण',
  'Social / Cooperative Dev Fund', 'सहकारी विकास निधि',
  'Member Payable', 'सदस्य देय',
].map((n) => n.toLowerCase());
const isOtherChartsHead = (a: Acc): boolean =>
  OTHER_CHART_HEADS.includes((a.name || '').trim().toLowerCase()) || OTHER_CHART_HEADS.includes((a.nameHi || '').trim().toLowerCase());

/**
 * True when `a` is one findBy(subtype, id, nameHints) COULD pick — the union of its three passes.
 * findBy returns only the first hit; this lets a diagnostic list every candidate without changing
 * which one is chosen.
 */
export const dairyAccountMatches = (a: Acc, subtype: string | null, id: string, nameHints: ReadonlyArray<string>): boolean =>
  !a.isDeleted && ((!!subtype && a.subtype === subtype) || (a.id === id && !isOtherChartsHead(a)) || nameHit(a, nameHints));

/** Name fallbacks for the ledgers the old load-time seeder created (shared with dairyAccountMatches). */
export const DAIRY_HINTS = {
  milkProcurement: ['दुग्ध खरीदी', 'दूध खरीद', 'Milk Procurement'],
  milkBulkSales: ['दुग्ध बिक्री', 'Milk Sales'],
  memberInputReceivable: ['सदस्य आदान प्राप्य', 'Member Input Receivable'],
  bonusDistribution: ['संरक्षण बोनस वितरण', 'Patronage Bonus Distribution'],
  bonusPayable: ['देय बोनस', 'Bonus Payable'],
  milkPayable: ['देय दुग्ध', 'दुग्ध भुगतान', 'Milk Payment Payable', 'Milk Payable'],
} as const;

export const resolveMilkProcurementAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, 'milk_procurement', DAIRY_ACCOUNT_IDS.milkProcurement, DAIRY_HINTS.milkProcurement);

export const resolveMilkBulkSalesAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, 'milk_sales', DAIRY_ACCOUNT_IDS.milkBulkSales, DAIRY_HINTS.milkBulkSales);

export const resolveMilkPayableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.milkPayable, DAIRY_HINTS.milkPayable);

// 3303-01 is the catch-all child of the 3303 Sundry Debtors GROUP in a current chart; a legacy chart still
// has 3303 itself as the ledger (findBy skips groups, so the second lookup only ever returns a ledger).
export const resolveUnionReceivableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, '3303-01', [])
  ?? findBy(accounts, null, DAIRY_ACCOUNT_IDS.unionReceivable, ['विविध देनदार', 'Sundry Debtors', 'Union Receivable']);

export const resolveMemberInputReceivableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.memberInputReceivable, DAIRY_HINTS.memberInputReceivable);

export const resolveBonusDistributionAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.bonusDistribution, DAIRY_HINTS.bonusDistribution);
export const resolveBonusPayableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.bonusPayable, DAIRY_HINTS.bonusPayable);
export const resolveDividendDistributionAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.dividendDistribution, ['लाभांश वितरण', 'Dividend Distribution']);
export const resolveDividendPayableAccountId = (accounts: ReadonlyArray<Acc>): string | null =>
  findBy(accounts, null, DAIRY_ACCOUNT_IDS.dividendPayable, ['देय लाभांश', 'Dividend Payable']);
