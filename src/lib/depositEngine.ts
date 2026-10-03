/**
 * Deposit accounting engine (Deposits module — SB/FD/RD/Pigmy).
 *
 * A member deposit is a LIABILITY the society owes the member. A deposit increases it
 * (Dr Cash-Bank / Cr Deposit-liability); a withdrawal decreases it (Dr Deposit-liability
 * / Cr Cash-Bank). Pure & deterministic → unit-tested by scripts/test-deposits.mjs.
 *
 * Slice 1 wires SB open/deposit/withdraw; FD/RD/Pigmy + interest/maturity are later slices.
 */
import type { DepositType, DepositTxnType } from '@/types';
import { fixedDepositAccountId, type HeadAccount } from '@/lib/accounting/headResolve';

/** Liability account (COA) that a product's balance sits in. The chart-blind id convention — the posting code
 *  uses resolveDepositLiabilityAccount, which also checks that the account really is that head. */
export function depositLiabilityAccount(type: DepositType): string {
  return type === 'FD' ? '2108' : '2107'; // 2108 Fixed Deposits; 2107 Member/Savings Deposits
}

/**
 * The liability account a deposit product's balance sits in, FOR THIS CHART — or null when the chart has none.
 * 2108 means Fixed Deposits in a PACS chart but Advance Maintenance in a housing chart and does not exist in most
 * others, so FD is resolved by meaning (lib/accounting/headResolve.ts). SB / RD / Pigmy keep the 2107 convention
 * and need it to exist as a liability leaf.
 */
export function resolveDepositLiabilityAccount(type: DepositType, accounts: ReadonlyArray<HeadAccount>): string | null {
  if (type === 'FD') return fixedDepositAccountId(accounts);
  const a = accounts.find((x) => x.id === depositLiabilityAccount(type));
  return a && !a.isGroup && a.type === 'liability' ? a.id : null;
}

export interface DepositPosting {
  debitAccountId: string;
  creditAccountId: string;
  sign: 1 | -1;   // effect on the account balance
}

/**
 * Double-entry for a deposit transaction.
 *   open / deposit → Dr Cash-Bank / Cr Deposit-liability (+)
 *   withdraw       → Dr Deposit-liability / Cr Cash-Bank (−)
 */
export function depositPosting(txnType: DepositTxnType, acc: { liability: string; cashBank: string }): DepositPosting {
  if (txnType === 'withdraw' || txnType === 'closure') {
    return { debitAccountId: acc.liability, creditAccountId: acc.cashBank, sign: -1 };
  }
  return { debitAccountId: acc.cashBank, creditAccountId: acc.liability, sign: 1 };
}

/** New balance after applying a transaction (withdraw & closure pay out; others credit). */
export function applyDepositTxn(balance: number, txnType: DepositTxnType, amount: number): number {
  const sign = (txnType === 'withdraw' || txnType === 'closure') ? -1 : 1;
  return Math.round((balance + sign * amount) * 100) / 100;
}

export interface DepositValidation {
  ok: boolean;
  error?: string;
}

/** Amount must be positive; a withdrawal cannot exceed the current balance. */
export function validateDepositTxn(txnType: DepositTxnType, amount: number, balance: number): DepositValidation {
  if (!(amount > 0)) return { ok: false, error: 'राशि 0 से ज़्यादा होनी चाहिए / Amount must be greater than 0' };
  if (txnType === 'withdraw' && amount > balance) {
    return { ok: false, error: `निकासी शेष (₹${balance}) से ज़्यादा नहीं हो सकती / Withdrawal cannot exceed the balance (₹${balance})` };
  }
  return { ok: true };
}
