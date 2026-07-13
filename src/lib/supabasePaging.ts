import { supabase } from '@/lib/supabase';

/**
 * Fetch ALL rows of a society-scoped table, paging past Supabase's default 1000-row response cap.
 *
 * The domain contexts (Housing / Dairy / Marketing / Consumer / Labour) originally loaded their
 * tables with a plain `.from(t).select('*').eq('society_id', sid)`, which silently returns only the
 * first 1000 rows — so a large/active society (e.g. daily milk_entries, monthly maintenance_bills)
 * would load partial data with no error. This helper mirrors DataContext's core loader: it ranges
 * through 1000-row pages until a short page, with a 200-page (200k-row) safety cap.
 *
 * Returns the SAME `{ data, error }` shape as a plain `.select()`, so call sites keep their existing
 * `.then(onSuccess, onError)` form. It resolves (never rejects) on a query error — the error is
 * carried in the result, exactly like the core loader — while an unexpected throw still rejects so
 * the caller's onError/localStorage fallback fires.
 */
export async function fetchAllPaged<T>(
  table: string,
  societyId: string,
  orderCol?: string,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  // Safety cap: 200 pages = 200,000 rows. Tweak if any single table ever exceeds this.
  for (let i = 0; i < 200; i++) {
    let q = supabase.from(table).select('*').eq('society_id', societyId).range(from, from + PAGE - 1);
    if (orderCol) q = q.order(orderCol);
    const { data, error } = await q;
    if (error) return { data: out, error };
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return { data: out, error: null };
}
