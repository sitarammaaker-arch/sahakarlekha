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

/** Liability account (COA) that a product's balance sits in. */
export function depositLiabilityAccount(type: DepositType): string {
  return type === 'FD' ? '2108' : '2107'; // 2108 Fixed Deposits; 2107 Member/Savings Deposits
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
