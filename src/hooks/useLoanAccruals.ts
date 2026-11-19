/**
 * loan_interest_accruals (069) for the current society — load + save.
 *
 * RULE 1 by construction (same as useDistributionRuns): save is NOT optimistic. Rows are written to
 * Supabase first and local state changes only after the database confirmed them. A failed write
 * returns { ok: false } for the caller to surface — nothing to roll back.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { LoanInterestAccrual } from '@/lib/loans/interestAccrual';

const TABLE = 'loan_interest_accruals';
const num = (v: unknown) => Number(v) || 0;

export function useLoanAccruals() {
  const { user } = useAuth();
  const societyId = user?.societyId;
  const [accruals, setAccruals] = useState<LoanInterestAccrual[]>([]);
  const [loaded, setLoaded] = useState(false);
  // LOAN-03: a failed load used to look exactly like "no accruals" — a repayment then booked interest that WAS accrued
  // straight to income (income twice). `ready` is true only once the rows really arrived.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    if (!societyId) { setAccruals([]); setLoaded(true); setFailed(false); return; }
    void supabase.from(TABLE).select('*').eq('society_id', societyId).eq('isDeleted', false).then(({ data, error }) => {
      if (!live) return;
      setAccruals(error || !data ? [] : (data as unknown as LoanInterestAccrual[]).map((a) => ({
        ...a, amount: num(a.amount), outstanding: num(a.outstanding), ratePa: num(a.ratePa), recovered: num(a.recovered), days: num(a.days),
      })));
      // A missing table (069 not run) means there are no accruals to clear — that is a real "none", not a failure.
      setFailed(!!error && !/loan_interest_accruals|does not exist|schema cache|PGRST205|42P01/i.test(error.message || ''));
      setLoaded(true);
    }, () => { if (live) { setFailed(true); setLoaded(true); } });
    return () => { live = false; };
  }, [societyId]);

  const saveAccruals = useCallback(async (rows: LoanInterestAccrual[]): Promise<{ ok: boolean; error?: string }> => {
    if (!societyId) return { ok: false, error: 'no society' };
    if (rows.length === 0) return { ok: true };
    const { error } = await supabase.from(TABLE).upsert(rows.map((r) => ({ ...r, society_id: societyId })));
    if (error) return { ok: false, error: error.message };
    const ids = new Set(rows.map((r) => r.id));
    setAccruals((prev) => [...prev.filter((a) => !ids.has(a.id)), ...rows.filter((r) => !r.isDeleted)]);
    return { ok: true };
  }, [societyId]);

  return { accruals, loaded, failed, ready: loaded && !failed, saveAccruals };
}
