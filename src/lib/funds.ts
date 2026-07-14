/**
 * Cooperative fund (reserve) accounting (ECR-27) — PURE. Builds a per-fund movement
 * statement from the fund account's voucher lines: opening → contributions/appropriations
 * → interest → utilisation → closing. NO React / Supabase / side effects. `closing` equals
 * the fund account's Trial-Balance balance (credit-positive corpus), so the statement always
 * ties to the books (L2 parity). Generic across all society types (was housing-only).
 *
 * Classification of a line on the fund account:
 *   Cr + refType 'fund.interest'  → interest allocated (e.g. FDR interest added to the corpus)
 *   Cr (any other refType)        → contribution / appropriation (surplus appropriation, top-up, transfer-in)
 *   Dr                            → utilisation (fund spent, e.g. a major repair or training expense)
 *
 * Mirrors scripts/test-funds.mjs.
 */
import type { LedgerAccount, Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor, toRupees, addMinor, sumMinor, type Minor } from '@/lib/money';

/** A fund is a non-group reserve account (sinking / repair / statutory / education / building funds). */
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
  // T-02 (RULE 2): accumulate the corpus in exact integer paise — this `closing` gates the
  // fund-utilisation guard (spend ≤ corpus), so a last-paisa drift must not creep into that limit.
  // Inputs are exact 2-dp rupee amounts, so toMinor is exact (no rounding boundary); rupees at emit.
  const openingMinor: Minor = fund.openingBalanceType === 'credit'
    ? toMinor(fund.openingBalance || 0)
    : -toMinor(fund.openingBalance || 0);

  const raw: { date: string; ref: string; kind: FundRowKind; particulars: string; creditMinor: Minor; debitMinor: Minor }[] = [];
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    for (const l of getVoucherLines(v)) {
      if (l.accountId !== fund.id) continue;
      const kind: FundRowKind = l.type === 'Dr' ? 'utilisation' : (v.refType === 'fund.interest' ? 'interest' : 'contribution');
      raw.push({
        date: v.date, ref: v.voucherNo, kind,
        particulars: v.narration || kind,
        creditMinor: l.type === 'Cr' ? toMinor(l.amount) : 0,
        debitMinor: l.type === 'Dr' ? toMinor(l.amount) : 0,
      });
    }
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));

  let balMinor: Minor = openingMinor;
  const rows: FundStatementRow[] = raw.map(r => {
    balMinor = addMinor(balMinor, r.creditMinor, -r.debitMinor);
    return {
      date: r.date, ref: r.ref, kind: r.kind, particulars: r.particulars,
      credit: toRupees(r.creditMinor), debit: toRupees(r.debitMinor), balance: toRupees(balMinor),
    };
  });
  const contributionsMinor = sumMinor(raw.filter(r => r.kind === 'contribution').map(r => r.creditMinor));
  const interestMinor = sumMinor(raw.filter(r => r.kind === 'interest').map(r => r.creditMinor));
  const utilisationMinor = sumMinor(raw.filter(r => r.kind === 'utilisation').map(r => r.debitMinor));
  const closingMinor = addMinor(openingMinor, contributionsMinor, interestMinor, -utilisationMinor);
  return {
    opening: toRupees(openingMinor),
    contributions: toRupees(contributionsMinor),
    interest: toRupees(interestMinor),
    utilisation: toRupees(utilisationMinor),
    closing: toRupees(closingMinor),
    rows,
  };
}
