/**
 * ExecutionContext — the immutable, per-employee input the calculation kernel consumes (Phase-5 §4,
 * Phase-8). PURE contract + a completeness/shape validator. No I/O, no clock (the period-anchored
 * `asOf` is INJECTED).
 *
 * The kernel receives ONLY this and nothing else — that is what makes calculation pure and
 * replayable. The context is assembled by the resolver ring and frozen at the snapshot boundary
 * (Phase-5/7); by the time it reaches the kernel every slice must be present. A partial context is
 * a refusal, never a guess (refuse-over-guess) — `assertExecutionContext` throws on any gap.
 *
 * PII-minimal: identity carries ids only (employeeId + a stable pseudonymId), never PAN/Aadhaar/bank.
 *
 * Reuse: `Minor` (integer paise) is a type-only import from money.ts — one money type, no duplicate.
 */

import type { Minor } from '@/lib/money';

const PERIOD_RE = /^[0-9]{4}-(0[1-9]|1[0-2])$/; // YYYY-MM
const FY_RE = /^[0-9]{4}-[0-9]{2}$/; // YYYY-YY (e.g. 2026-27)

export interface EcIdentity {
  employeeId: string;
  /** Stable id that survives PII erasure (financial history stays attributable). */
  pseudonymId: string;
  period: string; // YYYY-MM
  fy: string; // YYYY-YY
}

export interface EcPlacement {
  orgId: string;
  branchId?: string | null;
  departmentId: string;
  cadreId?: string | null;
  designationId: string;
  payLevel?: string | null;
  employmentType: string;
}

export interface EcAttendance {
  paidDays: number;
  lopDays: number;
  otHours: number;
}
export interface EcLeaveBalance {
  type: string;
  balance: number;
}
export interface EcLoanRecovery {
  loanId: string;
  amountMinor: Minor;
}
export interface EcTax {
  /** YTD amounts per statutory head, for cumulative computation (inputs only — not the calc). */
  ytdByHead: Record<string, Minor>;
  monthsRemaining: number;
  regime: string;
}
export interface EcFacts {
  attendance: EcAttendance;
  leave: EcLeaveBalance[];
  loan: EcLoanRecovery[];
  tax: EcTax;
}

export interface EcSnapshotRefs {
  snapshotId: string;
  schemaVersion: number;
}

export interface EcStructure {
  components: { componentId: string; code: string }[];
  bindings: unknown[];
  overrides: unknown[];
}

export interface ExecutionContext {
  identity: EcIdentity;
  placement: EcPlacement;
  facts: EcFacts;
  snapshotRefs: EcSnapshotRefs;
  /** Frozen resolved slices (Phase-7). Opaque here; their shape is validated by the resolver. */
  ruleView: unknown;
  policyView: unknown;
  configView: unknown;
  formulaPlan: unknown;
  structure: EcStructure;
  /** Injected period-anchored "as-of" (ISO date) — NOT the wall clock. */
  asOf: string;
}

/**
 * PURE — validate that a context is COMPLETE and well-shaped before the kernel consumes it. Throws
 * on the first gap (a partial context is a refusal). Returns the context on success (for chaining).
 */
export function assertExecutionContext(ctx: ExecutionContext): ExecutionContext {
  const reqStr = (v: unknown, name: string) => {
    if (typeof v !== 'string' || v.trim().length === 0) throw new RangeError(`ExecutionContext: ${name} is required`);
  };
  const reqNum = (v: unknown, name: string, min = 0) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min) throw new RangeError(`ExecutionContext: ${name} must be a number >= ${min}`);
  };
  const present = (v: unknown, name: string) => {
    if (v === undefined || v === null) throw new RangeError(`ExecutionContext: ${name} is required (context must be frozen/complete)`);
  };

  if (!ctx || typeof ctx !== 'object') throw new RangeError('ExecutionContext: missing');

  // identity
  present(ctx.identity, 'identity');
  reqStr(ctx.identity.employeeId, 'identity.employeeId');
  reqStr(ctx.identity.pseudonymId, 'identity.pseudonymId');
  if (!PERIOD_RE.test(ctx.identity.period ?? '')) throw new RangeError('ExecutionContext: identity.period must be YYYY-MM');
  if (!FY_RE.test(ctx.identity.fy ?? '')) throw new RangeError('ExecutionContext: identity.fy must be YYYY-YY');

  // placement
  present(ctx.placement, 'placement');
  reqStr(ctx.placement.orgId, 'placement.orgId');
  reqStr(ctx.placement.departmentId, 'placement.departmentId');
  reqStr(ctx.placement.designationId, 'placement.designationId');
  reqStr(ctx.placement.employmentType, 'placement.employmentType');

  // facts
  present(ctx.facts, 'facts');
  present(ctx.facts.attendance, 'facts.attendance');
  reqNum(ctx.facts.attendance.paidDays, 'facts.attendance.paidDays');
  reqNum(ctx.facts.attendance.lopDays, 'facts.attendance.lopDays');
  reqNum(ctx.facts.attendance.otHours, 'facts.attendance.otHours');
  if (!Array.isArray(ctx.facts.leave)) throw new RangeError('ExecutionContext: facts.leave must be an array');
  if (!Array.isArray(ctx.facts.loan)) throw new RangeError('ExecutionContext: facts.loan must be an array');
  present(ctx.facts.tax, 'facts.tax');
  present(ctx.facts.tax.ytdByHead, 'facts.tax.ytdByHead');
  reqNum(ctx.facts.tax.monthsRemaining, 'facts.tax.monthsRemaining');
  reqStr(ctx.facts.tax.regime, 'facts.tax.regime');

  // snapshot refs
  present(ctx.snapshotRefs, 'snapshotRefs');
  reqStr(ctx.snapshotRefs.snapshotId, 'snapshotRefs.snapshotId');
  reqNum(ctx.snapshotRefs.schemaVersion, 'snapshotRefs.schemaVersion', 1);

  // frozen resolved slices must all be present (refuse-over-guess)
  present(ctx.ruleView, 'ruleView');
  present(ctx.policyView, 'policyView');
  present(ctx.configView, 'configView');
  present(ctx.formulaPlan, 'formulaPlan');

  // structure
  present(ctx.structure, 'structure');
  if (!Array.isArray(ctx.structure.components) || ctx.structure.components.length === 0) {
    throw new RangeError('ExecutionContext: structure.components must be a non-empty array');
  }

  reqStr(ctx.asOf, 'asOf');
  return ctx;
}

/** PURE — is the context complete/valid? (assert, but boolean.) */
export function isExecutionContextComplete(ctx: ExecutionContext): boolean {
  try {
    assertExecutionContext(ctx);
    return true;
  } catch {
    return false;
  }
}
