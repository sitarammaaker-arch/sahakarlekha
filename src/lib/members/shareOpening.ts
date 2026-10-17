/**
 * The opening (OB) row of a member's share-capital khata — ONE rule for the voucher path
 * (memberSnapshot.buildMemberShareLedger, used by staff pages, the passbook and the member portal) and
 * the journal path (ledger/memberLedger.projectMemberLedger), so the two can never disagree (RULE 2).
 *
 * - A member whose joining share receipt is a voucher (a Cr-to-share-capital voucher dated on or before
 *   the join date) has no OB: the vouchers ARE the khata, so a scalar/voucher gap shows as "बेमेल".
 * - A member who joined before the vouchers began (an old register, or a member who joined before the
 *   current FY — postJoiningReceipts posts nothing for them, the share sits in the 1102 opening)
 *   brings an opening. The scalar already includes every later share move, so the opening is
 *   scalar − Σ(later credit − debit). Before this rule the OB was dropped as soon as a later purchase
 *   voucher existed, and a later refund was subtracted twice.
 *
 * Amounts in integer paise. PURE.
 */
export interface ShareMove {
  date: string;
  isCredit: boolean;
  amountMinor: number;
}

export function memberShareOpeningMinor(scalarMinor: number, joinDate: string | undefined, moves: readonly ShareMove[]): number {
  const join = (joinDate || '').slice(0, 10);
  const hasJoiningVoucher = moves.some((m) => m.isCredit && (!join || m.date.slice(0, 10) <= join));
  if (hasJoiningVoucher) return 0;
  const netMinor = moves.reduce((s, m) => s + (m.isCredit ? m.amountMinor : -m.amountMinor), 0);
  const openingMinor = scalarMinor - netMinor;
  // A negative implied opening means the vouchers exceed the scalar — show no OB so the gap is visible.
  return openingMinor > 0 ? openingMinor : 0;
}
