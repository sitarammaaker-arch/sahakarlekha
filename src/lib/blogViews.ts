/**
 * Blog view counts (public). Backed by Supabase (migration 062):
 *   - increment_blog_view(slug) RPC bumps a shared, persistent counter.
 *   - blog_post_views table is publicly readable (slug + views).
 * Everything is best-effort — a failed call must never break the page, and the
 * blog renders fine (just without counts) if the migration hasn't been run yet.
 */
import { supabase } from '@/lib/supabase';

/** Count one view per browser session per post (best-effort, fire-and-forget). */
export async function incrementBlogView(slug: string): Promise<void> {
  if (!slug) return;
  try {
    const key = `sl_blogview_${slug}`;
    if (sessionStorage.getItem(key)) return; // already counted this session
    sessionStorage.setItem(key, '1');
  } catch { /* sessionStorage blocked (private mode) — still count below */ }
  try {
    await supabase.rpc('increment_blog_view', { p_slug: slug });
  } catch { /* never surface to the user */ }
}

/** Single post's view count, or null if unavailable. */
export async function fetchBlogViewCount(slug: string): Promise<number | null> {
  if (!slug) return null;
  try {
    const { data, error } = await supabase
      .from('blog_post_views')
      .select('views')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return null;
    return data ? Number((data as { views: number }).views) || 0 : 0;
  } catch {
    return null;
  }
}

/** All view counts as { slug: views } — {} on any failure (feature degrades silently). */
export async function fetchBlogViewCounts(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase.from('blog_post_views').select('slug,views');
    if (error || !data) return {};
    const map: Record<string, number> = {};
    for (const r of data as { slug: string; views: number }[]) {
      map[r.slug] = Number(r.views) || 0;
    }
    return map;
  } catch {
    return {};
  }
}

/** Compact display: 1234 -> "1.2k". */
export function formatViews(n: number): string {
  if (n >= 100000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
