/**
 * Procurement Phase-0.2 — domain entities + the ProcurementLot aggregate root. Interfaces ONLY.
 */
import type { BaseEntity, Money, Percentage, Weight } from './shared';

/** Three orthogonal status dimensions (frozen blueprint). */
export type OperationalStatus =
  | 'created' | 'graded' | 'weighed' | 'bagged' | 'accepted' | 'rejected'
  | 'stacked' | 'dispatched' | 'deliveredAck' | 'closed';

export type FinancialStatus =
  | 'unbilled' | 'billed' | 'payable' | 'paid' | 'returned'
  | 'incidentalsBooked' | 'claimRaised' | 'reimbursed' | 'financiallyClosed';

export type ReconciliationStatus =
  | 'pending' | 'portalSynced' | 'bankConfirmed' | 'fciAccepted'
  | 'matched' | 'variance' | 'disputed' | 'resolved';

// ── Stakeholders ──
export interface Farmer extends BaseEntity { name: string; fatherName?: string; village?: string; bankAccount?: string; }
export interface Arhtiya extends BaseEntity { name: string; licenceNo: string; }
export interface Labour extends BaseEntity { name: string; }
export interface Transporter extends BaseEntity { name: string; vehicleNo?: string; }

// ── Operations ──
export interface QualityTest extends BaseEntity { lotId: string; result: string; inspectedBy: string; }
export interface MoistureRecord extends BaseEntity { lotId: string; moisture: Percentage; }
export interface WeighmentSlip extends BaseEntity { lotId: string; gross: Weight; tare: Weight; net: Weight; bags: number; }
export interface Bardana extends BaseEntity { typeId: string; lotId?: string; status: string; }
export interface Deduction extends BaseEntity { lotId: string; ruleId: string; amount: Money; }

// ── Settlement ──
export interface JForm extends BaseEntity { lotId: string; documentNo: string; gross: Money; deductions: Money; net: Money; }
export interface FarmerPayment extends BaseEntity { jformId: string; amount: Money; status: string; reference?: string; }
export interface CommissionBill extends BaseEntity { arhtiyaId: string; amount: Money; }
export interface Claim extends BaseEntity { agencyId: string; amount: Money; }
export interface Recoverable extends BaseEntity { partyId: string; amount: Money; }

// ── Aggregate root ──
export interface ProcurementLot extends BaseEntity {
  centreId: string;
  seasonId: string;
  cropId: string;
  varietyId?: string;
  farmerId: string;
  arhtiyaId?: string;
  operationalStatus: OperationalStatus;
  financialStatus: FinancialStatus;
  reconciliationStatus: ReconciliationStatus;
}
