/**
 * Loan-exposure base — ONE formula for the Dashboard checklist and the Loan Register (RULE 2): the two
 * pages each summed "share capital + reserves" inline, by direct parent, so a ledger kept in a sub-group
 * under 1100 / 1200 was left out of both. Ledgers under 1100 Share Capital and 1200 Reserves & Surplus
 * count at any depth. The ceiling itself (10 × base) is the app's own guidance, not tied to an Act section.
 * PURE.
 */
import { isUnder, parentMap } from '@/lib/accounting/ancestry';

export const LOAN_EXPOSURE_MULTIPLE = 10;

export interface LoanExposureBase { shareCapital: number; reserves: number; base: number; limit: number }

export function loanExposureBase(
  trialBalance: ReadonlyArray<{ account: { id: string; parentId?: string; isGroup?: boolean }; netBalance: number }>,
  accounts: ReadonlyArray<{ id: string; parentId?: string }>,
): LoanExposureBase {
  const parentOf = parentMap(accounts);
  const sumUnder = (head: string) => trialBalance
    .filter((b) => !b.account.isGroup && isUnder(b.account, head, parentOf))
    .reduce((s, b) => s + Math.abs(b.netBalance), 0);
  const shareCapital = sumUnder('1100');
  const reserves = sumUnder('1200');
  const base = shareCapital + reserves;
  return { shareCapital, reserves, base, limit: base * LOAN_EXPOSURE_MULTIPLE };
}
