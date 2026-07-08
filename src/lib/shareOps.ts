/**
 * Share operations posting map (ECR-16 / MS-02 — forfeit / surrender / redeem / bonus).
 *
 * Each operation posts a SHARE_CAP voucher and moves the member's share-capital scalar by
 * the same amount, so the per-member ledger (getMemberLedger) and the scalar stay in
 * lock-step. Pure & deterministic → unit-tested by scripts/test-share-ops.mjs.
 *
 *  bonus     — capitalize reserves into shares: Dr reserve  → Cr SHARE_CAP (+)
 *  forfeit   — seize a defaulter's shares:      Dr SHARE_CAP → Cr reserve  (−)
 *  redeem    — buy back redeemable shares:      Dr SHARE_CAP → Cr cash/bank (−)
 *  surrender — member voluntarily gives up:     Dr SHARE_CAP → Cr cash/bank (−)
 */
export type ShareOpType = 'bonus' | 'forfeit' | 'redeem' | 'surrender';

export interface ShareOpAccounts {
  shareCap: string;   // Individual Share Capital (1102)
  payout: string;     // cash/bank leg for redeem/surrender
  reserve: string;    // reserve leg for bonus/forfeit
}

export interface ShareOpPosting {
  debitAccountId: string;
  creditAccountId: string;
  sign: 1 | -1;       // effect on member.shareCapital
  usesCash: boolean;  // redeem/surrender pay out cash → 'payment' voucher
}

/** The double-entry for a share operation, given the resolved account ids. */
export function shareOpPosting(type: ShareOpType, acc: ShareOpAccounts): ShareOpPosting {
  switch (type) {
    case 'bonus':     return { debitAccountId: acc.reserve,  creditAccountId: acc.shareCap, sign: 1,  usesCash: false };
    case 'forfeit':   return { debitAccountId: acc.shareCap, creditAccountId: acc.reserve,  sign: -1, usesCash: false };
    case 'redeem':    return { debitAccountId: acc.shareCap, creditAccountId: acc.payout,   sign: -1, usesCash: true };
    case 'surrender': return { debitAccountId: acc.shareCap, creditAccountId: acc.payout,   sign: -1, usesCash: true };
  }
}

export interface ShareOpValidation {
  ok: boolean;
  error?: string;
}

/** Validate the amount: positive, and (for decrease ops) not more than the member holds. */
export function validateShareOp(type: ShareOpType, amount: number, currentShareCapital: number): ShareOpValidation {
  if (!(amount > 0)) return { ok: false, error: 'राशि 0 से ज़्यादा होनी चाहिए / Amount must be greater than 0' };
  if (type !== 'bonus' && amount > currentShareCapital) {
    return { ok: false, error: `राशि सदस्य की शेयर पूंजी (₹${currentShareCapital}) से ज़्यादा नहीं हो सकती / Amount cannot exceed the member's share capital (₹${currentShareCapital})` };
  }
  return { ok: true };
}

/** New share-capital scalar after applying an operation of `amount`. */
export function applyShareOp(type: ShareOpType, currentShareCapital: number, amount: number): number {
  const sign = type === 'bonus' ? 1 : -1;
  return Math.round((currentShareCapital + sign * amount) * 100) / 100;
}
