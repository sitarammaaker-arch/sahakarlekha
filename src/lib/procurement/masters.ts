/**
 * Procurement Phase-0.2 — configuration / master-data contracts. Interfaces ONLY.
 */
import type { BaseEntity, Money, Percentage } from './shared';

export interface Season extends BaseEntity {
  name: string;
  cropYear: string;
  startDate: string;
  endDate: string;
}

export interface Agency extends BaseEntity {
  name: string;
  code: string;
  kind: string;            // FCI | HAFED | MARKFED | state
}

export interface ProcurementCentre extends BaseEntity {
  name: string;
  code: string;
  agencyId: string;
}

export interface Crop extends BaseEntity {
  name: string;
  code: string;
}

export interface Variety extends BaseEntity {
  cropId: string;
  name: string;
}

export interface MSPRate extends BaseEntity {
  cropId: string;
  seasonId: string;
  rate: Money;
  effectiveFrom: string;
}

export interface QualitySpec extends BaseEntity {
  cropId: string;
  seasonId: string;
  parameter: string;
  maxLimit: number;
}

export interface DeductionRule extends BaseEntity {
  code: string;
  basis: string;           // quality | levy | shortage
  rate: Percentage;
}

export interface BardanaType extends BaseEntity {
  name: string;
  capacityKg: number;
}

/**
 * Maps a financial intent (+ accounting profile) to ledger account selectors. `intent` and
 * `profile` are the string forms of FinancialIntentName / AccountingProfile — kept as strings
 * here to avoid a config → financial dependency.
 */
export interface AccountMapping extends BaseEntity {
  intent: string;
  profile: string;
  debitAccountSelector: string;
  creditAccountSelector: string;
}
