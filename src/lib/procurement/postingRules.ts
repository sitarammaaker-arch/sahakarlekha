/**
 * Procurement Phase 3.2 — Posting Rule resolver (PURE). Converts a PostingRequest's requestType
 * into resolved double-entry PostingLegs according to a Posting Rule. NO React / Supabase /
 * storage / toast / side effects.
 *
 * NOT the Financial Engine: it does not post, create vouchers, or touch the ledger. The legs are
 * the rule's OUTPUT as data; `accountSelector` is a symbolic selector the engine binds later —
 * no real account is touched and no balance changes.
 */
import type { Money } from './shared';
import type { PostingLeg, AccountingProfile, FinancialIntentName } from './financial';

/**
 * Resolve the balanced legs for a request type + profile. This slice supports only
 * 'RecogniseProcurement' on the 'agency' profile → Dr stock.procurement / Cr farmer.payable,
 * each = the request amount (∑Dr = ∑Cr). Returns [] for an unsupported combination so the
 * caller can reject (no rule yet).
 */
export function resolvePostingLegs(
  requestType: FinancialIntentName,
  amount: Money,
  profile: AccountingProfile,
): PostingLeg[] {
  if (requestType === 'RecogniseProcurement' && profile === 'agency') {
    return [
      { side: 'Dr', accountSelector: 'stock.procurement', amount },
      { side: 'Cr', accountSelector: 'farmer.payable', amount },
    ];
  }
  return [];
}
