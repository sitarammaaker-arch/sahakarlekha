/**
 * Is this liability ledger a DEPOSIT the society holds (members' SB / FD / RD / compulsory deposits)? PURE;
 * unit-tested by scripts/test-statutory-report-guards.mjs.
 *
 * RPT-06 (audit 2026-11-17): the Federation return summed every liability whose name matched /deposit|fd|rd/ —
 * "rd" is inside "NABARD" and "Board", so "Loan from DCCB/NABARD" (a BORROWING) was reported as deposits.
 * Now: whole words only, and anything named as a loan / borrowing / overdraft is never a deposit.
 */
// Abbreviations (FD / RD / SB) are NOT enough on their own: "Hafed Fertilizer Div (FD) A/c" is a creditor.
const DEPOSIT = /\bdeposits?\b|\bsavings\b|\bpigmy\b|जमा/i;
const NOT_DEPOSIT = /\bloans?\b|\bborrow|\boverdraft\b|\bo\.?d\.?\b|\bcash credit\b|ऋण|उधार/i;

export function isDepositLiabilityName(name: string | null | undefined): boolean {
  const n = String(name ?? '');
  return DEPOSIT.test(n) && !NOT_DEPOSIT.test(n);
}
