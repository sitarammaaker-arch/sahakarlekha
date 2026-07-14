/**
 * Member share-capital ledger from the event journal (T-09 / ADR-0001). PURE. The ledger-native
 * equivalent of DataContext.getMemberLedger — a running-balance khata of a member's Share Capital
 * (1102) vouchers.
 *
 * Uses the shared current-voucher resolution (resolveCurrentVouchers), keeps this member's
 * share-capital vouchers (memberId + a leg on the share-capital account), sorts by (date, createdAt),
 * and folds credit (Cr to share capital) − debit (Dr) into the running balance. amount = the voucher
 * amount (payload.amount), matching getMemberLedger; particulars = narration || deposit/withdrawal.
 *
 * The opening-balance row (a member with a `shareCapital` scalar but no share-capital voucher) is
 * MEMBER data, not in the journal, so `opts.openingMinor` + `opts.joinDate` are passed in. NOT wired.
 */
import type { LedgerEvent } from './event';
import { toMinor } from '../money';
import { resolveCurrentVouchers } from './aggregateState';

export interface LedgerMemberRow {
  id: string;
  date: string;
  voucherNo: string;
  particulars: string;
  creditMinor: number;
  debitMinor: number;
  balanceMinor: number;
}

/**
 * PURE — a member's share-capital ledger. `opts.openingMinor` is the member's opening share capital
 * (shown as an OB row only when the member has no share-capital voucher, matching getMemberLedger);
 * `opts.joinDate` dates that row. amountMinor comes from the voucher amount (payload.amount).
 */
export function projectMemberLedger(
  events: readonly LedgerEvent[],
  memberId: string,
  shareCapAccountId: string,
  opts: { openingMinor: number; joinDate: string },
): LedgerMemberRow[] {
  // This member's share-capital vouchers (current state), in the getMemberLedger order.
  const current = resolveCurrentVouchers(events)
    .filter((c) => c.memberId === memberId && c.legs.some((l) => l.accountId === shareCapAccountId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  // OB row only when there is no Cr-to-share-capital voucher (a "proper" share-capital voucher).
  const scLegOf = (c: (typeof current)[number]) => c.legs.find((l) => l.accountId === shareCapAccountId)!;
  const hasShareCapVoucher = current.some((c) => scLegOf(c).drCr === 'Cr');
  let balanceMinor = hasShareCapVoucher ? 0 : opts.openingMinor;
  const rows: LedgerMemberRow[] = [];
  if (!hasShareCapVoucher && opts.openingMinor > 0) {
    rows.push({ id: 'ob', date: opts.joinDate, voucherNo: 'OB', particulars: 'Opening Share Capital', creditMinor: opts.openingMinor, debitMinor: 0, balanceMinor });
  }

  // Fold each voucher into the running balance.
  for (const c of current) {
    const isCredit = scLegOf(c).drCr === 'Cr';
    const amtMinor = toMinor(c.amount); // payload.amount is the voucher amount in rupees (T-02)
    const creditMinor = isCredit ? amtMinor : 0;
    const debitMinor = isCredit ? 0 : amtMinor;
    balanceMinor += creditMinor - debitMinor;
    rows.push({
      id: c.id, date: c.date, voucherNo: c.voucherNo,
      particulars: c.narration || (isCredit ? 'Share deposit received' : 'Share withdrawal'),
      creditMinor, debitMinor, balanceMinor,
    });
  }
  return rows;
}
