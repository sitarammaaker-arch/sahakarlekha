/**
 * Unified statutory reconciliation (ECR-14, bounded slice).
 *
 * The app computes PF/ESI in two separate places: salaried employees (SalaryRecord
 * in DataContext) and daily-wage labour (muster → LabourDataContext.computePfEsi).
 * This is a READ-ONLY combined view for a period — it does NOT merge the two write
 * paths (that stays deferred). Pure & tested by
 * scripts/test-statutory-reconciliation.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface StatutoryLine {
  gross: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
}
export interface ReconRow extends StatutoryLine {
  source: 'salaried' | 'labour';
  count: number; // employees / workers contributing
}
export interface StatutoryTotals extends StatutoryLine {
  pfTotal: number;  // employee + employer PF (the challan figure)
  esiTotal: number; // employee + employer ESI
  count: number;
}
export interface StatutoryReconciliation {
  rows: ReconRow[];
  totals: StatutoryTotals;
}

/** Combine per-source statutory rows into a grand total. */
export function reconcileStatutory(rows: ReconRow[]): StatutoryReconciliation {
  const sum = (k: keyof StatutoryLine) => r2(rows.reduce((s, r) => s + (r[k] || 0), 0));
  const pfEmployee = sum('pfEmployee'), pfEmployer = sum('pfEmployer');
  const esiEmployee = sum('esiEmployee'), esiEmployer = sum('esiEmployer');
  return {
    rows,
    totals: {
      gross: sum('gross'),
      pfEmployee, pfEmployer, esiEmployee, esiEmployer,
      pfTotal: r2(pfEmployee + pfEmployer),
      esiTotal: r2(esiEmployee + esiEmployer),
      count: rows.reduce((s, r) => s + (r.count || 0), 0),
    },
  };
}

/** Build the salaried row from that period's SalaryRecords. */
export function salariedRow(records: Array<{ basicSalary?: number; allowances?: number; pfEmployee?: number; pfEmployer?: number; esiEmployee?: number; esiEmployer?: number }>): ReconRow {
  const s = (f: 'pfEmployee' | 'pfEmployer' | 'esiEmployee' | 'esiEmployer') => records.reduce((a, r) => a + (r[f] || 0), 0);
  return {
    source: 'salaried',
    count: records.length,
    gross: r2(records.reduce((a, r) => a + ((r.basicSalary || 0) + (r.allowances || 0)), 0)),
    pfEmployee: r2(s('pfEmployee')), pfEmployer: r2(s('pfEmployer')),
    esiEmployee: r2(s('esiEmployee')), esiEmployer: r2(s('esiEmployer')),
  };
}

/** Build the labour row from LabourDataContext.computePfEsi() output. */
export function labourRow(comp: { grossWages?: number; epfEmployee?: number; epfEmployer?: number; esiEmployee?: number; esiEmployer?: number }, workerCount: number): ReconRow {
  return {
    source: 'labour',
    count: workerCount,
    gross: r2(comp.grossWages || 0),
    pfEmployee: r2(comp.epfEmployee || 0), pfEmployer: r2(comp.epfEmployer || 0),
    esiEmployee: r2(comp.esiEmployee || 0), esiEmployer: r2(comp.esiEmployer || 0),
  };
}
