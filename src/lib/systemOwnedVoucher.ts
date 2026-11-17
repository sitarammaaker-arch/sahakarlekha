/**
 * Vouchers that belong to a server process and must never be edited, cancelled or reversed from the Vouchers
 * screen (audit 2026-11-17). Pure; unit-tested by scripts/test-system-owned-voucher.mjs.
 *
 *  • YE-03 — the year-close vouchers (refType 'fy.close' = the income/expense sweep into 1208, 'fy.close.stock' =
 *    the closing-stock journal). Cancelling the sweep brought the whole closed year's income and expense back into
 *    the current year while the year stayed "closed" and could not be closed again.
 *  • PAY-01 — the payroll-run vouchers (ids 'payrun-<runId>-accrual' / '-payment', posted by pay-post / pay-pay).
 *    Cancelling one left the run "posted"; a reversal made pay-rollback fail for ever, so the month could never be
 *    redone. Payroll's own Rollback is the only door.
 *
 * The database refuses the same changes (migration 176); this is the friendly, early half.
 */
export type SystemOwnedKind = 'year-close' | 'payroll-run';

export function systemOwnedVoucherKind(v: { id?: string; refType?: string } | null | undefined): SystemOwnedKind | null {
  if (!v) return null;
  const ref = String(v.refType ?? '');
  if (ref === 'fy.close' || ref.startsWith('fy.close.')) return 'year-close';
  if (/^payrun-.+-(accrual|payment)$/.test(String(v.id ?? ''))) return 'payroll-run';
  return null;
}

/** Hindi-first explanation for the refusal toast. */
export function systemOwnedVoucherMessage(kind: SystemOwnedKind, what: string, hindi: boolean): { title: string; description: string } {
  if (kind === 'year-close') {
    return hindi
      ? { title: `वाउचर ${what} नहीं होगा`, description: 'यह वर्ष-समापन (year close) का वाउचर है। बंद वर्ष का परिणाम इसी से 1208 में गया है — इसे बदलने या रद्द करने से पूरा बंद वर्ष चालू वर्ष में लौट आएगा। सुधार चालू वर्ष में नए वाउचर से करें।' }
      : { title: `Voucher cannot be ${what}`, description: 'This is a year-close voucher: the closed year\'s result went to 1208 through it. Changing or cancelling it would bring the whole closed year back into the current year. Correct it with a new voucher in the open year.' };
  }
  return hindi
    ? { title: `वाउचर ${what} नहीं होगा`, description: 'यह Payroll run का वाउचर है। इसे Payroll पेज पर run को Rollback करके ही बदला जा सकता है — यहाँ बदलने से run और बही अलग-अलग हो जाएँगे।' }
    : { title: `Voucher cannot be ${what}`, description: 'This is a payroll-run voucher. Change it only by rolling the run back on the Payroll page — changing it here would split the run from the ledger.' };
}
