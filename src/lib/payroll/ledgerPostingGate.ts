/**
 * Payroll → ledger posting gate (M0 finding R23, Phase-3 S0/S1; approved 2026-09-27).
 *
 * pay-post / pay-pay / pay-rollback write vouchers through a direct DB connection: header +
 * voucher_entries only — no `lines`, no ledger_events journal event, no FY / period-lock check,
 * RLS bypassed. The app's reports and the journal would not see those postings correctly. Until
 * payroll posts through the Phase-3 posting service (S3), the three ledger actions are OFF:
 * here in the UI, and on the server by the PAY_LEDGER_POSTING_ENABLED kill-switch in each function.
 * Payroll calculation, verify / approve / lock, cancel and payslips are unaffected.
 */

export const PAY_LEDGER_POSTING_ENABLED = false;

/** The payroll actions that write to the general ledger. */
export const LEDGER_ACTIONS = ['post', 'pay', 'rollback'] as const;

export function isLedgerAction(action: string): boolean {
  return (LEDGER_ACTIONS as readonly string[]).includes(action);
}

export function ledgerPostingBlocked(action: string): boolean {
  return isLedgerAction(action) && !PAY_LEDGER_POSTING_ENABLED;
}

export const LEDGER_POSTING_OFF_HI = 'Payroll की बही-posting अभी बंद है — नई posting service आने तक। Payroll की गणना, सत्यापन, लॉक और payslip पहले जैसे चलते हैं।';
export const LEDGER_POSTING_OFF_EN = 'Payroll ledger posting is disabled until the new posting service. Calculation, verify, lock and payslips work as before.';
