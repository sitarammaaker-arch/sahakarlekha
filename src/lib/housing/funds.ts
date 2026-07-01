/**
 * Housing — fund (reserve) statement (PURE). Builds a per-fund movement statement from the fund
 * account's voucher lines: opening → contributions (billing + manual) → interest → utilisation →
 * closing. NO React / Supabase / side effects. `closing` equals the fund account's Trial-Balance
 * balance (credit-positive corpus), so the statement always ties to the books (L2 parity).
 *
 * Classification of a line on the fund account:
 *   Cr + refType 'fund.interest'  → interest allocated (FDR interest added to the corpus)
 *   Cr (any other refType)        → contribution (maintenance-bill split, manual top-up, transfer-in)
 *   Dr                            → utilisation (fund spent, e.g. a major repair)
 */
import type { LedgerAccount, Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** A fund is a non-group reserve account (the sinking / repair / statutory / education funds). */
export function isFundAccount(a: LedgerAccount): boolean {
  return !a.isGroup && a.subtype === 'reserve';
}

export type FundRowKind = 'contribution' | 'interest' | 'utilisation';

export interface FundStatementRow {
  date: string;
  ref: string;
  kind: FundRowKind;
  particulars: string;
  credit: number;   // adds to corpus
  debit: number;    // reduces corpus (utilisation)
  balance: number;  // running corpus after this row
}

export interface FundStatement {
  opening: number;
  contributions: number;
  interest: number;
  utilisation: number;
  closing: number;
  rows: FundStatementRow[];
}

export function buildFundStatement(fund: LedgerAccount, vouchers: Voucher[]): FundStatement {
  const opening = fund.openingBalanceType === 'credit' ? round2(fund.openingBalance || 0) : round2(-(fund.openingBalance || 0));

  const raw: Omit<FundStatementRow, 'balance'>[] = [];
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    for (const l of getVoucherLines(v)) {
      if (l.accountId !== fund.id) continue;
      const kind: FundRowKind = l.type === 'Dr' ? 'utilisation' : (v.refType === 'fund.interest' ? 'interest' : 'contribution');
      raw.push({
        date: v.date, ref: v.voucherNo, kind,
        particulars: v.narration || kind,
        credit: l.type === 'Cr' ? round2(l.amount) : 0,
        debit: l.type === 'Dr' ? round2(l.amount) : 0,
      });
    }
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));

  let bal = opening;
  const rows: FundStatementRow[] = raw.map(r => { bal = round2(bal + r.credit - r.debit); return { ...r, balance: bal }; });
  const contributions = round2(rows.filter(r => r.kind === 'contribution').reduce((s, r) => s + r.credit, 0));
  const interest = round2(rows.filter(r => r.kind === 'interest').reduce((s, r) => s + r.credit, 0));
  const utilisation = round2(rows.filter(r => r.kind === 'utilisation').reduce((s, r) => s + r.debit, 0));
  const closing = round2(opening + contributions + interest - utilisation);
  return { opening, contributions, interest, utilisation, closing, rows };
}
