/**
 * Procurement Phase-0.2 — repository & service PORTS. Method signatures only; no implementation.
 */
import type { ProcurementLot, Farmer, Arhtiya, JForm } from './entities';
import type { ProcurementEvent } from './events';
import type { ProcurementDocument } from './documents';

/** Generic persistence port. */
export interface Repository<T> {
  getById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  list(): Promise<T[]>;
}

export type LotRepository = Repository<ProcurementLot>;
export type FarmerRepository = Repository<Farmer>;
export type ArhtiyaRepository = Repository<Arhtiya>;
export type JFormRepository = Repository<JForm>;

/** Append-only event ledger port. */
export interface EventLedgerPort {
  append(event: ProcurementEvent): Promise<void>;
  byCorrelation(correlationId: string): Promise<ProcurementEvent[]>;
}

/** Immutable document store port. */
export interface DocumentStorePort {
  register(doc: ProcurementDocument): Promise<void>;
  byCorrelation(correlationId: string): Promise<ProcurementDocument[]>;
}

/** Procurement domain service port (Phase 1 implements). */
export interface ProcurementService {
  createLot(input: Omit<ProcurementLot, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcurementLot>;
  recordWeighment(lotId: string, netKg: number, bags: number): Promise<void>;
}
