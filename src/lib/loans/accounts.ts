/**
 * Ledger heads for member-loan and KCC postings. PURE.
 *
 * The pages used `accounts.find(a => a.id === X || /name/.test(a.name))`. `find` returns the FIRST
 * account matching EITHER test, and accounts load ordered by id — so an earlier account whose name
 * merely contains the word won over the exact id:
 *   interest received  → 2208 "Interest Payable" (a LIABILITY), not 4408 income;
 *   KCC principal      → 2305 "KCC / Crop Loan (DCCB)" (the society's BORROWING), not a loan asset;
 *   member-loan principal (PACS chart) → 3303 "Short-term Loans (KCC)", not 3304.
 * Here the exact id always wins, and a name fallback is restricted to the right account TYPE — a
 * receipt of interest can never land in a liability, a loan to a member never in a borrowing.
 */
export interface AccountLike {
  id: string;
  name: string;
  nameHi?: string;
  type?: string;
  isGroup?: boolean;
}

const usable = (a: AccountLike) => !a.isGroup;
const text = (a: AccountLike) => `${a.name} ${a.nameHi ?? ''}`.toLowerCase();
const byId = (accounts: readonly AccountLike[], id: string) => accounts.find((a) => a.id === id && usable(a));

export const ACC_MEMBER_LOANS = '3304';          // Loans & Advances (asset)
export const ACC_MEMBER_LOAN_INTEREST = '4408';  // Interest on Member Loans (income)

/** Interest received on a member / KCC loan → income: 4408, else an INCOME head named interest/ब्याज. */
export function interestIncomeAccountId(accounts: readonly AccountLike[]): string {
  if (byId(accounts, ACC_MEMBER_LOAN_INTEREST)) return ACC_MEMBER_LOAN_INTEREST;
  const incomes = accounts.filter((a) => usable(a) && a.type === 'income' && /interest|ब्याज/.test(text(a)));
  return (incomes.find((a) => /loan|ऋण/.test(text(a))) ?? incomes[0])?.id ?? ACC_MEMBER_LOAN_INTEREST;
}

/** Principal of a member loan (Loan Register) → 3304, else an ASSET head named loan/ऋण (never KCC). */
export function memberLoanAccountId(accounts: readonly AccountLike[]): string {
  if (byId(accounts, ACC_MEMBER_LOANS)) return ACC_MEMBER_LOANS;
  const hit = accounts.find((a) => usable(a) && a.type === 'asset' && /loan|ऋण/.test(text(a)) && !/kcc|crop|फसल|interest|ब्याज/.test(text(a)));
  return hit?.id ?? ACC_MEMBER_LOANS;
}

/** Principal of a KCC loan to a member → an ASSET head named KCC / crop loan / फसल ऋण, else 3304. */
export function kccLoanAccountId(accounts: readonly AccountLike[]): string {
  const hit = accounts.find((a) => usable(a) && a.type === 'asset' && /kcc|crop loan|फसल ऋण/.test(text(a)) && !/interest|ब्याज/.test(text(a)));
  return hit?.id ?? memberLoanAccountId(accounts);
}
