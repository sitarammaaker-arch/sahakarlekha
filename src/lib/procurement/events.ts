/**
 * Procurement Phase-0.2 — immutable event contracts (Event Ledger).
 * Types ONLY — no dispatcher, no bus, no implementation.
 */
import type { Correlated, Money } from './shared';

export type ProcurementEventName =
  | 'lot.created' | 'quality.tested' | 'moisture.recorded' | 'lot.accepted' | 'lot.rejected'
  | 'weighed' | 'bagged' | 'deductions.applied' | 'jform.generated' | 'jform.signed'
  | 'payment.initiated' | 'payment.confirmed' | 'payment.returned' | 'commission.computed'
  | 'stacked' | 'dispatched' | 'fci.accepted' | 'settled' | 'reconciled'
  | 'recoverable.raised' | 'recoverable.recovered' | 'override.applied' | 'document.issued'
  | 'financial.intent.created' | 'posting.request.created' | 'posting.rule.resolved'
  | 'engine.voucher.created' | 'settlement.approved';

/** Append-only event. Carries correlationId (refinement #2). */
export interface ProcurementEvent<TPayload = unknown> extends Correlated {
  id: string;
  name: ProcurementEventName;
  occurredAt: string;   // business timestamp
  recordedAt: string;   // server timestamp
  actor: string;        // who (user / role)
  payload: TPayload;
}

// ── Representative payload contracts (others follow the same shape) ──
export interface LotCreatedPayload { centreId: string; farmerId: string; cropId: string; seasonId: string; }
export interface QualityTestedPayload { result: string; }
export interface WeighedPayload { netKg: number; bags: number; }
export interface JFormGeneratedPayload { jformId: string; documentNo: string; net: Money; }
export interface PaymentConfirmedPayload { paymentId: string; reference: string; }
export interface FinancialIntentCreatedPayload { intentId: string; jformId: string; amount: Money; }
export interface PostingRequestCreatedPayload { postingRequestId: string; financialIntentId: string; amount: Money; }
export interface PostingRuleResolvedPayload { postingRuleResultId: string; postingRequestId: string; legCount: number; }
export interface EngineVoucherCreatedPayload { voucherId: string; voucherNo: string; postingRuleResultId: string; }
