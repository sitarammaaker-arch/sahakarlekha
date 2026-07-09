/**
 * Global search ranking (ECR-25) — pure, tested. Scores how well a query matches an
 * item's text fields and returns the best matches first, so the command palette shows
 * prefix/word-start hits above buried substrings instead of raw insertion order.
 * Mirrors scripts/test-global-search.mjs.
 */

/**
 * Match score for a query against a set of fields (0 = no match, higher = better):
 *   exact field == query        → 100
 *   query is a prefix of field  → 80
 *   query starts a word         → 60
 *   query is a substring        → 40
 * minus a small penalty for how late the match starts (earlier ranks higher).
 */
export function matchScore(query: string, fields: ReadonlyArray<string | undefined>): number {
  const q = (query || '').trim().toLowerCase();
  if (!q) return 0;
  let best = 0;
  for (const raw of fields) {
    const f = (raw || '').toLowerCase();
    if (!f) continue;
    const idx = f.indexOf(q);
    if (idx < 0) continue;
    let s: number;
    if (f === q) s = 100;
    else if (idx === 0) s = 80;
    else if (f[idx - 1] === ' ') s = 60;
    else s = 40;
    s -= Math.min(idx, 20) * 0.5;   // tie-break: earlier match wins
    if (s > best) best = s;
  }
  return best;
}

/**
 * Filter + rank items by their searchable fields; returns the top `limit` (score > 0).
 * Below `minLen` (default 2) query chars, returns [] (avoids noise on a single letter).
 */
export function rankItems<T>(
  query: string,
  items: ReadonlyArray<T>,
  getFields: (t: T) => ReadonlyArray<string | undefined>,
  limit: number,
  minLen = 2,
): T[] {
  const q = (query || '').trim();
  if (q.length < minLen) return [];
  const scored: Array<{ item: T; score: number; idx: number }> = [];
  items.forEach((item, idx) => {
    const score = matchScore(q, getFields(item));
    if (score > 0) scored.push({ item, score, idx });
  });
  scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx)); // stable on ties
  return scored.slice(0, Math.max(0, limit)).map(r => r.item);
}
