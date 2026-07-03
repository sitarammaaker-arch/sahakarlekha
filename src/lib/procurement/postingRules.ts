/**
 * Procurement Phase 3.2 — Posting Rule resolver (PURE). Converts a PostingRequest's requestType
 * into resolved double-entry PostingLegs according to a Posting Rule. NO React / Supabase /
 * storage / toast / side effects.
 *
 * NOT the Financial Engine: it does not post, create vouchers, or touch the ledger. The legs are
 * the rule's OUTPUT as data. Account resolution is FROZEN here (Phase 3.2): each leg captures an
 * immutable snapshot — resolvedAccountId (authoritative for posting) + accountCode + accountName
 * (audit/history/reproducibility) — so a historical PostingRuleResult never depends on mutable
 * runtime bindings or later chart changes.
 */
import type { Money } from './shared';
import type { PostingLeg, AccountingProfile, FinancialIntentName } from './financial';
import type { RawPostingLeg } from '@/lib/posting/types';
import { freezePostingLegs } from '@/lib/posting/freezePostingLegs';

/**
 * Symbolic selector → LedgerAccount id. Business-confirmed.
 * AGENT model (founder decision 2026-07-03): in HAFED/FCI/MARKFED procurement the society acts as
 * the agency's AGENT — the produce is NOT the society's own trading stock. So procuring at MSP
 * raises a receivable from the agency (Dr MSP Receivable) against the amount owed to the farmer
 * (Cr MSP Payable). MSP is recovered from the agency later; the society's commission is a separate
 * intent. (This replaced the earlier principal/stock treatment `Dr Trading Goods 3403`.)
 */
export const PROCUREMENT_POSTING_BINDING: Record<string, string> = {
  'agency.receivable': '3308',   // MSP Receivable (asset) — amount recoverable from the agency
  'farmer.payable': '2105',      // MSP Payable to Farmers (liability) — amount owed to the farmer
};

/**
 * Resolve the balanced, account-frozen legs for a request type + profile. This slice supports only
 * 'RecogniseProcurement' on the 'agency' profile → Dr agency.receivable / Cr farmer.payable, each =
 * the request amount (∑Dr = ∑Cr). Each leg freezes resolvedAccountId + accountCode + accountName
 * from `accounts`. Returns [] for an unsupported combination, an unbound selector, or a bound
 * account missing from the chart — so the caller can reject. Pure (binding + accounts passed in).
 */
export function resolvePostingLegs(
  requestType: FinancialIntentName,
  amount: Money,
  profile: AccountingProfile,
  binding: Record<string, string>,
  accounts: ReadonlyArray<{ id: string; name: string }>,
): PostingLeg[] {
  // PROCUREMENT BUSINESS RULE (stays in this domain): which raw legs this request posts.
  const raw: RawPostingLeg[] =
    requestType === 'RecogniseProcurement' && profile === 'agency'
      ? [
          { side: 'Dr', accountSelector: 'agency.receivable' },
          { side: 'Cr', accountSelector: 'farmer.payable' },
        ]
      : [];
  // GENERIC INFRASTRUCTURE (shared posting core): freeze the raw legs against the chart.
  return freezePostingLegs(raw, amount, binding, accounts);
}
