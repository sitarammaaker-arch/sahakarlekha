/**
 * Farmer-payment credit-account resolution (procurement). A farmer settlement can be
 * discharged three ways:
 *   • cash   → Cr Cash
 *   • bank   → Cr the chosen bank
 *   • agency → Cr the agency receivable (e.g. "Hafed Control"). Used when the agency paid
 *              the farmers DIRECTLY — nothing leaves the society's cash/bank, so crediting
 *              cash/bank (as before) wrongly drove those balances negative. Instead the
 *              agency's receivable is reduced (the agency settled its dues by paying farmers).
 * PURE — mirrors scripts/test-farmer-payment-mode.mjs.
 */
export type FarmerPaymentMode = 'cash' | 'bank' | 'agency';

/**
 * The account to CREDIT for a farmer payment in the given mode. Returns null when the
 * required account is missing (e.g. agency mode without an agency account chosen), so the
 * caller can block the post instead of silently mis-routing it.
 */
export function resolveFarmerPaymentCredit(
  mode: FarmerPaymentMode,
  ids: { cash: string; bank: string; agency?: string },
): string | null {
  if (mode === 'cash') return ids.cash || null;
  if (mode === 'bank') return ids.bank || null;
  if (mode === 'agency') return ids.agency || null;
  return null;
}
