/**
 * Approval matrix (ECR-11). Decides whether a MANUAL voucher must be held for maker-checker
 * approval before it posts to the ledger. Extracted from DataContext into a first-class pure
 * module so the matrix can grow along its axes (amount → type → role) with unit coverage.
 *
 * Rules (OR — any match holds the voucher):
 *   • all-manual flag   — society.approvalRequired: every manual voucher needs approval.
 *   • amount threshold  — amount ≥ society.approvalThresholdAmount (> 0).
 *   • voucher type      — the voucher's type is in society.approvalVoucherTypes (regardless of
 *                         amount) — e.g. "every journal / contra must be checked".
 *
 * Only origin==='manual' vouchers are ever subject to this (auto/engine vouchers bypass — that
 * decision stays at the single caller in DataContext). Default config (nothing set) → never
 * holds anything, so behaviour is unchanged for societies that never opted in.
 *
 * Pure module: no React, no I/O — unit-tested by scripts/test-approval-matrix.mjs.
 */
import type { VoucherType } from '@/types';

export interface ApprovalMatrix {
  approvalRequired?: boolean;      // all-manual flag
  threshold?: number;             // amount ≥ threshold needs approval (> 0 to be active)
  types?: readonly VoucherType[]; // voucher types that always need approval
}

/** Does a manual voucher of `amount` and `type` need approval under `opts`? */
export function requiresApproval(amount: number, type: VoucherType | undefined, opts: ApprovalMatrix): boolean {
  if (opts.approvalRequired) return true;
  if (opts.threshold && opts.threshold > 0 && (amount || 0) >= opts.threshold) return true;
  if (type && opts.types && opts.types.includes(type)) return true;
  return false;
}
