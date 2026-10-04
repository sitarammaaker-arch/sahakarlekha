/**
 * PURE — cross-report tie-out: do the statements that must agree actually agree?
 *
 * Each check compares two figures that three different report builders derive independently
 * (Trial Balance, per-account Bank Books, Receipts & Payments). A mismatch is reported, never "fixed":
 * the ledger is the truth and the report that disagrees needs looking at.
 */
export interface TieOutRow {
  key: string;
  label: string;
  labelHi: string;
  a: number;
  b: number;
  ok: boolean;
  diff: number;
}

const TOL = 1; // rupee — the same tolerance the Trial Balance "balanced" test already uses

export function tieOutRow(key: string, label: string, labelHi: string, a: number, b: number): TieOutRow {
  const diff = Math.round((a - b) * 100) / 100;
  return { key, label, labelHi, a, b, ok: Math.abs(diff) < TOL, diff };
}

export function buildTieOut(o: {
  tbClosingDr: number;
  tbClosingCr: number;
  tbBankClosing: number;
  bankBooksClosing: number;
  rpClosingBank: number;
}): TieOutRow[] {
  return [
    tieOutRow('tb', 'Trial Balance: total Dr = total Cr', 'ट्रायल बैलेंस: कुल डेबिट = कुल क्रेडिट', o.tbClosingDr, o.tbClosingCr),
    tieOutRow('bank-bb', 'Bank closing: Trial Balance = all Bank Books', 'बैंक शेष: ट्रायल बैलेंस = सभी बैंक बुक', o.tbBankClosing, o.bankBooksClosing),
    tieOutRow('bank-rp', 'Bank closing: Trial Balance = Receipts & Payments', 'बैंक शेष: ट्रायल बैलेंस = प्राप्ति-भुगतान', o.tbBankClosing, o.rpClosingBank),
  ];
}
