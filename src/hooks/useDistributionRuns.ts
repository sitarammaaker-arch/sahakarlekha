/**
 * member_distribution_runs (066) for the current society — load + save.
 *
 * RULE 1 by construction: save is NOT optimistic. The row is written to Supabase first and local
 * state changes only after the database confirmed it, so local state can never hold a run the
 * cloud does not have. A failed write returns { ok: false } for the caller to surface (destructive
 * toast) — nothing to roll back.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { DistributionRun } from '@/lib/distribution/dividendRuns';

const TABLE = 'member_distribution_runs';

export function useDistributionRuns() {
  const { user } = useAuth();
  const societyId = user?.societyId;
  const [runs, setRuns] = useState<DistributionRun[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    if (!societyId) { setRuns([]); setLoaded(true); return; }
    void supabase.from(TABLE).select('*').eq('society_id', societyId).eq('isDeleted', false).then(({ data, error }) => {
      if (!live) return;
      // A missing table (066 not yet run) or network error = no runs: the page falls back to its
      // legacy behaviour, exactly as before this feature.
      setRuns(error || !data ? [] : (data as unknown as DistributionRun[]).map((r) => ({ ...r, total: Number(r.total) || 0, ratePct: r.ratePct == null ? null : Number(r.ratePct) })));
      setLoaded(true);
    });
    return () => { live = false; };
  }, [societyId]);

  const saveRun = useCallback(async (run: DistributionRun): Promise<{ ok: boolean; error?: string }> => {
    if (!societyId) return { ok: false, error: 'no society' };
    const { error } = await supabase.from(TABLE).upsert({ ...run, society_id: societyId });
    if (error) return { ok: false, error: error.message };
    setRuns((prev) => [...prev.filter((r) => r.id !== run.id), run]);
    return { ok: true };
  }, [societyId]);

  return { runs, loaded, saveRun };
}
