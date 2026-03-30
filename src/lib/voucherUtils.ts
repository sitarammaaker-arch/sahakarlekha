import type { Voucher, VoucherLine } from '@/types';

/**
 * Returns the voucher lines array.
 * For new multi-line vouchers: returns v.lines
 * For legacy single-entry vouchers: synthesizes [{Dr}, {Cr}] from debitAccountId/creditAccountId
 */
export function getVoucherLines(v: Voucher): VoucherLine[] {
  if (v.lines && v.lines.length > 0) return v.lines;
  // Legacy synthesis
  const lines: VoucherLine[] = [];
  if (v.debitAccountId && v.amount > 0) {
    lines.push({ id: `${v.id}-dr`, accountId: v.debitAccountId, type: 'Dr', amount: v.amount });
  }
  if (v.creditAccountId && v.amount > 0) {
    lines.push({ id: `${v.id}-cr`, accountId: v.creditAccountId, type: 'Cr', amount: v.amount });
  }
  return lines;
}

export function voucherDrTotal(v: Voucher): number {
  return getVoucherLines(v).filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
}

export function voucherCrTotal(v: Voucher): number {
  return getVoucherLines(v).filter(l => l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
}

export function isMultiLine(v: Voucher): boolean {
  return !!(v.lines && v.lines.length > 2);
}
