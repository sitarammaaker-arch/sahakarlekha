/**
 * Cash-receipt ceiling — Income-tax Act, 2025 s.186 (was s.269ST of the 1961 Act) as dated DATA.
 *
 * s.186(1): no person shall receive ₹2,00,000 or more (a) in aggregate from a person in a day, (b) in
 * respect of a single transaction, or (c) for transactions relating to one event or occasion from a
 * person — otherwise than by account payee cheque / draft / bank ECS / prescribed electronic mode.
 * s.186(2) exempts Government, banking companies, post office savings banks, co-operative BANKS (not
 * co-operative societies), s.185 transactions and notified persons/receipts.
 *
 * SOURCES (read 2026-10-09):
 *   • official page: https://www.incometaxindia.gov.in/w/section-186-41 (403 to our fetcher)
 *   • Act text reproduced: https://indiankanoon.org/doc/47068600/ ("Section 186 in The Income Tax Act, 2025")
 * Only the 2025-Act row is `verified`; the 1961-Act row (dates before 2026-04-01) was not re-read, so no
 * warning is raised on it (same discipline as rules/incomeTax.ts — never state unread law).
 *
 * The app only WARNS (never blocks): a sale may be partly paid by permitted modes, and penalty relief
 * for "good and sufficient reasons" is for the officer, not the software. PURE.
 */
export interface CashReceiptRule {
  section: string;
  effectiveFrom: string;   // ISO, inclusive
  effectiveTo?: string;    // ISO, exclusive
  limit: number;           // rupees — a receipt of this amount OR MORE is barred
  verified: boolean;
  sources: string[];
}

export const CASH_RECEIPT_RULES: readonly CashReceiptRule[] = [
  { section: 's.269ST, Income-tax Act 1961', effectiveFrom: '2017-04-01', effectiveTo: '2026-04-01', limit: 200000, verified: false, sources: [] },
  {
    section: 's.186, Income-tax Act 2025', effectiveFrom: '2026-04-01', limit: 200000, verified: true,
    sources: ['https://www.incometaxindia.gov.in/w/section-186-41', 'https://indiankanoon.org/doc/47068600/'],
  },
];

export function cashReceiptRule(date: string): CashReceiptRule | null {
  return CASH_RECEIPT_RULES.find((r) => date >= r.effectiveFrom && (!r.effectiveTo || date < r.effectiveTo)) ?? null;
}

export interface CashReceiptWarning { section: string; limit: number; total: number; single: boolean }

/**
 * Would this cash receipt reach the ceiling? `sameDayFromParty` = cash already received from the SAME
 * party on the same date (0 for a walk-in buyer — then only the single-transaction test applies).
 * Returns null when there is no verified rule for the date or the ceiling is not reached.
 */
export function cashReceiptWarning(date: string, amount: number, sameDayFromParty = 0): CashReceiptWarning | null {
  const rule = cashReceiptRule(date);
  if (!rule || !rule.verified) return null;
  const total = (Number(amount) || 0) + (Number(sameDayFromParty) || 0);
  if (total < rule.limit) return null;
  return { section: rule.section, limit: rule.limit, total, single: (Number(amount) || 0) >= rule.limit };
}

export function cashReceiptWarningText(w: CashReceiptWarning, hi: boolean): string {
  const amt = (n: number) => '₹' + n.toLocaleString('en-IN');
  return hi
    ? `${w.single ? 'इस एक बिल में' : 'इस ग्राहक से आज कुल'} नकद ${amt(w.total)} — ${amt(w.limit)} या अधिक नकद लेना मना है (${w.section})। भुगतान बैंक / चेक / UPI से लें।`
    : `${w.single ? 'This one bill takes' : 'Cash from this customer today totals'} ${amt(w.total)} — receiving ${amt(w.limit)} or more in cash is barred (${w.section}). Take it by bank / cheque / UPI.`;
}
