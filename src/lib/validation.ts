import type { LedgerAccount, SocietySettings } from '@/types';

export interface VoucherValidationResult {
  valid: boolean;
  errors: string[];    // hard errors — block save
  warnings: string[];  // soft warnings — allow save with notice
}

/**
 * Double-entry validation engine — 5 rules
 *
 * Rule 1: Debit account must exist and not be a group account
 * Rule 2: Credit account must exist, not be a group account, and differ from debit
 * Rule 3: Opening balance direction (checked separately in SocietySetup)
 * Rule 4: Amount must be > 0
 * Rule 5: Date should be within the current financial year (soft warning)
 */
export function validateVoucher(
  debitAccountId: string,
  creditAccountId: string,
  amount: number | string,
  date: string,
  accounts: LedgerAccount[],
  society: SocietySettings,
): VoucherValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const numAmount = Number(amount);

  // ── Rule 4: Amount ────────────────────────────────────────────────────────
  if (!amount || isNaN(numAmount) || numAmount <= 0) {
    errors.push(
      'राशि शून्य से अधिक होनी चाहिए / Amount must be greater than zero'
    );
  }

  // ── Rule 1: Debit account ─────────────────────────────────────────────────
  if (!debitAccountId) {
    errors.push('डेबिट खाता चुनें / Select debit account');
  } else {
    const drAcc = accounts.find(a => a.id === debitAccountId);
    if (!drAcc) {
      errors.push(
        `डेबिट खाता (ID: ${debitAccountId}) मौजूद नहीं — खाता हटाया जा सकता है / Debit account not found`
      );
    } else if (drAcc.isGroup) {
      errors.push(
        `"${drAcc.name}" एक समूह खाता है — इसमें सीधे प्रविष्टि नहीं हो सकती / "${drAcc.name}" is a group account, cannot post transactions`
      );
    }
  }

  // ── Rule 2: Credit account ────────────────────────────────────────────────
  if (!creditAccountId) {
    errors.push('क्रेडिट खाता चुनें / Select credit account');
  } else {
    const crAcc = accounts.find(a => a.id === creditAccountId);
    if (!crAcc) {
      errors.push(
        `क्रेडिट खाता (ID: ${creditAccountId}) मौजूद नहीं — खाता हटाया जा सकता है / Credit account not found`
      );
    } else if (crAcc.isGroup) {
      errors.push(
        `"${crAcc.name}" एक समूह खाता है — इसमें सीधे प्रविष्टि नहीं हो सकती / "${crAcc.name}" is a group account, cannot post transactions`
      );
    }
  }

  // Dr ≠ Cr
  if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
    errors.push(
      'डेबिट और क्रेडिट खाता एक नहीं हो सकते / Debit and Credit accounts must be different'
    );
  }

  // ── Rule 5: Date within financial year (soft warning) ────────────────────
  if (date && society?.financialYear) {
    const fy = society.financialYear; // e.g. "2024-25"
    const parts = fy.split('-');
    if (parts.length === 2) {
      const startYear = parseInt(parts[0]);
      const endYear = startYear + 1; // 2025 for "2024-25"
      const fyStart = `${startYear}-04-01`;
      const fyEnd   = `${endYear}-03-31`;
      if (date < fyStart || date > fyEnd) {
        warnings.push(
          `तिथि (${date}) वित्तीय वर्ष ${fy} (${fyStart} से ${fyEnd}) से बाहर है / Date is outside financial year ${fy}`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Quick check — is this account usable for transactions?
 * Returns error string or null if OK.
 */
export function accountTransactionError(
  accountId: string,
  accounts: LedgerAccount[],
  label = 'Account'
): string | null {
  if (!accountId) return `${label}: खाता चुनें / Select account`;
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return `${label}: खाता (${accountId}) मौजूद नहीं / Account not found`;
  if (acc.isGroup) return `${label}: "${acc.name}" समूह खाता है / Group account not allowed`;
  return null;
}
