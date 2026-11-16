/**
 * Compulsory (thrift) deposit helpers (Deposits module — depositType 'CD').
 *
 * A thrift & credit society's bye-laws raise a fixed monthly deposit from every member. Each member has one CD
 * account; `installmentAmount` is the monthly contribution. These pure helpers build the monthly collection sheet
 * (who has already paid this month, who has not) and work out arrears. Unit-tested by
 * scripts/test-compulsory-deposit.mjs.
 *
 * The amount and the month it starts come from the account the society opened — nothing here is a statutory value.
 */
import type { DepositAccount, DepositTransaction } from '@/types';
import { monthsBetween } from '@/lib/rdSchedule';

type Acct = Pick<DepositAccount, 'id' | 'memberId' | 'depositType' | 'status' | 'openDate' | 'installmentAmount'>;
type Txn = Pick<DepositTransaction, 'depositAccountId' | 'date' | 'txnType' | 'amount'>;

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Money a member paid in (an opening amount or a deposit) — interest credited by the society is not a contribution. */
const isContribution = (t: Txn) => t.txnType === 'open' || t.txnType === 'deposit';

/** 'YYYY-MM' of a YYYY-MM-DD date. */
export const monthOf = (iso: string): string => (iso || '').slice(0, 7);

/** Active compulsory deposit accounts. */
export function compulsoryAccounts<T extends Pick<DepositAccount, 'depositType' | 'status'>>(accounts: T[]): T[] {
  return (accounts || []).filter((a) => a.depositType === 'CD' && a.status === 'active');
}

/** Whether the member already has an open compulsory deposit account (a member has only one). */
export function hasActiveCompulsoryDeposit(accounts: Pick<DepositAccount, 'depositType' | 'status' | 'memberId'>[], memberId: string): boolean {
  return (accounts || []).some((a) => a.depositType === 'CD' && a.status === 'active' && a.memberId === memberId);
}

/** What the member paid into this account in the given month ('YYYY-MM'). */
export function paidInMonth(txns: Txn[], accountId: string, month: string): number {
  return round2((txns || []).reduce((s, t) => (t.depositAccountId === accountId && isContribution(t) && monthOf(t.date) === month ? s + t.amount : s), 0));
}

export interface CompulsoryArrears {
  monthsElapsed: number;   // months the contribution has fallen due for, from the opening month to asOf's month
  expected: number;        // monthsElapsed × monthly contribution
  paid: number;            // contributions paid in so far
  arrears: number;         // expected − paid, never negative (paying ahead is not arrears)
  monthsBehind: number;    // whole monthly contributions still owed
}

/**
 * Arrears on one account as of a date. The contribution falls due once in every calendar month from the month the
 * account was opened through the month of `asOf`. An account with no monthly amount set has no arrears.
 */
export function compulsoryArrears(acct: Pick<Acct, 'id' | 'openDate' | 'installmentAmount'>, txns: Txn[], asOf: string): CompulsoryArrears {
  const monthly = acct.installmentAmount && acct.installmentAmount > 0 ? acct.installmentAmount : 0;
  const paid = round2((txns || []).reduce((s, t) => (t.depositAccountId === acct.id && isContribution(t) && t.date <= asOf ? s + t.amount : s), 0));
  if (!monthly || !acct.openDate || asOf < acct.openDate) return { monthsElapsed: 0, expected: 0, paid, arrears: 0, monthsBehind: 0 };
  const monthsElapsed = monthsBetween(acct.openDate, asOf) + 1;
  const expected = round2(monthsElapsed * monthly);
  const arrears = Math.max(0, round2(expected - paid));
  return { monthsElapsed, expected, paid, arrears, monthsBehind: Math.floor(arrears / monthly + 1e-9) };
}

export interface CollectionRow<T> {
  account: T;
  monthly: number;          // the account's monthly contribution (0 when not set)
  paidThisMonth: number;    // already paid in the collection month
  suggested: number;        // what to collect now: the part of this month's contribution still unpaid
  arrears: number;          // total owed as of the collection date (includes this month)
}

/**
 * The monthly collection sheet: every active CD account with what it still owes for the month of `date`. An
 * account that has already paid this month gets a suggestion of 0, so posting the sheet twice does not collect twice.
 */
export function collectionSheet<T extends Acct>(accounts: T[], txns: Txn[], date: string): CollectionRow<T>[] {
  const month = monthOf(date);
  return compulsoryAccounts(accounts).map((account) => {
    const monthly = account.installmentAmount && account.installmentAmount > 0 ? account.installmentAmount : 0;
    const paidThisMonth = paidInMonth(txns, account.id, month);
    return {
      account, monthly, paidThisMonth,
      suggested: Math.max(0, round2(monthly - paidThisMonth)),
      arrears: compulsoryArrears(account, txns, date).arrears,
    };
  });
}
