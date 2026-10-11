/**
 * The ONE "abnormal balance" rule — an account whose balance sits on the side OPPOSITE its natural
 * side by type (asset/expense are natural Dr; liability/income/equity natural Cr). Catches a savings
 * bank or cash in Cr (usually a missing opening balance or a receipt booked elsewhere — a bank does not
 * let a savings account go below zero; a real overdraft belongs in a Bank OD liability ledger) and a
 * receivable parked in a liability ledger. Used by Ledger Hygiene and the Trial Balance. PURE.
 *
 * Skips: group accounts; the P&L result (subtype 'surplus', which legitimately swings to a deficit);
 * the known contras (accumulated depreciation, 1208, 1211, round-off — lib/accountRoles); and an account whose
 * openingBalanceType is set to the "abnormal" side WITH A ₹0 OPENING — a user-made contra ledger.
 * 2026-10-11: an account with a NON-ZERO opening on the wrong side is exactly the error to catch (prod: 117
 * creditor ledgers opened in Dr from an import file), so it is no longer treated as an intentional contra.
 */
import { isLegitContraSide } from './accountRoles';

export interface AbnormalCheckAccount {
  id?: string;
  type: string;
  isGroup?: boolean;
  subtype?: string;
  openingBalance?: number;
  openingBalanceType?: 'debit' | 'credit';
}

/** signedBalance: Dr positive, Cr negative. */
export function isAbnormalBalance(a: AbnormalCheckAccount, signedBalance: number, zero = 0.005): boolean {
  // 'round_off' (5499) nets small ups and downs, so its balance legitimately sits on either side.
  if (a.isGroup || a.subtype === 'surplus' || a.subtype === 'round_off') return false;
  if (Math.abs(signedBalance) < zero) return false;
  const naturalDebit = a.type === 'asset' || a.type === 'expense';
  const balIsDebit = signedBalance > 0;
  if (naturalDebit === balIsDebit) return false;
  if (isLegitContraSide({ id: a.id ?? '', type: a.type, subtype: a.subtype, isGroup: a.isGroup })) return false;
  const contraSideSet = (naturalDebit && a.openingBalanceType === 'credit') || (!naturalDebit && a.openingBalanceType === 'debit');
  const intentionalContra = contraSideSet && !(Math.abs(Number(a.openingBalance) || 0) >= zero);
  return !intentionalContra;
}

/** Natural side of an account type, for messages. */
export function naturalSide(type: string): 'Dr' | 'Cr' {
  return type === 'asset' || type === 'expense' ? 'Dr' : 'Cr';
}
