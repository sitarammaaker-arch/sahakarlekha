/**
 * PURE — which bank accounts the Bank Book offers, and when it must warn that it is showing nothing.
 *
 * Bank accounts hang under the head 3302 "Bank Accounts". On some societies that head is stored as a normal
 * (non-group) account, so `getBankAccountIds` lists it FIRST and the Bank Book opened on the empty head:
 * a zero book next to a Trial Balance full of bank balances. The head is only a real choice when it holds
 * money itself (an opening balance or entries); otherwise it is hidden and the first real account is used.
 * Nothing is posted, moved or renamed — only what the report page picks by default.
 */

export function selectableBankIds(
  bankIds: readonly string[],
  headId: string,
  headHasMoney: boolean,
): string[] {
  const hasChildren = bankIds.some(id => id !== headId);
  if (!hasChildren || headHasMoney) return [...bankIds];
  return bankIds.filter(id => id !== headId);
}

/**
 * A Bank Book that shows no opening and no entries while the OTHER bank accounts hold money is almost
 * certainly the wrong account (or a missed posting) — say so instead of printing a convincing zero.
 */
export function bankBookZeroWarning(o: {
  selectedOpening: number;
  selectedEntryCount: number;
  otherBalances: readonly number[];
}): { warn: boolean; otherTotal: number } {
  const otherTotal = o.otherBalances.reduce((s, n) => s + Math.abs(n), 0);
  const empty = Math.abs(o.selectedOpening) < 0.005 && o.selectedEntryCount === 0;
  return { warn: empty && otherTotal >= 0.005, otherTotal };
}
