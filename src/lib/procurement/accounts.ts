/**
 * Procurement (MSP agent model) account resolvers — PURE.
 *
 * The agent flow posts to four dedicated ledgers:
 *   agency.receivable     Dr at "बहीखाता में पोस्ट", Cr at "एजेंसी रसीद"        (template 3308)
 *   farmer.payable        Cr at "बहीखाता में पोस्ट", Dr at settlement / payment (template 2105)
 *   commission.receivable Dr at "कमीशन", Cr at the commission receipt           (template 3314)
 *   commission.income     Cr at "कमीशन"                                          (template 4206)
 *
 * Only the marketing (CMS) chart template carries them. PACS / sugar societies have the
 * procurement_msp capability but not these ledgers, so posting failed with "Rule/खाता binding नहीं".
 * They are now created on an explicit admin click (Ledger Hygiene → "डोमेन खाते बनाएँ",
 * src/lib/domainAccounts/provisioning.ts) — never by load-time seeding.
 *
 * Resolution order (first hit wins): (1) the template id, but only when that account has the
 * expected type — the same id means different things in different charts (sugar's 2205 is Cane
 * Development Cess, not HRDF); (2) a name hint, again type-checked. Group accounts never match.
 * Tested by scripts/test-procurement-agent-flow.mjs.
 */
import type { LedgerAccount } from '@/types';

type Acc = Pick<LedgerAccount, 'id' | 'name' | 'nameHi' | 'type'> & { isGroup?: boolean; isDeleted?: boolean };

export type ProcurementAccountRole = 'agencyReceivable' | 'farmerPayable' | 'commissionReceivable' | 'commissionIncome';

export const PROCUREMENT_ACCOUNT_IDS: Record<ProcurementAccountRole, string> = {
  agencyReceivable: '3308',
  farmerPayable: '2105',
  commissionReceivable: '3314',
  commissionIncome: '4206',
};

export const PROCUREMENT_ACCOUNT_TYPES: Record<ProcurementAccountRole, LedgerAccount['type']> = {
  agencyReceivable: 'asset',
  farmerPayable: 'liability',
  commissionReceivable: 'asset',
  commissionIncome: 'income',
};

export const PROCUREMENT_ACCOUNT_HINTS: Record<ProcurementAccountRole, readonly string[]> = {
  agencyReceivable: ['प्राप्य MSP', 'MSP Receivable'],
  farmerPayable: ['किसानों को देय MSP', 'MSP Payable'],
  commissionReceivable: ['प्राप्य कमीशन', 'Commission Receivable'],
  commissionIncome: ['खरीद कमीशन', 'Procurement Commission'],
};

const nameHit = (a: Acc, hints: readonly string[]): boolean =>
  hints.some(h => (a.nameHi || '').includes(h) || (a.name || '').toLowerCase().includes(h.toLowerCase()));

const eligible = (a: Acc, role: ProcurementAccountRole): boolean =>
  !a.isDeleted && !a.isGroup && a.type === PROCUREMENT_ACCOUNT_TYPES[role];

/** True when `a` is an account the resolver COULD pick for `role` (union of both passes). */
export const procurementAccountMatches = (a: Acc, role: ProcurementAccountRole): boolean =>
  eligible(a, role) && (a.id === PROCUREMENT_ACCOUNT_IDS[role] || nameHit(a, PROCUREMENT_ACCOUNT_HINTS[role]));

export function resolveProcurementAccountId(accounts: ReadonlyArray<Acc>, role: ProcurementAccountRole): string | null {
  const live = accounts.filter(a => eligible(a, role));
  const byId = live.find(a => a.id === PROCUREMENT_ACCOUNT_IDS[role]);
  if (byId) return byId.id;
  const byName = live.find(a => nameHit(a, PROCUREMENT_ACCOUNT_HINTS[role]));
  return byName ? byName.id : null;
}

/**
 * The posting-rule binding (selector → this society's account id) for the agent RecogniseProcurement
 * rule. A selector whose ledger is missing is simply absent, so resolvePostingLegs returns [] and the
 * caller can tell the user exactly which ledger to create.
 */
export function procurementPostingBinding(accounts: ReadonlyArray<Acc>): Record<string, string> {
  const out: Record<string, string> = {};
  const recv = resolveProcurementAccountId(accounts, 'agencyReceivable');
  const pay = resolveProcurementAccountId(accounts, 'farmerPayable');
  if (recv) out['agency.receivable'] = recv;
  if (pay) out['farmer.payable'] = pay;
  return out;
}

/** Roles (of the given set) that this chart cannot resolve — for a precise "create these" message. */
export function missingProcurementRoles(
  accounts: ReadonlyArray<Acc>,
  roles: readonly ProcurementAccountRole[] = ['agencyReceivable', 'farmerPayable', 'commissionReceivable', 'commissionIncome'],
): ProcurementAccountRole[] {
  return roles.filter(r => resolveProcurementAccountId(accounts, r) === null);
}

export const PROCUREMENT_ROLE_LABEL_HI: Record<ProcurementAccountRole, string> = {
  agencyReceivable: 'प्राप्य MSP',
  farmerPayable: 'किसानों को देय MSP',
  commissionReceivable: 'प्राप्य कमीशन',
  commissionIncome: 'खरीद कमीशन',
};
