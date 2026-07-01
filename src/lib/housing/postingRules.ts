/**
 * Housing — Posting Rule resolver (PURE). Mirrors src/lib/procurement/postingRules.ts.
 * Converts a housing financial intent into resolved, account-frozen double-entry legs. It
 * does NOT post, create vouchers, or touch the ledger / React / Supabase — the legs are the
 * rule's OUTPUT as data. Account resolution is FROZEN against the chart (resolvedAccountId is
 * authoritative; accountCode + accountName are audit snapshots) so a historical posting never
 * depends on a later chart change.
 *
 * Delivery H0 scaffolds this layer (the posting LAW for the housing domain) but does not yet
 * wire it into billing — the live bill-run still posts its two static legs inline. A later
 * delivery (multi-charge-head bills: maintenance / water / parking / sinking split) routes the
 * bill-run through resolveHousingPostingLegs so every housing transaction posts through a rule.
 */
import type { Money, PostingLeg, RawPostingLeg } from '@/lib/posting/types';
import { freezePostingLegs } from '@/lib/posting/freezePostingLegs';

/** Named housing financial intents (the requestType → raw-legs business rule keys). */
export type HousingIntentName =
  | 'RaiseMaintenanceDemand'
  | 'CollectMaintenance'
  | 'AccrueDefaulterInterest';

/**
 * Symbolic selector → LedgerAccount id, against the Housing Society chart of accounts
 * (src/lib/templates/housing.ts). Selectors keep posting rules independent of raw chart codes.
 */
export const HOUSING_POSTING_BINDING: Record<string, string> = {
  'maintenance.receivable': '3303', // Maintenance Receivable (asset)
  'maintenance.income':     '4101', // Maintenance Charges (income)
  'water.income':           '4102', // Water Charges (income)
  'parking.income':         '4103', // Parking Charges (income)
  'nonoccupancy.income':    '4104', // Non-Occupancy Charges (income)
  'interest.defaulter':     '4402', // Interest on Defaulters (income)
  'sinking.fund':           '1202', // Sinking Fund (reserve)
  'repair.fund':            '1204', // Repair & Maintenance Fund (reserve)
  'property.tax.payable':   '2207', // Property Tax Payable (liability — pass-through)
  'advance.maintenance':    '2108', // Advance Maintenance Collected (liability)
};

/**
 * Resolve the balanced, account-frozen legs for a housing intent. This scaffold supports the
 * fully-static 'RaiseMaintenanceDemand' → Dr maintenance.receivable / Cr maintenance.income,
 * each = the demand amount (∑Dr = ∑Cr). Intents whose cash/bank side is dynamic (collection)
 * or which need a charge-head breakdown are deferred to the multi-head delivery and return []
 * here, so a caller never posts an unresolved or unbalanced voucher. Pure (binding + accounts
 * passed in).
 */
export function resolveHousingPostingLegs(
  intent: HousingIntentName,
  amount: Money,
  binding: Record<string, string>,
  accounts: ReadonlyArray<{ id: string; name: string }>,
): PostingLeg[] {
  // HOUSING BUSINESS RULE (stays in this domain): which raw legs this intent posts.
  const raw: RawPostingLeg[] =
    intent === 'RaiseMaintenanceDemand'
      ? [
          { side: 'Dr', accountSelector: 'maintenance.receivable' },
          { side: 'Cr', accountSelector: 'maintenance.income' },
        ]
      : [];
  // GENERIC INFRASTRUCTURE (shared posting core): freeze the raw legs against the chart.
  return freezePostingLegs(raw, amount, binding, accounts);
}
