/**
 * Prepare-only payment instructions (T-28 / API Constitution Art. VII, API-P8; BANK-1, AUTH-6).
 *
 * PURE. The governing sentence of banking integration: SahakarLekha RECONCILES and PREPARES;
 * regulated rails and humans MOVE money. This module prepares a payment instruction and gates it
 * behind human authority + SoD — and DELIBERATELY offers NO execute/settle path. There is no
 * PaymentStatus beyond 'authorized': money movement executes on the regulated rail (NPCI/RBI),
 * under explicit human authorization, OUTSIDE this system. SahakarLekha is a system of record, not
 * a payment service provider or money custodian (BANK-1/API-P8).
 *
 * Exact money with explicit currency (BANK-2/ADR-0006); the beneficiary is an opaque reference, so
 * no account number/PII travels in the clear (API-P6). No I/O; deterministic.
 */
import { type Minor, isValidMinor } from '../../money';

export type PaymentRail = 'UPI' | 'NEFT' | 'RTGS' | 'IMPS' | 'BBPS';
const RAILS: ReadonlySet<string> = new Set(['UPI', 'NEFT', 'RTGS', 'IMPS', 'BBPS']);

/** The ONLY statuses. There is intentionally no 'executed'/'settled' — see the module header. */
export type PaymentStatus = 'prepared' | 'authorized';

export interface PaymentInstruction {
  id: string;
  tenantId: string;
  rail: PaymentRail;
  amountMinor: Minor;
  currency: string;
  /** An opaque beneficiary reference (a vaulted token / mandate id), NOT a raw account number (API-P6). */
  beneficiaryRef: string;
  status: PaymentStatus;
  preparedBy: string;
  /** The human who authorized it (set at authorize; SoD ≠ preparedBy). */
  authorizedBy?: string;
}

export interface PreparePaymentInput {
  id: string;
  tenantId: string;
  rail: PaymentRail;
  amountMinor: Minor;
  currency?: string;
  beneficiaryRef: string;
  preparedBy: string;
}

/**
 * PURE — prepare a payment instruction. Starts in 'prepared'; it is NOT execution — nothing moves
 * money here (BANK-1/API-P8). Throws on a malformed instruction (bad rail, non-positive amount,
 * missing beneficiary/preparer): a wrong prepared payment is worse than a rejected one.
 */
export function preparePaymentInstruction(input: PreparePaymentInput): PaymentInstruction {
  const req = (v: unknown, name: string) => {
    if (typeof v !== 'string' || v.trim().length === 0) throw new RangeError(`payment: ${name} is required`);
  };
  req(input.id, 'id');
  req(input.tenantId, 'tenantId');
  req(input.beneficiaryRef, 'beneficiaryRef');
  req(input.preparedBy, 'preparedBy');
  if (!RAILS.has(input.rail)) throw new RangeError(`payment: rail must be one of ${[...RAILS].join('/')}`);
  if (!isValidMinor(input.amountMinor) || input.amountMinor <= 0) {
    throw new RangeError('payment: amountMinor must be a positive minor-unit integer');
  }
  return {
    id: input.id,
    tenantId: input.tenantId,
    rail: input.rail,
    amountMinor: input.amountMinor,
    currency: input.currency ?? 'INR',
    beneficiaryRef: input.beneficiaryRef,
    status: 'prepared',
    preparedBy: input.preparedBy,
  };
}

export interface PaymentAuthzResult {
  ok: boolean;
  instruction?: PaymentInstruction;
  reason?: string;
}

/** The authorizing officer — must be human for a money-movement authorization (API-P8/AUTH-6). */
export interface PaymentOfficer {
  id: string;
  isHuman: boolean;
}

/**
 * PURE — authorize a prepared payment under HUMAN authority + SoD. Refused unless the instruction is
 * 'prepared', the officer is human, and the officer is INDEPENDENT of the preparer (preparer ≠
 * authorizer, AUTH-6). Authorizing does NOT move money — it hands the instruction to the regulated
 * rail; execution is a human action outside this system (API-P8).
 */
export function authorizePayment(instr: PaymentInstruction, officer: PaymentOfficer): PaymentAuthzResult {
  if (instr.status !== 'prepared') return { ok: false, reason: `only a prepared instruction can be authorized (is "${instr.status}")` };
  if (!officer.isHuman || !officer.id) return { ok: false, reason: 'a payment requires a human authorizer — never autonomous (API-P8)' };
  if (officer.id === instr.preparedBy) return { ok: false, reason: 'separation of duties: the preparer cannot authorize the payment (AUTH-6)' };
  return { ok: true, instruction: { ...instr, status: 'authorized', authorizedBy: officer.id } };
}
