/**
 * Receipts & Payments classification (NCDC Annexure VII) — the Capital-vs-Revenue + GL-head rules for
 * an R&P line's account, extracted from DataContext.getReceiptsPayments so BOTH the current compute
 * and the future ledger projection (projectReceiptsPayments, T-09) share ONE classifier and cannot
 * diverge (RULE 2). PURE — no React, no Supabase.
 */
import type { LedgerAccount } from '@/types';

/** Parent codes whose children are CAPITAL (share capital, reserves, long-term loans, fixed assets, investments). */
export const CAPITAL_PARENTS: ReadonlySet<string> = new Set(['1100', '1200', '2300', '3100', '3200']);

/** Account subtypes that are CAPITAL by nature. */
export const CAPITAL_SUBTYPES: ReadonlySet<string> = new Set([
  'fixed_asset', 'investment', 'long_term_loan', 'deposit', 'accumulated_dep', 'reserve', 'surplus', 'share_capital',
]);

/**
 * PURE — Capital vs Revenue nature of an R&P line's account. Equity, a capital subtype, or a capital
 * parent ⇒ capital; everything else (and an unknown account) ⇒ revenue. Byte-identical to the inline
 * `natureOf` it replaces.
 */
export function accountNature(account: Pick<LedgerAccount, 'type' | 'subtype' | 'parentId'> | undefined): 'capital' | 'revenue' {
  if (!account) return 'revenue';
  if (account.type === 'equity') return 'capital';
  if (account.subtype && CAPITAL_SUBTYPES.has(account.subtype)) return 'capital';
  if (account.parentId && CAPITAL_PARENTS.has(account.parentId)) return 'capital';
  return 'revenue';
}

/** PURE — the GL-head type of an R&P line's account (defaults to 'asset' when unknown). */
export function accountGlType(account: Pick<LedgerAccount, 'type'> | undefined): string {
  return account?.type || 'asset';
}
