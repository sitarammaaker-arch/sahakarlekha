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
import { fixedDepositAccountId, compulsoryDepositAccountId, type HeadAccount } from '@/lib/accounting/headResolve';
import { tr } from '@/lib/uiLang';

/** Liability account (COA) that a product's balance sits in. The chart-blind id convention — the posting code
 *  uses resolveDepositLiabilityAccount, which also checks that the account really is that head. */
export function depositLiabilityAccount(type: DepositType): string {
  if (type === 'CD') return '2112';       // 2112 Compulsory (Thrift) Deposits from Members
  return type === 'FD' ? '2108' : '2107'; // 2108 Fixed Deposits; 2107 Member/Savings Deposits
}

/**
 * The liability account a deposit product's balance sits in, FOR THIS CHART — or null when the chart has none.
 * 2108 means Fixed Deposits in a PACS chart but Advance Maintenance in a housing chart and does not exist in most
 * others, so FD is resolved by meaning (lib/accounting/headResolve.ts). The compulsory deposit is resolved the same
 * way: only a Thrift & Credit chart ships its head (2112), and it never falls back to 2107 — the whole point of
 * the product is that it is reported apart from voluntary savings. SB / RD / Pigmy keep the 2107 convention and
 * need it to exist as a liability leaf.
 */
export function resolveDepositLiabilityAccount(type: DepositType, accounts: ReadonlyArray<HeadAccount>): string | null {
  if (type === 'FD') return fixedDepositAccountId(accounts);
  if (type === 'CD') return compulsoryDepositAccountId(accounts);
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

/** The voucher a cash movement on a deposit account is: money going out (withdrawal, closure payout) is a
 *  payment, money coming in is a receipt. Must agree with depositPosting's sign. */
export function depositVoucherType(txnType: DepositTxnType): 'payment' | 'receipt' {
  return txnType === 'withdraw' || txnType === 'closure' ? 'payment' : 'receipt';
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

/** Whether money can be taken out of this product while the account stays open. A compulsory deposit cannot:
 *  it is paid back in full when the account is closed (the member leaves), never in part. */
export function allowsWithdrawal(type: DepositType): boolean {
  return type !== 'CD';
}

/** Amount must be positive; a withdrawal cannot exceed the current balance; a compulsory deposit has no withdrawals. */
export function validateDepositTxn(txnType: DepositTxnType, amount: number, balance: number, depositType?: DepositType): DepositValidation {
  if (txnType === 'withdraw' && depositType && !allowsWithdrawal(depositType)) {
    return { ok: false, error: tr('अनिवार्य जमा से बीच में निकासी नहीं होती — सदस्यता समाप्त होने पर खाता बंद करके पूरी राशि लौटाएँ।', 'A compulsory deposit has no withdrawals — close the account when membership ends to pay the whole balance back.') };
  }
  if (!(amount > 0)) return { ok: false, error: tr('राशि 0 से ज़्यादा होनी चाहिए / Amount must be greater than 0', 'Amount must be greater than 0') };
  if (txnType === 'withdraw' && amount > balance) {
    return { ok: false, error: tr(`निकासी शेष (₹${balance}) से ज़्यादा नहीं हो सकती / Withdrawal cannot exceed the balance (₹${balance})`, `Withdrawal cannot exceed the balance (₹${balance})`) };
  }
  return { ok: true };
}
