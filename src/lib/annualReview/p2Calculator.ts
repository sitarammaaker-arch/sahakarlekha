/**
 * Proforma 2 Calculator — Recoverable Position
 *
 * Aggregates Recoverable rows (for the chosen FY) into:
 *   A) Opening balance by category
 *   B) Additions during the year by category
 *   C) Recoveries during the year by category
 *   D) Balance recoverable at year-end split by legal stage
 */
import type { Recoverable, RecoverableCategory, RecoverableLegalStage } from '@/types';

export interface P2CategorySplit {
  fertPesticide: number;
  advance: number;
  embezzlement: number;
  other: number;
}

export interface P2LegalStageSplit {
  police: number;
  arbitration: number;
  execution: number;
  award: number;
  confirmed: number;
  unconfirmed: number;
  none: number;  // closing balance NOT yet escalated (shown under "Others")
}

export interface P2Result {
  opening: P2CategorySplit;
  openingTotal: number;
  additions: P2CategorySplit;
  additionsTotal: number;
  recoveries: P2CategorySplit;
  recoveriesTotal: number;
  // Closing = opening + additions − recoveries
  closing: P2CategorySplit;
  closingTotal: number;
  // Section D — closing balance split by legal stage
  legalStage: P2LegalStageSplit;
  legalStageTotal: number;  // should equal closingTotal
}

export interface P2Inputs {
  recoverables: Recoverable[];
  fyStartDate: string;      // e.g. '2024-04-01' — matches Recoverable.fyStartDate
}

const emptyCat = (): P2CategorySplit => ({ fertPesticide: 0, advance: 0, embezzlement: 0, other: 0 });
const emptyStage = (): P2LegalStageSplit => ({ police: 0, arbitration: 0, execution: 0, award: 0, confirmed: 0, unconfirmed: 0, none: 0 });

export function calculateP2(input: P2Inputs): P2Result {
  const { recoverables, fyStartDate } = input;
  const rows = recoverables.filter(r => !r.isDeleted && r.fyStartDate === fyStartDate);

  const opening = emptyCat();
  const additions = emptyCat();
  const recoveries = emptyCat();
  const closing = emptyCat();
  const legalStage = emptyStage();

  for (const r of rows) {
    const cat = r.category as RecoverableCategory;
    opening[cat]    += r.openingBalance || 0;
    additions[cat]  += r.additions || 0;
    recoveries[cat] += r.recoveries || 0;
    const bal = (r.openingBalance || 0) + (r.additions || 0) - (r.recoveries || 0);
    closing[cat]    += bal;
    const stage = (r.legalStage || 'none') as RecoverableLegalStage;
    legalStage[stage] += bal;
  }

  const sum = (c: P2CategorySplit) => c.fertPesticide + c.advance + c.embezzlement + c.other;

  return {
    opening,       openingTotal:    sum(opening),
    additions,     additionsTotal:  sum(additions),
    recoveries,    recoveriesTotal: sum(recoveries),
    closing,       closingTotal:    sum(closing),
    legalStage,
    legalStageTotal: Object.values(legalStage).reduce((a, b) => a + b, 0),
  };
}

export const RECOVERABLE_CATEGORY_LABELS: Record<RecoverableCategory, string> = {
  fertPesticide: 'Fertilizer & Pesticide Outstanding',
  advance:       'Advances',
  embezzlement:  'Embezzlements (If Any)',
  other:         'Others (if any)',
};

export const RECOVERABLE_STAGE_LABELS: Record<RecoverableLegalStage, string> = {
  none:        'Not Escalated',
  police:      'Cases with police',
  arbitration: 'Cases in arbitration',
  execution:   'Cases under execution',
  award:       'Award taken but not sent to execution',
  confirmed:   'Others — Confirmed',
  unconfirmed: 'Others — Un-confirmed',
};
