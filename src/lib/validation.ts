import type { LedgerAccount, SocietySettings, VoucherType, VoucherLine } from '@/types';
import { toMinor, toRupees, addMinor, subMinor } from '@/lib/money';
import { tr } from '@/lib/uiLang';

// Cash and Bank account IDs — same as ACCOUNT_IDS in storage.ts
const CASH_ID = '3301';
const BANK_ID = '3302';
const CASH_BANK_FIXED = [CASH_ID, BANK_ID];

// Build full cash/bank set including user-created bank accounts
// Includes: subtype cash_bank, parentId 3300 (Current Assets), parentId 3301 (Cash sub-accounts),
// parentId 3302 (Bank sub-accounts), or any account whose parent is Cash/Bank
function getCashBankIds(accounts: LedgerAccount[]): string[] {
  const cashBankParents = new Set([CASH_ID, BANK_ID, '3300']);
  const extra = accounts.filter(a =>
    a.subtype === 'cash_bank' ||
    (a.parentId && cashBankParents.has(a.parentId))
  ).map(a => a.id);
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
 * Rule 7: Double-entry balance — when multi-line `lines` are supplied, total Dr
 *   must equal total Cr (NCDC: "every debit must have a corresponding credit").
 */
export function validateVoucher(
  debitAccountId: string,
  creditAccountId: string,
  amount: number | string,
  date: string,
  accounts: LedgerAccount[],
  society: SocietySettings,
  voucherType?: VoucherType,
  lines?: VoucherLine[],
): VoucherValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const numAmount = Number(amount);

  // ── Rule 4: Amount ────────────────────────────────────────────────────────
  if (!amount || isNaN(numAmount) || numAmount <= 0) {
    errors.push(
      tr('राशि शून्य से अधिक होनी चाहिए / Amount must be greater than zero', 'Amount must be greater than zero')
    );
  }

  // ── Rule 1: Debit account ─────────────────────────────────────────────────
  if (!debitAccountId) {
    errors.push(tr('डेबिट खाता चुनें / Select debit account', 'Select debit account'));
  } else {
    const drAcc = accounts.find(a => a.id === debitAccountId);
    if (!drAcc) {
      errors.push(
        tr(`डेबिट खाता (ID: ${debitAccountId}) मौजूद नहीं — खाता हटाया जा सकता है / Debit account not found`, `Debit account (ID: ${debitAccountId}) not found — it may have been deleted`)
      );
    } else if (drAcc.isGroup) {
      errors.push(
        tr(`"${drAcc.name}" एक समूह खाता है — इसमें सीधे एंट्री नहीं हो सकती / "${drAcc.name}" is a group account, cannot post transactions`, `"${drAcc.name}" is a group account, cannot post transactions`)
      );
    }
  }

  // ── Rule 2: Credit account ────────────────────────────────────────────────
  if (!creditAccountId) {
    errors.push(tr('क्रेडिट खाता चुनें / Select credit account', 'Select credit account'));
  } else {
    const crAcc = accounts.find(a => a.id === creditAccountId);
    if (!crAcc) {
      errors.push(
        tr(`क्रेडिट खाता (ID: ${creditAccountId}) मौजूद नहीं — खाता हटाया जा सकता है / Credit account not found`, `Credit account (ID: ${creditAccountId}) not found — it may have been deleted`)
      );
    } else if (crAcc.isGroup) {
      errors.push(
        tr(`"${crAcc.name}" एक समूह खाता है — इसमें सीधे एंट्री नहीं हो सकती / "${crAcc.name}" is a group account, cannot post transactions`, `"${crAcc.name}" is a group account, cannot post transactions`)
      );
    }
  }

  // Dr ≠ Cr
  if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
    errors.push(
      tr('डेबिट और क्रेडिट खाता एक नहीं हो सकते / Debit and Credit accounts must be different', 'Debit and Credit accounts must be different')
    );
  }

  // ── Rule 6: Voucher type ↔ account consistency ────────────────────────────
  // Includes all user-created bank accounts (subtype cash_bank or under Current Assets 3300)
  if (voucherType && debitAccountId && creditAccountId) {
    const CASH_BANK = getCashBankIds(accounts);
    if (voucherType === 'receipt' && !CASH_BANK.includes(debitAccountId)) {
      const drAcc = accounts.find(a => a.id === debitAccountId);
      errors.push(
        tr(`रसीद वाउचर में डेबिट खाता "हाथ में नकद" या "बैंक खाते" होना चाहिए / Receipt voucher: Debit must be Cash or Bank (got "${drAcc?.name || debitAccountId}")`, `Receipt voucher: Debit must be Cash or Bank (got "${drAcc?.name || debitAccountId}")`)
      );
    }
    if (voucherType === 'payment' && !CASH_BANK.includes(creditAccountId)) {
      const crAcc = accounts.find(a => a.id === creditAccountId);
      errors.push(
        tr(`भुगतान वाउचर में क्रेडिट खाता "हाथ में नकद" या "बैंक खाते" होना चाहिए / Payment voucher: Credit must be Cash or Bank (got "${crAcc?.name || creditAccountId}")`, `Payment voucher: Credit must be Cash or Bank (got "${crAcc?.name || creditAccountId}")`)
      );
    }
    if (voucherType === 'contra') {
      if (!CASH_BANK.includes(debitAccountId)) {
        errors.push(tr('कोंट्रा वाउचर में डेबिट खाता Cash या Bank होना चाहिए / Contra: Debit must be Cash or Bank', 'Contra: Debit must be Cash or Bank'));
      }
      if (!CASH_BANK.includes(creditAccountId)) {
        errors.push(tr('कोंट्रा वाउचर में क्रेडिट खाता Cash या Bank होना चाहिए / Contra: Credit must be Cash or Bank', 'Contra: Credit must be Cash or Bank'));
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
          tr(`तिथि (${date}) वित्तीय वर्ष ${fy} (${fyStart} से ${fyEnd}) से बाहर है / Date is outside financial year ${fy}`, `Date (${date}) is outside financial year ${fy} (${fyStart} to ${fyEnd})`)
        );
      }
    }
  }

  // ── Rule 7: Double-entry balance (multi-line vouchers) ───────────────────
  // NCDC: "every debit must have a corresponding credit and vice-versa".
  // Only checked when explicit lines are supplied (Expert / compound mode);
  // legacy single Dr/Cr vouchers are balanced by construction.
  if (lines && lines.length > 0) {
    const bal = voucherLinesBalance(lines);
    if (!bal.balanced) {
      errors.push(
        tr(
          `वाउचर असंतुलित है: डेबिट (₹${bal.drTotal.toFixed(2)}) ≠ क्रेडिट (₹${bal.crTotal.toFixed(2)}) / ` +
          `Voucher not balanced: Dr ≠ Cr (difference ₹${bal.diff.toFixed(2)})`,
          `Voucher not balanced: Dr (₹${bal.drTotal.toFixed(2)}) ≠ Cr (₹${bal.crTotal.toFixed(2)}) (difference ₹${bal.diff.toFixed(2)})`,
        )
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Compute Dr/Cr totals for a set of voucher lines and report whether they balance.
 * Tolerance is 0.01 (one paisa) to absorb floating-point rounding from
 * pro-rated GST/TDS splits. This is the single source of truth for the
 * double-entry balance check enforced at every voucher save path.
 */
export function voucherLinesBalance(lines: VoucherLine[]): {
  drTotal: number; crTotal: number; diff: number; balanced: boolean;
} {
  const drTotal = lines.filter(l => l.type === 'Dr').reduce((s, l) => s + (l.amount || 0), 0);
  const crTotal = lines.filter(l => l.type === 'Cr').reduce((s, l) => s + (l.amount || 0), 0);
  const diff = Math.abs(drTotal - crTotal);
  return { drTotal, crTotal, diff, balanced: diff < 0.01 };
}

/**
 * Sub-rupee residual (< ₹1, rounding from pro-rated GST/TDS splits) → added to the LARGEST line on the deficient
 * side, so the voucher tallies EXACTLY (standard rounding adjustment). A difference of ₹1 or more is left alone —
 * that is a real error the caller must refuse. ONE rule for a new voucher and an edit (2026-10-11: the edit path
 * let a sub-rupee gap through on the legacy client path, which the server's paise-exact check then refused).
 */
export function snapSubRupeeResidual(lines: VoucherLine[]): VoucherLine[] {
  const bal = voucherLinesBalance(lines);
  if (bal.balanced || bal.diff >= 1) return lines;
  const residual = toRupees(subMinor(toMinor(bal.drTotal), toMinor(bal.crTotal))); // >0 ⇒ Dr-heavy
  const side: 'Dr' | 'Cr' = residual > 0 ? 'Cr' : 'Dr';   // add to the deficient side
  let idx = -1, max = -Infinity;
  lines.forEach((l, i) => { if (l.type === side && l.amount > max) { max = l.amount; idx = i; } });
  if (idx < 0) return lines;
  return lines.map((l, i) => i === idx ? { ...l, amount: toRupees(addMinor(toMinor(l.amount), toMinor(Math.abs(residual)))) } : l);
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
  if (!accountId) return tr(`${label}: खाता चुनें / Select account`, `${label}: Select account`);
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return tr(`${label}: खाता (${accountId}) मौजूद नहीं / Account not found`, `${label}: Account (${accountId}) not found`);
  if (acc.isGroup) return tr(`${label}: "${acc.name}" समूह खाता है / Group account not allowed`, `${label}: "${acc.name}" is a group account — not allowed`);
  return null;
}
