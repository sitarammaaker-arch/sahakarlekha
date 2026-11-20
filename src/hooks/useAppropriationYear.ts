/**
 * YE-07 (audit 2026-11-17) — WHICH year the year-end appropriation is for.
 *
 * The appropriation pages used the society's CURRENT label. After a rollover the previous year is still "closing"
 * (migration 090) until it is closed — and that is the year whose surplus the AGM appropriates. Using the current
 * label computed "FY 2027-28" surplus as both years together, posted a share of it under the new label, and at the real
 * 2027-28 year-end read as already done.
 *
 * The year to appropriate = the oldest year still "closing", else the current year. Its P&L is read as on that year's
 * own end date.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useData } from '@/contexts/DataContext';
import { fyEndDate } from '@/lib/balanceSheetLeaves';

export interface AppropriationYear {
  /** FY label the appropriation is for, e.g. "2026-27". */
  fy: string;
  /** That year's last day (YYYY-MM-DD) — read its P&L as on this date. */
  fyEnd: string;
  /** True when it is a rolled-over year still waiting to be closed (not the current year). */
  closing: boolean;
}

export function useAppropriationYear(): AppropriationYear {
  const { society } = useData();
  const [closingFy, setClosingFy] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    supabase.from('financial_years').select('fy_label').eq('status', 'closing').order('start_date').limit(1)
      .then(({ data }) => { if (live) setClosingFy(((data as { fy_label: string }[] | null) ?? [])[0]?.fy_label ?? null); },
        () => { if (live) setClosingFy(null); });
    return () => { live = false; };
  }, [society.financialYear]);
  const fy = closingFy && closingFy !== society.financialYear ? closingFy : society.financialYear;
  return { fy, fyEnd: fyEndDate(fy), closing: fy !== society.financialYear };
}
