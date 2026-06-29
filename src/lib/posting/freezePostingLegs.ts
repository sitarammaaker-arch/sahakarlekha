/**
 * Shared posting core (PURE) — freeze raw legs into account-resolved PostingLegs.
 *
 * Generic infrastructure ONLY: it takes the domain's already-decided raw legs
 * (side + symbolic selector), the domain's binding (selector → account id), and the
 * chart, and returns balanced legs with a FROZEN account snapshot. It contains NO
 * business rule about WHICH legs to post — that decision (requestType → raw legs)
 * stays in each domain. NO React / Supabase / storage / side effects.
 *
 * Returns [] for: no raw legs, an unbound selector, or a bound account missing from
 * the chart — so the caller can reject rather than post to an unresolved account.
 */
import type { Money, PostingLeg, RawPostingLeg } from './types';

export function freezePostingLegs(
  rawLegs: ReadonlyArray<RawPostingLeg>,
  amount: Money,
  binding: Record<string, string>,
  accounts: ReadonlyArray<{ id: string; name: string }>,
): PostingLeg[] {
  if (rawLegs.length === 0) return [];
  const legs: PostingLeg[] = [];
  for (const r of rawLegs) {
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
