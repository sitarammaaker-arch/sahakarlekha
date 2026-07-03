/**
 * Procurement Phase-0.2 — configuration / master-data contracts. Interfaces ONLY.
 */
import type { BaseEntity, Money, Percentage } from './shared';

export interface Season extends BaseEntity {
  name: string;
  cropYear: string;
  startDate: string;
  endDate: string;
  nameHi?: string;         // Hindi label; optional, additive
}

export interface Agency extends BaseEntity {
  name: string;
  code: string;
  kind: string;            // FCI | HAFED | MARKFED | state
  nameHi?: string;         // Hindi label; optional, additive
}

export interface ProcurementCentre extends BaseEntity {
  name: string;
  code: string;
  agencyId: string;
  nameHi?: string;         // Hindi label; optional, additive
}

export interface Crop extends BaseEntity {
  name: string;
  code: string;
  nameHi?: string;         // Hindi label (Hindi-first UI); optional, additive
}

export interface Variety extends BaseEntity {
  cropId: string;
  name: string;
  nameHi?: string;         // Hindi label; optional, additive
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
  basis: string;           // e.g. market_fee | hrdf | labour | shortage | commission | other
  rate: Percentage;        // % of gross
  accountId?: string;      // dedicated ledger the deduction CREDITS at settlement (M3b); optional
  name?: string;           // friendly label; optional, additive
  nameHi?: string;         // Hindi label; optional, additive
}

export interface BardanaType extends BaseEntity {
  name: string;
  capacityKg: number;
  nameHi?: string;         // Hindi label; optional, additive
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
