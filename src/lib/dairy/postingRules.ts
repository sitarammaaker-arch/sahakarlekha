/**
 * Dairy — Posting Rule resolver (PURE). Mirrors src/lib/housing/postingRules.ts and
 * src/lib/procurement/postingRules.ts. Converts a dairy financial intent into resolved,
 * account-frozen double-entry legs. It does NOT post, create vouchers, or touch the ledger /
 * React / Supabase — the legs are the rule's OUTPUT as data. Account resolution is FROZEN
 * against the chart so a historical posting never depends on a later chart change.
 *
 * Delivery D2: 'RecogniseMilkProcurement' posts the cycle milk cost — Dr milk.procurement.cost
 * (dedicated 5108, NEVER the generic 5101) / Cr farmer.milk.payable (2102). Callers pass a
 * binding built from the dairy account resolvers (src/lib/dairy/accounts.ts) so it works even
 * when a society's milk ledgers carry runtime UUID ids (the C-A resolution).
 */
import type { Money, PostingLeg, RawPostingLeg } from '@/lib/posting/types';
import { freezePostingLegs } from '@/lib/posting/freezePostingLegs';

export type DairyIntentName = 'RecogniseMilkProcurement' | 'RecogniseMilkDispatch';

/** Symbolic selector → LedgerAccount id (default template ids; runtime binding may override with resolved ids). */
export const DAIRY_POSTING_BINDING: Record<string, string> = {
  'milk.procurement.cost':    '5108', // Milk Procurement (Direct) — dedicated, not the generic 5101
  'farmer.milk.payable':      '2102', // Milk Payment Payable (liability)
  'milk.dispatch.receivable': '3303', // Union Receivable (Sundry Debtors)
  'milk.bulk.sales':          '4106', // Milk Sales — Bulk / Union (income)
};

export function resolveDairyPostingLegs(
  intent: DairyIntentName,
  amount: Money,
  binding: Record<string, string>,
  accounts: ReadonlyArray<{ id: string; name: string }>,
): PostingLeg[] {
  // DAIRY BUSINESS RULE (stays in this domain): which raw legs this intent posts.
  const raw: RawPostingLeg[] =
    intent === 'RecogniseMilkProcurement'
      ? [
          { side: 'Dr', accountSelector: 'milk.procurement.cost' },
          { side: 'Cr', accountSelector: 'farmer.milk.payable' },
        ]
      : intent === 'RecogniseMilkDispatch'
        ? [
            { side: 'Dr', accountSelector: 'milk.dispatch.receivable' },
            { side: 'Cr', accountSelector: 'milk.bulk.sales' },
          ]
        : [];
  // GENERIC INFRASTRUCTURE (shared posting core): freeze the raw legs against the chart.
  return freezePostingLegs(raw, amount, binding, accounts);
}
