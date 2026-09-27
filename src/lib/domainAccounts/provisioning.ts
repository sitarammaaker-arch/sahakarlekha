/**
 * Domain account provisioning + duplicate diagnostic (RM-05 prep; deferred from RM-01).
 *
 * Consumer (pos_billing) and Dairy (dairy_collection) post to a few dedicated ledgers that a
 * society created before the domain shipped may not have. They used to be created by a LOAD-TIME
 * seeder in each domain context. That seeder judged "missing" against whatever chart was in
 * memory — including the CMS template fallback DataContext uses when the `accounts` fetch fails —
 * and addAccount mints a fresh UUID every time, so it wrote real duplicates to production.
 *
 * The seeder is gone. This module is the explicit replacement:
 *   - DOMAIN_ACCOUNT_SPECS: the catalog (the same accounts the seeders created, verbatim).
 *   - planMissingDomainAccounts: which specs a society needs and does not yet have. A spec counts
 *     as present when its EXISTING resolver finds any account (subtype, template id or name), so a
 *     hand-made or renamed ledger is honoured and never duplicated.
 *   - diagnoseDomainAccounts: READ-ONLY — every candidate account per role, which one the resolver
 *     currently picks, and how many live vouchers use each (postings split across duplicates).
 *
 * PURE: plain arrays in, plain rows out; never mutates input, never touches the database.
 * The resolvers are unchanged — this module only reads them. Tested by
 * scripts/test-domain-account-provisioning.mjs.
 */
import type { LedgerAccount } from '@/types';
import {
  consumerAccountMatches,
  resolveMemberReceivableAccountId, resolvePatronageDistributionAccountId, resolveRebatePayableAccountId,
  resolveDividendDistributionAccountId, resolveDividendPayableAccountId, resolveSalesReturnAccountId,
  MEMBER_RECEIVABLE_SUBTYPE, PATRONAGE_DISTRIBUTION_SUBTYPE, REBATE_PAYABLE_SUBTYPE,
  DIVIDEND_DISTRIBUTION_SUBTYPE, DIVIDEND_PAYABLE_SUBTYPE, SALES_RETURN_SUBTYPE,
  MEMBER_RECEIVABLE_HINTS, PATRONAGE_DISTRIBUTION_HINTS, REBATE_PAYABLE_HINTS,
  DIVIDEND_DISTRIBUTION_HINTS, DIVIDEND_PAYABLE_HINTS, SALES_RETURN_HINTS,
} from '@/lib/consumer/accounts';
import {
  dairyAccountMatches, DAIRY_ACCOUNT_IDS, DAIRY_HINTS,
  resolveMilkProcurementAccountId, resolveMilkBulkSalesAccountId, resolveMemberInputReceivableAccountId,
  resolveBonusDistributionAccountId, resolveBonusPayableAccountId,
} from '@/lib/dairy/accounts';

export type DomainCapability = 'pos_billing' | 'dairy_collection';

type Acc = Pick<LedgerAccount, 'id' | 'name' | 'nameHi' | 'subtype' | 'isGroup' | 'openingBalance' | 'openingBalanceType'>;

export interface DomainAccountSpec {
  key: string;
  capability: DomainCapability;
  /** The account created when missing — exactly what the old seeder passed to addAccount. */
  template: Omit<LedgerAccount, 'id'>;
  /** The live resolver the posting code uses (unchanged). */
  resolve: (accounts: ReadonlyArray<Acc>) => string | null;
  /** Every account that resolver COULD pick (its passes, unioned). */
  matches: (a: Acc) => boolean;
}

const consumer = (key: string, subtype: string, hints: string[], resolve: DomainAccountSpec['resolve'], template: Omit<LedgerAccount, 'id'>): DomainAccountSpec =>
  ({ key, capability: 'pos_billing', template, resolve, matches: a => consumerAccountMatches(a, subtype, hints) });

const dairy = (key: keyof typeof DAIRY_HINTS, subtype: string | null, resolve: DomainAccountSpec['resolve'], template: Omit<LedgerAccount, 'id'>): DomainAccountSpec =>
  ({ key: `dairy.${key}`, capability: 'dairy_collection', template, resolve, matches: a => dairyAccountMatches(a, subtype, DAIRY_ACCOUNT_IDS[key], DAIRY_HINTS[key]) });

export const DOMAIN_ACCOUNT_SPECS: ReadonlyArray<DomainAccountSpec> = [
  consumer('consumer.memberReceivable', MEMBER_RECEIVABLE_SUBTYPE, MEMBER_RECEIVABLE_HINTS, resolveMemberReceivableAccountId,
    { name: 'Member Purchase Receivable', nameHi: 'सदस्य खरीद प्राप्य', type: 'asset', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '3300', subtype: MEMBER_RECEIVABLE_SUBTYPE }),
  consumer('consumer.patronageDistribution', PATRONAGE_DISTRIBUTION_SUBTYPE, PATRONAGE_DISTRIBUTION_HINTS, resolvePatronageDistributionAccountId,
    { name: 'Patronage Rebate Distribution', nameHi: 'संरक्षण रिबेट वितरण', type: 'equity', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '1200', subtype: PATRONAGE_DISTRIBUTION_SUBTYPE }),
  consumer('consumer.rebatePayable', REBATE_PAYABLE_SUBTYPE, REBATE_PAYABLE_HINTS, resolveRebatePayableAccountId,
    { name: 'Member Rebate Payable', nameHi: 'देय सदस्य रिबेट', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100', subtype: REBATE_PAYABLE_SUBTYPE }),
  consumer('consumer.dividendDistribution', DIVIDEND_DISTRIBUTION_SUBTYPE, DIVIDEND_DISTRIBUTION_HINTS, resolveDividendDistributionAccountId,
    { name: 'Dividend Distribution', nameHi: 'लाभांश वितरण', type: 'equity', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '1200', subtype: DIVIDEND_DISTRIBUTION_SUBTYPE }),
  consumer('consumer.dividendPayable', DIVIDEND_PAYABLE_SUBTYPE, DIVIDEND_PAYABLE_HINTS, resolveDividendPayableAccountId,
    { name: 'Dividend Payable', nameHi: 'देय लाभांश', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100', subtype: DIVIDEND_PAYABLE_SUBTYPE }),
  consumer('consumer.salesReturn', SALES_RETURN_SUBTYPE, SALES_RETURN_HINTS, resolveSalesReturnAccountId,
    { name: 'Sales Return', nameHi: 'बिक्री वापसी', type: 'income', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '4100', subtype: SALES_RETURN_SUBTYPE }),

  dairy('milkProcurement', 'milk_procurement', resolveMilkProcurementAccountId,
    { name: 'Milk Procurement (Direct)', nameHi: 'दुग्ध खरीदी लागत (प्रत्यक्ष)', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5100', subtype: 'milk_procurement' }),
  dairy('milkBulkSales', 'milk_sales', resolveMilkBulkSalesAccountId,
    { name: 'Milk Sales — Bulk / Union', nameHi: 'दुग्ध बिक्री — यूनियन', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4100', subtype: 'milk_sales' }),
  dairy('memberInputReceivable', null, resolveMemberInputReceivableAccountId,
    { name: 'Member Input Receivable', nameHi: 'सदस्य आदान प्राप्य', type: 'asset', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '3300' }),
  dairy('bonusDistribution', null, resolveBonusDistributionAccountId,
    { name: 'Patronage Bonus Distribution', nameHi: 'संरक्षण बोनस वितरण', type: 'equity', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '1200', subtype: 'reserve' }),
  dairy('bonusPayable', null, resolveBonusPayableAccountId,
    { name: 'Bonus Payable', nameHi: 'देय बोनस', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' }),
];

/**
 * Specs the society's capabilities call for whose resolver finds NOTHING in `accounts`.
 * Idempotent by construction: once an account exists (by any resolver pass) it is not planned again.
 * Pass the chart freshly read from the database — never a template/fallback chart.
 */
export function planMissingDomainAccounts(accounts: ReadonlyArray<Acc>, capabilities: ReadonlySet<string>): DomainAccountSpec[] {
  return DOMAIN_ACCOUNT_SPECS.filter(s => capabilities.has(s.capability) && s.resolve(accounts) === null);
}

// ── Read-only diagnostic ──────────────────────────────────────────────────────

export interface DiagVoucher {
  isDeleted?: boolean;
  debitAccountId?: string;
  creditAccountId?: string;
  lines?: ReadonlyArray<{ accountId: string }> | null;
}

export interface DomainAccountCandidate {
  id: string;
  name: string;
  nameHi: string;
  subtype?: string;
  openingBalance: number;
  openingBalanceType: 'debit' | 'credit';
  /** Live (non-deleted) vouchers that reference this account on any leg. */
  liveVoucherCount: number;
  /** The one the resolver returns today — the account new postings go to. */
  isResolved: boolean;
}

export type DomainAccountStatus = 'ok' | 'missing' | 'duplicate';

export interface DomainAccountDiagnosis {
  key: string;
  capability: DomainCapability;
  /** Whether the society currently has the capability that needs this account. */
  required: boolean;
  nameHi: string;
  name: string;
  status: DomainAccountStatus;
  candidates: DomainAccountCandidate[];
  /** More than one candidate carries live vouchers — balances for this role are split. */
  postingsSplit: boolean;
}

const liveVoucherCounts = (vouchers: ReadonlyArray<DiagVoucher>): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    const ids = new Set<string>();
    if (v.debitAccountId) ids.add(v.debitAccountId);
    if (v.creditAccountId) ids.add(v.creditAccountId);
    for (const l of v.lines || []) if (l.accountId) ids.add(l.accountId);
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
};

/**
 * One row per domain role that is either required by a capability or already has an account.
 * READ-ONLY: reports duplicates; it never picks a "winner", merges, renames or deletes anything.
 */
export function diagnoseDomainAccounts(
  accounts: ReadonlyArray<Acc>,
  vouchers: ReadonlyArray<DiagVoucher>,
  capabilities: ReadonlySet<string>,
): DomainAccountDiagnosis[] {
  const counts = liveVoucherCounts(vouchers);
  const out: DomainAccountDiagnosis[] = [];
  for (const spec of DOMAIN_ACCOUNT_SPECS) {
    const required = capabilities.has(spec.capability);
    const resolvedId = spec.resolve(accounts);
    const candidates: DomainAccountCandidate[] = accounts.filter(spec.matches).map(a => ({
      id: a.id,
      name: a.name || '',
      nameHi: a.nameHi || '',
      subtype: a.subtype,
      openingBalance: a.openingBalance || 0,
      openingBalanceType: a.openingBalanceType,
      liveVoucherCount: counts.get(a.id) || 0,
      isResolved: a.id === resolvedId,
    }));
    if (!required && candidates.length === 0) continue;
    const status: DomainAccountStatus = candidates.length === 0 ? 'missing' : candidates.length > 1 ? 'duplicate' : 'ok';
    out.push({
      key: spec.key,
      capability: spec.capability,
      required,
      name: spec.template.name,
      nameHi: spec.template.nameHi,
      status,
      candidates,
      postingsSplit: candidates.filter(c => c.liveVoucherCount > 0).length > 1,
    });
  }
  return out;
}
