/**
 * Ledger lines — the constrained, typed contract for money-material voucher lines, and the
 * transform that promotes loose JSONB lines onto it (T-05 / IRR-7, CA-10; Canonical CL-1/CL-3).
 *
 * PURE. Voucher lines live in an unconstrained JSONB `lines` column: `amount` is a rupee
 * float and any field may be missing, so nothing stops a malformed or unbalanced set from
 * being written — and you cannot retro-fit a CHECK constraint onto billions of historical
 * blobs. This module is the SSOT that fixes that at the two points that matter:
 *
 *   • a JSONB→typed BACKFILL runs `toTypedLines` over history;
 *   • a WRITE-TIME guard runs `toTypedLines` + `checkBalanced` before a voucher is persisted,
 *     so dirty money-material data is rejected, never stored.
 *
 * Amounts become EXACT integer paise via the money primitive (T-02) — a line's rupee float
 * never survives into the typed form. Dr/Cr is carried explicitly (CL-3): an amount is an
 * unsigned magnitude plus a side, never a signed number.
 */
import { type Minor, toMinor, sumMinor, isValidMinor } from './money';

export type DrCr = 'Dr' | 'Cr';

/** A voucher line in its CONSTRAINED, typed form — what a typed column enforces. */
export interface TypedLine {
  accountId: string;
  drCr: DrCr;
  /** Exact integer paise. Never a float. */
  amountMinor: Minor;
  narration?: string;
}

/** A loose line as it lives in the JSONB `lines` column — any field may be absent or wrong. */
export interface LooseLine {
  accountId?: unknown;
  type?: unknown; // 'Dr' | 'Cr'
  amount?: unknown; // rupees, possibly a float
  narration?: unknown;
}

export interface PromotionResult {
  lines: TypedLine[];
  /** One message per line that could NOT be promoted — the constraints JSONB never enforced. */
  problems: string[];
}

/**
 * PURE — promote loose JSONB lines to constrained, exact-money typed lines.
 *
 * Each line must have a non-empty accountId, a 'Dr'/'Cr' side, and a finite non-negative
 * amount (converted to exact paise). A line that fails is REPORTED, never silently coerced —
 * a money-material row you cannot trust is worse than one you refuse.
 */
export function toTypedLines(loose: readonly LooseLine[]): PromotionResult {
  const lines: TypedLine[] = [];
  const problems: string[] = [];
  loose.forEach((l, i) => {
    const where = `line ${i + 1}`;
    const accountId = typeof l.accountId === 'string' ? l.accountId.trim() : '';
    if (!accountId) { problems.push(`${where}: missing accountId`); return; }
    if (l.type !== 'Dr' && l.type !== 'Cr') { problems.push(`${where}: side must be 'Dr' or 'Cr'`); return; }
    const amt = Number(l.amount);
    if (!Number.isFinite(amt) || amt < 0) { problems.push(`${where}: amount must be a finite, non-negative number`); return; }
    lines.push({
      accountId,
      drCr: l.type,
      amountMinor: toMinor(amt),
      narration: typeof l.narration === 'string' ? l.narration : undefined,
    });
  });
  return { lines, problems };
}

export interface BalanceVerdict {
  ok: boolean;
  totalDrMinor: Minor;
  totalCrMinor: Minor;
  reasons: string[];
}

/**
 * PURE — the double-entry constraint a typed line-set must satisfy (Canonical CL-1): at least
 * one line, every amount a positive exact-paise value, and Σ Dr === Σ Cr. Because the sums are
 * integer paise (T-02), the balance is exact — no float drift decides whether books balance.
 */
export function checkBalanced(lines: readonly TypedLine[]): BalanceVerdict {
  const reasons: string[] = [];
  if (lines.length === 0) reasons.push('a voucher must have at least one line');

  const drs: Minor[] = [];
  const crs: Minor[] = [];
  for (const l of lines) {
    if (!isValidMinor(l.amountMinor)) { reasons.push(`${l.accountId}: amount is not exact minor units`); continue; }
    if (l.amountMinor <= 0) { reasons.push(`${l.accountId}: amount must be positive`); continue; }
    (l.drCr === 'Dr' ? drs : crs).push(l.amountMinor);
  }

  const totalDrMinor = sumMinor(drs);
  const totalCrMinor = sumMinor(crs);
  if (totalDrMinor !== totalCrMinor) reasons.push(`unbalanced: Dr ${totalDrMinor} ≠ Cr ${totalCrMinor} (paise)`);

  return { ok: reasons.length === 0, totalDrMinor, totalCrMinor, reasons };
}
