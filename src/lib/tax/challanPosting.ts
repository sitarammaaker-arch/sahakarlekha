/**
 * TDS challan deposit → ledger lines. PURE — no React, no I/O, no tax rates, no section logic.
 *
 * Deducting TDS credits "TDS Payable" (a liability to the tax department). Depositing it must DEBIT that
 * liability; before this, a challan was only a register row, so the liability never came down.
 *
 *   Dr TDS Payable                  the TDS part of the deposit
 *   Dr Penalty / Fine (expense)     interest and other charges paid with the challan (only when > 0)
 *   Cr Bank                         the whole amount of the challan
 *
 * The interest and the other charges are typed in by the user — this module never computes them and takes no
 * view on section, rate or deductibility. Amounts are handled in whole paise.
 */
import { toMinor, toRupees } from '@/lib/money';
import type { VoucherLine } from '@/types';

export type ChallanPostingError =
  | 'amount'        // total is not a positive amount
  | 'negative'      // interest or other charges is negative
  | 'no_tds'        // interest + other charges leave nothing for TDS Payable
  | 'no_bank'       // no bank account chosen / available
  | 'no_tds_head'   // chart has no TDS Payable liability
  | 'no_penalty_head'; // interest / charges entered but the chart has no penalty expense head

export interface ChallanPostingInput {
  /** Total deposited with the challan (₹). */
  amount: number;
  /** Interest paid with the challan (₹, default 0). */
  interestAmount?: number;
  /** Other charges (late fee etc.) paid with the challan (₹, default 0). */
  otherAmount?: number;
  bankAccountId: string | null | undefined;
  tdsPayableId: string | null | undefined;
  penaltyId: string | null | undefined;
}

export type ChallanPosting =
  | { ok: true; lines: VoucherLine[]; amount: number; tdsAmount: number; chargesAmount: number }
  | { ok: false; error: ChallanPostingError };

export const CHALLAN_REF_TYPE = 'tds.challan';

export function buildChallanPosting(input: ChallanPostingInput, newId: () => string = () => crypto.randomUUID()): ChallanPosting {
  const total = toMinor(input.amount);
  const interest = toMinor(input.interestAmount ?? 0);
  const other = toMinor(input.otherAmount ?? 0);
  if (!(total > 0)) return { ok: false, error: 'amount' };
  if (interest < 0 || other < 0) return { ok: false, error: 'negative' };
  if (!input.bankAccountId) return { ok: false, error: 'no_bank' };
  if (!input.tdsPayableId) return { ok: false, error: 'no_tds_head' };
  const tds = total - interest - other;
  if (!(tds > 0)) return { ok: false, error: 'no_tds' };
  if (interest + other > 0 && !input.penaltyId) return { ok: false, error: 'no_penalty_head' };

  const lines: VoucherLine[] = [{ id: newId(), accountId: input.tdsPayableId, type: 'Dr', amount: toRupees(tds), narration: 'TDS deposited' }];
  if (interest > 0) lines.push({ id: newId(), accountId: input.penaltyId as string, type: 'Dr', amount: toRupees(interest), narration: 'Interest on TDS deposit' });
  if (other > 0) lines.push({ id: newId(), accountId: input.penaltyId as string, type: 'Dr', amount: toRupees(other), narration: 'Other charges on TDS deposit' });
  lines.push({ id: newId(), accountId: input.bankAccountId, type: 'Cr', amount: toRupees(total) });
  return { ok: true, lines, amount: toRupees(total), tdsAmount: toRupees(tds), chargesAmount: toRupees(interest + other) };
}

/** Hindi-first message for a refused posting (RULE 7). */
export const CHALLAN_POSTING_MESSAGE: Record<Exclude<ChallanPostingError, 'no_tds_head' | 'no_penalty_head'>, string> = {
  amount: 'चालान की राशि 0 से ज़्यादा होनी चाहिए।',
  negative: 'ब्याज और अन्य शुल्क ऋणात्मक नहीं हो सकते।',
  no_tds: 'ब्याज और अन्य शुल्क जोड़कर चालान की राशि से कम रहने चाहिए — देय TDS का हिस्सा शून्य या ऋणात्मक बन रहा है।',
  no_bank: 'बैंक खाता चुनें (वाउचर के लिए)।',
};
