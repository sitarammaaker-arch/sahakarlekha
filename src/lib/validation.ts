import type { LedgerAccount, SocietySettings, VoucherType } from '@/types';

// Cash and Bank account IDs — same as ACCOUNT_IDS in storage.ts
const CASH_ID = '3301';
const BANK_ID = '3302';
const CASH_BANK_FIXED = [CASH_ID, BANK_ID];

// Build full cash/bank set including user-created bank accounts (subtype: 'cash_bank')
function getCashBankIds(accounts: LedgerAccount[]): string[] {
  const extra = accounts.filter(a => a.subtype === 'cash_bank' || a.parentId === '3300').map(a => a.id);
  return [...new Set([...CASH_BANK_FIXED, ...extra])];
}

export interface VoucherValidationResult {
  valid: boolean;
  errors: string[];    // hard errors — block save
  warnings: string[];  // soft warnings — allow save with notice
}

/**
 * Double-entry validation engine — 6 rules
 *
 * Rule 1: Debit account must exist and not be a group account
 * Rule 2: Credit account must exist, not be a group account, and differ from debit
 * Rule 3: Opening balance direction (checked separately in SocietySetup)
 * Rule 4: Amount must be > 0
 * Rule 5: Date should be within the current financial year (soft warning)
 * Rule 6: Voucher type must match account side (Tally-style consistency)
 *   Receipt  → Dr must be Cash or Bank
 *   Payment  → Cr must be Cash or Bank
 *   Contra   → both Dr and Cr must be Cash or Bank
 *   Journal  → no restriction
 */
export function validateVoucher(
  debitAccountId: string,
  creditAccountId: string,
  amount: number | string,
  date: string,
  accounts: LedgerAccount[],
  society: SocietySettings,
  voucherType?: VoucherType,
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

  // ── Rule 6: Voucher type ↔ account consistency ────────────────────────────
  // Includes all user-created bank accounts (subtype cash_bank or under Current Assets 3300)
  if (voucherType && debitAccountId && creditAccountId) {
    const CASH_BANK = getCashBankIds(accounts);
    if (voucherType === 'receipt' && !CASH_BANK.includes(debitAccountId)) {
      const drAcc = accounts.find(a => a.id === debitAccountId);
      errors.push(
        `रसीद वाउचर में डेबिट खाता "हाथ में नकद" या "बैंक खाते" होना चाहिए / Receipt voucher: Debit must be Cash or Bank (got "${drAcc?.name || debitAccountId}")`
      );
    }
    if (voucherType === 'payment' && !CASH_BANK.includes(creditAccountId)) {
      const crAcc = accounts.find(a => a.id === creditAccountId);
      errors.push(
        `भुगतान वाउचर में क्रेडिट खाता "हाथ में नकद" या "बैंक खाते" होना चाहिए / Payment voucher: Credit must be Cash or Bank (got "${crAcc?.name || creditAccountId}")`
      );
    }
    if (voucherType === 'contra') {
      if (!CASH_BANK.includes(debitAccountId)) {
        errors.push('कोंट्रा वाउचर में डेबिट खाता Cash या Bank होना चाहिए / Contra: Debit must be Cash or Bank');
      }
      if (!CASH_BANK.includes(creditAccountId)) {
        errors.push('कोंट्रा वाउचर में क्रेडिट खाता Cash या Bank होना चाहिए / Contra: Credit must be Cash or Bank');
      }
    }
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
