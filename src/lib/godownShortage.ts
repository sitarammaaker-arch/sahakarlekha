// Godown shortage / excess (गोदाम घटत / बढ़त) — HAFED Accounts Manual 1976, paras 9.19, 9.25, 10.20.
//
// A shortage someone answers for is booked to that person: Dr "<person> — shortage recoverable" (a ledger under the
// group "Shortage Recoverable", in current assets) / Cr "Sales by Shortage" (trading income), at weighted-average cost.
// Closing stock already falls by the same value, so gross profit is unchanged and the dues show on the balance sheet.
// A Board-approved write-off later moves the dues to the wastage / shortage expense. Normal driage, damage and excess
// post no voucher — they stay inside closing stock, exactly as before; the reason is only recorded.
//
// Pure: no React, no Supabase. DataContext finds / creates the accounts and posts; the register page only reads.
import type { LedgerAccount, StockAdjustmentReason, StockMovement, Voucher } from '@/types';

export const DECREASE_REASONS: readonly StockAdjustmentReason[] = ['normalLoss', 'damage', 'shortageRecoverable', 'other'];
export const INCREASE_REASONS: readonly StockAdjustmentReason[] = ['excess', 'other'];

export const REASON_LABEL: Record<StockAdjustmentReason, { hi: string; en: string }> = {
  normalLoss: { hi: 'सामान्य सूखत / छीजत', en: 'Normal loss / driage' },
  damage: { hi: 'टूट-फूट / ख़राबी', en: 'Damage / breakage' },
  shortageRecoverable: { hi: 'घटत — व्यक्ति से वसूली', en: 'Shortage — recoverable from a person' },
  shortageReversal: { hi: 'घटत रद्द (वापसी)', en: 'Shortage cancelled (reversal)' },
  excess: { hi: 'बढ़त (excess)', en: 'Excess found' },
  other: { hi: 'अन्य', en: 'Other' },
};

export const reasonLabel = (r: StockAdjustmentReason | undefined, hi: boolean): string =>
  r ? (hi ? REASON_LABEL[r].hi : REASON_LABEL[r].en) : (hi ? 'कारण दर्ज नहीं' : 'No reason recorded');

// The names the app creates the heads under. They are how it finds them again, so they never change.
export const SHORTAGE_GROUP = { name: 'Shortage Recoverable', nameHi: 'स्टॉक घटत वसूली योग्य' } as const;
export const SALES_BY_SHORTAGE = { name: 'Sales by Shortage', nameHi: 'घटत से बिक्री' } as const;
export const WRITE_OFF_HEAD = { name: 'Wastage / Shortage', nameHi: 'बर्बादी / कमी व्यय' } as const;

export const REF_SHORTAGE = 'stock.shortage';
export const REF_SHORTAGE_WRITEOFF = 'stock.shortage.writeoff';

const norm = (s: string | undefined) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Rupees at weighted-average cost, rounded to paise. */
export const shortageAmount = (qty: number, rate: number): number => Math.round(Math.abs(qty) * (rate || 0) * 100) / 100;

/** The error to show for this adjustment, or null when it may be saved. */
export function validateAdjustment(input: { qty: number; reason?: StockAdjustmentReason; person?: string; rate: number }, hi: boolean): string | null {
  const { qty, reason } = input;
  if (!Number.isFinite(qty) || qty === 0) return hi ? 'मात्रा शून्य नहीं हो सकती' : 'Quantity cannot be zero';
  if (!reason) return hi ? 'समायोजन का कारण चुनें' : 'Choose a reason for the adjustment';
  if (reason === 'shortageReversal') return hi ? 'यह कारण केवल घटत रजिस्टर से लगता है' : 'This reason is set only from the shortage register';
  if (qty < 0 && !DECREASE_REASONS.includes(reason)) return hi ? 'घटाने पर यह कारण नहीं चलेगा' : 'This reason does not fit a decrease';
  if (qty > 0 && !INCREASE_REASONS.includes(reason)) return hi ? 'बढ़ाने पर यह कारण नहीं चलेगा' : 'This reason does not fit an increase';
  if (reason === 'shortageRecoverable') {
    if (!norm(input.person)) return hi ? 'जिस व्यक्ति से वसूली होगी, उसका नाम दें' : 'Name the person the shortage is recoverable from';
    if (!(input.rate > 0)) return hi ? 'इस वस्तु की औसत लागत शून्य है — घटत की रकम नहीं बन सकती' : 'This item has no average cost — the shortage cannot be valued';
  }
  return null;
}

// ── finding the heads ───────────────────────────────────────────────────────────────────────────────────
export const findShortageGroup = (accounts: readonly LedgerAccount[]) =>
  accounts.find(a => a.isGroup && a.type === 'asset' && norm(a.name) === norm(SHORTAGE_GROUP.name));

export const findPersonLedger = (accounts: readonly LedgerAccount[], groupId: string, person: string) =>
  accounts.find(a => !a.isGroup && a.parentId === groupId && norm(a.name) === norm(person));

export const findSalesByShortage = (accounts: readonly LedgerAccount[]) =>
  accounts.find(a => !a.isGroup && a.type === 'income' && norm(a.name) === norm(SALES_BY_SHORTAGE.name));

/** Where a new current-asset group goes: 3300 when the chart has it, else the first asset group named "current". */
export function currentAssetsParent(accounts: readonly LedgerAccount[]): string | undefined {
  const c = accounts.find(a => a.id === '3300' && a.isGroup);
  if (c) return c.id;
  return accounts.find(a => a.isGroup && a.type === 'asset' && /current|चालू/i.test(`${a.name} ${a.nameHi}`))?.id;
}

/** Where a trading-income head goes: 4101's group, else 4100, else the first income group. */
export function tradingIncomeParent(accounts: readonly LedgerAccount[]): string | undefined {
  const p = accounts.find(a => a.id === '4101')?.parentId;
  if (p && accounts.some(a => a.id === p && a.isGroup)) return p;
  if (accounts.some(a => a.id === '4100' && a.isGroup)) return '4100';
  return accounts.find(a => a.isGroup && a.type === 'income')?.id;
}

/** The wastage / shortage expense a write-off goes to: 5108 when it is a ledger, else one named so; null = create it. */
export function findWriteOffAccount(accounts: readonly LedgerAccount[]): LedgerAccount | null {
  const a5108 = accounts.find(a => a.id === '5108' && !a.isGroup && a.type === 'expense');
  if (a5108) return a5108;
  return accounts.find(a => !a.isGroup && a.type === 'expense' && /wastage|shortage/i.test(a.name)) ?? null;
}

/** Where a new wastage expense goes: 5101's group, else 5100, else the first expense group. */
export function directExpenseParent(accounts: readonly LedgerAccount[]): string | undefined {
  const p = accounts.find(a => a.id === '5101')?.parentId;
  if (p && accounts.some(a => a.id === p && a.isGroup)) return p;
  if (accounts.some(a => a.id === '5100' && a.isGroup)) return '5100';
  return accounts.find(a => a.isGroup && a.type === 'expense')?.id;
}

// ── the register ────────────────────────────────────────────────────────────────────────────────────────
type Posting = { accountId: string; dr: number; cr: number };
export function voucherPostings(v: Pick<Voucher, 'lines' | 'debitAccountId' | 'creditAccountId' | 'amount'>): Posting[] {
  if (v.lines && v.lines.length) return v.lines.map(l => ({ accountId: l.accountId, dr: l.type === 'Dr' ? Number(l.amount) || 0 : 0, cr: l.type === 'Cr' ? Number(l.amount) || 0 : 0 }));
  const amt = Number(v.amount) || 0;
  return [{ accountId: v.debitAccountId, dr: amt, cr: 0 }, { accountId: v.creditAccountId, dr: 0, cr: amt }];
}

/** A voucher that counts: not cancelled, not waiting for or refused approval. */
export const isLiveVoucher = (v: Voucher) => !v.isDeleted && v.approvalStatus !== 'pending' && v.approvalStatus !== 'rejected';

export interface ShortageRow {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  unit: string;
  godownName: string;
  qty: number;          // signed: below zero = stock went down
  value: number;        // rupees at the rate stored on the movement
  reason?: StockAdjustmentReason;
  person?: string;
  voucherNo?: string;   // the shortage voucher (recoverable shortages), or the PV/… count that made the adjustment
  reversed: boolean;    // a later "shortage cancelled" movement undid it
  narration: string;
}

export interface PersonDues {
  accountId: string;
  name: string;
  booked: number;       // Dr — shortages booked
  cleared: number;      // Cr — recovered or written off
  outstanding: number;  // booked − cleared
}

export interface ShortageRegister {
  rows: ShortageRow[];
  persons: PersonDues[];
  totals: { decreaseValue: number; increaseValue: number; recoverableValue: number; outstanding: number };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A manual adjustment: one with a reason, or with no reference (transfers carry TRF/…, returns their return no.). */
export const isManualAdjustment = (m: StockMovement) => m.type === 'adjustment' && (!!m.reason || !(m.referenceNo || '').trim());

export function buildShortageRegister(input: {
  movements: readonly StockMovement[];
  stockItems: readonly { id: string; name: string; nameHi?: string; unit?: string }[];
  godowns: readonly { id: string; name: string }[];
  vouchers: readonly Voucher[];
  accounts: readonly LedgerAccount[];
  from?: string;
  to?: string;
  hi?: boolean;
}): ShortageRegister {
  const { from, to, hi } = input;
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const items = new Map(input.stockItems.map(i => [i.id, i]));
  const godowns = new Map(input.godowns.map(g => [g.id, g.name]));
  const reversedRefs = new Set(input.movements.filter(m => m.reason === 'shortageReversal' && m.referenceNo).map(m => m.referenceNo));

  const rows: ShortageRow[] = input.movements
    .filter(m => isManualAdjustment(m) && inRange(m.date))
    .map(m => {
      const it = items.get(m.itemId);
      return {
        id: m.id,
        date: m.date,
        itemId: m.itemId,
        itemName: it ? (hi && it.nameHi ? it.nameHi : it.name) : m.itemId,
        unit: it?.unit || '',
        godownName: m.godownId ? (godowns.get(m.godownId) || m.godownId) : '',
        qty: Number(m.qty) || 0,
        value: r2(Math.abs(Number(m.amount) || 0)),
        reason: m.reason,
        person: m.responsiblePerson || undefined,
        // The voucher of a recoverable shortage, or the physical verification (PV/…) that made the adjustment.
        voucherNo: m.reason === 'shortageRecoverable' || m.reason === 'shortageReversal' || /^PV\//.test(m.referenceNo || '') ? (m.referenceNo || undefined) : undefined,
        reversed: m.reason === 'shortageRecoverable' && !!m.referenceNo && reversedRefs.has(m.referenceNo),
        narration: m.narration || '',
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));

  // Dues come from the ledgers, not the movements: a receipt or a write-off is a voucher.
  const group = findShortageGroup(input.accounts);
  const ledgers = group ? input.accounts.filter(a => !a.isGroup && a.parentId === group.id) : [];
  const byId = new Map<string, PersonDues>(ledgers.map(a => [a.id, { accountId: a.id, name: hi && a.nameHi ? a.nameHi : a.name, booked: 0, cleared: 0, outstanding: 0 }]));
  if (byId.size) {
    for (const v of input.vouchers) {
      if (!isLiveVoucher(v) || (to && v.date > to)) continue;   // dues are AS AT the end date
      for (const p of voucherPostings(v)) {
        const d = byId.get(p.accountId);
        if (!d) continue;
        d.booked += p.dr;
        d.cleared += p.cr;
      }
    }
    // Opening balances typed on the ledger count as booked (debit) or cleared (credit).
    for (const a of ledgers) {
      const ob = Number(a.openingBalance) || 0;
      const d = byId.get(a.id)!;
      if (ob) { if (a.openingBalanceType === 'credit') d.cleared += ob; else d.booked += ob; }
    }
  }
  const persons = [...byId.values()]
    .map(d => ({ ...d, booked: r2(d.booked), cleared: r2(d.cleared), outstanding: r2(d.booked - d.cleared) }))
    .filter(d => d.booked || d.cleared)
    .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));

  const live = rows.filter(r => r.reason !== 'shortageReversal' && !r.reversed);
  return {
    rows,
    persons,
    totals: {
      decreaseValue: r2(live.filter(r => r.qty < 0).reduce((s, r) => s + r.value, 0)),
      increaseValue: r2(live.filter(r => r.qty > 0).reduce((s, r) => s + r.value, 0)),
      recoverableValue: r2(live.filter(r => r.reason === 'shortageRecoverable').reduce((s, r) => s + r.value, 0)),
      outstanding: r2(persons.reduce((s, p) => s + p.outstanding, 0)),
    },
  };
}
