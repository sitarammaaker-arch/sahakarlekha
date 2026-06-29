/**
 * Procurement Phase-0.2 — shared value objects & base contracts.
 * Compile-time TYPES ONLY (no runtime behaviour, no functions). Faithful to the frozen
 * Procurement ERP Blueprint v1.2.
 */

/**
 * Currency-tagged monetary amount — v1.2 multi-currency guardrail (never a bare number).
 * Now defined in the shared posting core and re-exported here so existing procurement
 * imports (`import { Money } from './shared'`) keep working unchanged.
 */
export type { Money } from '@/lib/posting/types';

/** A measured quantity with an explicit unit. */
export interface Quantity {
  value: number;
  unit: string;       // e.g. 'qtl' | 'kg' | 'bag'
}

/** A weight with an explicit unit. */
export interface Weight {
  value: number;
  unit: 'kg' | 'qtl' | 'mt';
}

/** A percentage value (0–100). */
export interface Percentage {
  value: number;
}

/** Refinement #1 — lightweight base that every long-lived business entity extends. No behaviour. */
export interface BaseEntity {
  id: string;
  createdAt: string;   // ISO timestamp
  updatedAt: string;   // ISO timestamp
}

/** Refinement #2 — carried by every event & document for traceability (reserved field only). */
export interface Correlated {
  correlationId: string;   // typically the ProcurementLot id
}
