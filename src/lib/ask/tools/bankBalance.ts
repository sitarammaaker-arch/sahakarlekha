/**
 * D-lane tool — the society's total bank balance across all bank accounts (CAIOS Slice 4). PURE.
 *
 * Unlike cash (one account, ACCOUNT_IDS.CASH), a society has MANY bank accounts. So this sums
 * every bank account's net balance — and it reads them from the SAME builder the Trial Balance
 * page uses (ledgerTrialBalance, now cancelled-clean), filtered to bank accounts. That is RULE 2
 * by construction: the total here is exactly the sum of the bank rows the user sees on their
 * Trial Balance, and each bank account's closing equals its Bank Book running balance.
 *
 * A bank id is one under the BANK parent (isBankAccount / getBankAccountIds, storage.ts) — never a
 * hard-coded id, so a society with three banks or one custom account is handled the same way.
 *
 * PURE: events and accounts are injected; the fetch is the seam's job.
 */
import { ledgerTrialBalance } from '../../ledger/trialBalance';
import { getBankAccountIds, ACCOUNT_IDS } from '../../storage';
import { toMinor } from '../../money';
import { formatMinorInr } from './cashBalance';
import type { LedgerEvent } from '../../ledger/event';
import type { LedgerAccount } from '@/types';

export interface BankBalanceInput {
  events: readonly LedgerEvent[];
  accounts: readonly LedgerAccount[];
  /** Balance AS OF this date (inclusive). Omit for everything so far. */
  asOf?: string;
}

export interface BankBalanceResult {
  /** Total across all bank accounts, Dr-positive, in paise. A Cr total (net overdraft) is negative. */
  balanceMinor: number;
  /** The ONLY total string a model may quote (§3.7 number check). */
  formatted: string;
  /** How many bank accounts were summed. */
  bankCount: number;
  /** Per-bank breakdown — name + its own formatted balance, for an answer that can show the split. */
  perBank: { name: string; formatted: string }[];
}

/**
 * PURE — the total bank balance the Trial Balance's bank rows sum to. Returns null when the society
 * has NO bank account at all (an absent bank is not a ₹0 balance — saying "₹0" would be a lie).
 */
export function bankBalance(input: BankBalanceInput): BankBalanceResult | null {
  // A society with NO real bank account must be REFUSED, not answered "₹0" — an absent bank is not a
  // zero balance. getBankAccountIds can't signal this: with no children it falls back to the BANK
  // GROUP id, so its result is never empty. So test for a real (non-group) bank account directly —
  // either a child under the BANK group, or the '3302' account itself standing in as a single bank.
  const accts = input.accounts as unknown as { id: string; parentId?: string; isGroup?: boolean; subtype?: string }[];
  const hasRealBank = accts.some((a) => !a.isGroup && (a.id === ACCOUNT_IDS.BANK || a.parentId === ACCOUNT_IDS.BANK));
  if (!hasRealBank) return null;
  const bankIds = new Set(getBankAccountIds(accts));

  // The SAME rows the Trial Balance page shows (cancelled-clean). netBalance is Dr-positive rupees;
  // toMinor recovers exact paise so summing several banks cannot drift in the last paisa.
  const rowById = new Map(ledgerTrialBalance(input.events, input.accounts, input.asOf).map((r) => [r.account.id, r]));

  // Walk the accounts in their OWN order — the serial order of the chart of accounts, i.e. exactly the
  // order the Bank Book / खाता सूची lists them, NOT the trial balance's accountId sort. A bank with no
  // activity has no TB row; show it as ₹0.00 so the serial list stays complete.
  let balanceMinor = 0;
  const perBank: { name: string; formatted: string }[] = [];
  for (const a of input.accounts) {
    if (!bankIds.has(a.id)) continue;
    const netMinor = rowById.has(a.id) ? toMinor(rowById.get(a.id)!.netBalance) : 0;
    balanceMinor += netMinor;
    perBank.push({ name: a.name, formatted: formatMinorInr(netMinor) });
  }
  return { balanceMinor, formatted: formatMinorInr(balanceMinor), bankCount: perBank.length, perBank };
}
