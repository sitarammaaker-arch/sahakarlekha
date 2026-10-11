/**
 * Account roles that decide which SIDE a balance naturally sits on. PURE, no imports (used by node tests directly).
 */

/** A fixed asset's accumulated-depreciation contra ledger (natural Cr on an asset). Prod (2026-10-11): subtype
 *  'accumulated_dep' on 145 ledgers; 15 older ones carry no subtype but the standard ids 3108–3112. */
const ACCUM_DEP_IDS = new Set(['3108', '3109', '3110', '3111', '3112']);
export const isAccumulatedDepreciation = (a: { id: string; type: string; subtype?: string; isGroup?: boolean }): boolean =>
  !a.isGroup && a.type === 'asset' && (a.subtype === 'accumulated_dep' || a.subtype === 'accumulated_depreciation' || ACCUM_DEP_IDS.has(a.id));

/** The side an account's balance normally sits on, by type. */
export const naturalOpeningSide = (type: string): 'debit' | 'credit' => (type === 'asset' || type === 'expense' ? 'debit' : 'credit');

/** Ledgers whose balance legitimately sits on the "other" side: the depreciation contra (Cr), the P&L balance 1208
 *  (a deficit is Dr), 1211 Dividend Distribution (a Dr contra of reserves) and the round-off ledger. */
export const isLegitContraSide = (a: { id: string; type: string; subtype?: string; isGroup?: boolean }): boolean =>
  isAccumulatedDepreciation(a) || a.subtype === 'surplus' || a.id === '1208' || a.id === '1211' || a.subtype === 'round_off';
