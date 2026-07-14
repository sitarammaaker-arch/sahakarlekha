/**
 * Member share-capital ledger from the event journal (T-09 / ADR-0001). PURE. The ledger-native
 * equivalent of DataContext.getMemberLedger — a running-balance khata of a member's Share Capital
 * (1102) vouchers.
 *
 * Like the cash book, a transaction LIST must show each aggregate's CURRENT state, so this resolves
 * every voucher aggregate to one effective transaction (cancelled → excluded; edited → latest
 * reposted; else posted), keeps only this member's share-capital vouchers (payload.memberId + a leg on
 * the share-capital account), sorts by (date, createdAt), and folds credit − debit into the running
 * balance. Credit = a Cr to share capital (deposit), debit = a Dr (withdrawal); the amount is the
 * voucher amount (payload.amount), matching getMemberLedger. Exact paise (T-02).
 *
 * The opening-balance row (a member with a `shareCapital` scalar but no share-capital voucher) is
 * MEMBER data, not in the journal, so `opts.openingMinor` + `opts.joinDate` are passed in. NOT wired.
 */
import type { LedgerEvent } from './event';
import { isValidMinor, toMinor } from '../money';

export interface LedgerMemberRow {
  id: string;
  date: string;
  voucherNo: string;
  particulars: string;
  creditMinor: number;
  debitMinor: number;
  balanceMinor: number;
}

interface Leg { accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number; }

function legsOf(payload: unknown): Leg[] {
  if (!payload || typeof payload !== 'object') return [];
  const arr = (payload as { lines?: unknown }).lines;
  if (!Array.isArray(arr)) return [];
  const out: Leg[] = [];
  for (const l of arr) {
    if (l && typeof l === 'object'
      && typeof (l as Leg).accountId === 'string'
      && ((l as Leg).drCr === 'Dr' || (l as Leg).drCr === 'Cr')
      && isValidMinor((l as Leg).amountMinor)) {
      out.push({ accountId: (l as Leg).accountId, drCr: (l as Leg).drCr, amountMinor: (l as Leg).amountMinor });
    }
  }
  return out;
}

const str = (p: unknown, k: string): string => {
  const v = p && typeof p === 'object' ? (p as Record<string, unknown>)[k] : undefined;
  return typeof v === 'string' ? v : '';
};
const num = (p: unknown, k: string): number => {
  const v = p && typeof p === 'object' ? (p as Record<string, unknown>)[k] : undefined;
  return typeof v === 'number' ? v : 0;
};

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
  // 1. Resolve each aggregate to its current effective event; keep this member's share-capital ones.
  const byAgg = new Map<string, LedgerEvent[]>();
  for (const e of Array.isArray(events) ? events : []) {
    if (e.aggregateType !== 'voucher') continue;
    (byAgg.get(e.aggregateId) ?? byAgg.set(e.aggregateId, []).get(e.aggregateId)).push(e);
  }
  const current: { id: string; date: string; voucherNo: string; narration: string; createdAt: string; scLeg: Leg; amount: number }[] = [];
  for (const [id, evs] of byAgg) {
    if (evs.some((e) => e.eventType === 'voucher.cancelled')) continue;
    const reposted = evs.filter((e) => e.eventType === 'voucher.reposted');
    const ev = reposted.length ? reposted[reposted.length - 1] : evs.find((e) => e.eventType === 'voucher.posted');
    if (!ev) continue;
    const p = ev.payload;
    if (str(p, 'memberId') !== memberId) continue;
    const scLeg = legsOf(p).find((l) => l.accountId === shareCapAccountId);
    if (!scLeg) continue;
    current.push({ id, date: str(p, 'date') || ev.occurredAt.slice(0, 10), voucherNo: str(p, 'voucherNo'), narration: str(p, 'narration'), createdAt: str(p, 'createdAt'), scLeg, amount: num(p, 'amount') });
  }

  // 2. Sort by (date, createdAt), the getMemberLedger order.
  current.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  // 3. OB row only when there is no Cr-to-share-capital voucher (a "proper" share-capital voucher).
  const hasShareCapVoucher = current.some((c) => c.scLeg.drCr === 'Cr');
  let balanceMinor = hasShareCapVoucher ? 0 : opts.openingMinor;
  const rows: LedgerMemberRow[] = [];
  if (!hasShareCapVoucher && opts.openingMinor > 0) {
    rows.push({ id: 'ob', date: opts.joinDate, voucherNo: 'OB', particulars: 'Opening Share Capital', creditMinor: opts.openingMinor, debitMinor: 0, balanceMinor });
  }

  // 4. Fold each voucher into the running balance.
  for (const c of current) {
    const isCredit = c.scLeg.drCr === 'Cr';
    const amtMinor = toMinor(c.amount);   // payload.amount is the voucher amount in rupees (T-02)
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
