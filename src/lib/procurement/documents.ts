/**
 * Procurement Phase-0.2 — Document & Compliance contracts. Interfaces ONLY.
 */
import type { BaseEntity, Correlated } from './shared';

export type ProcurementDocumentType =
  | 'jform' | 'iform' | '6r' | '9r' | 'weighmentSlip' | 'gatePass'
  | 'qualityCertificate' | 'releaseOrder' | 'acceptanceNote' | 'paymentAdvice' | 'settlementStatement';

/** A statutory document. Carries correlationId (refinement #2). */
export interface ProcurementDocument extends BaseEntity, Correlated {
  type: ProcurementDocumentType;
  documentNo: string;
  status: string;          // draft | signed | issued | revised | cancelled | archived
  currentVersion: number;
}

export interface DocumentVersion extends BaseEntity {
  documentId: string;
  version: number;
  hash: string;            // tamper-evidence
  signedBy?: string;
}
