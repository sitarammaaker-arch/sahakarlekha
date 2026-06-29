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

/** Symbolic selector → LedgerAccount id. Business-confirmed (D1). */
export const PROCUREMENT_POSTING_BINDING: Record<string, string> = {
  'stock.procurement': '3403',   // Trading Goods (asset) — procured produce held as stock
  'farmer.payable': '2105',      // MSP Payable to Farmers (liability) — amount owed to the farmer
};

/**
 * Resolve the balanced, account-frozen legs for a request type + profile. This slice supports only
 * 'RecogniseProcurement' on the 'agency' profile → Dr stock.procurement / Cr farmer.payable, each =
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
  const raw: Array<{ side: 'Dr' | 'Cr'; accountSelector: string }> =
    requestType === 'RecogniseProcurement' && profile === 'agency'
      ? [
          { side: 'Dr', accountSelector: 'stock.procurement' },
          { side: 'Cr', accountSelector: 'farmer.payable' },
        ]
      : [];
  if (raw.length === 0) return [];

  const legs: PostingLeg[] = [];
  for (const r of raw) {
    const accountId = binding[r.accountSelector];
    if (!accountId) return [];                              // unbound selector
    const account = accounts.find(a => a.id === accountId);
    if (!account) return [];                                // bound account not in the chart
    legs.push({
      side: r.side,
      accountSelector: r.accountSelector,
      resolvedAccountId: account.id,
      accountCode: account.id,       // in this chart the id IS the chart code
      accountName: account.name,
      amount,
    });
  }
  return legs;
}
