/**
 * ⭐ Favourite pages + recently opened pages (compact menu phase 2, 2026-10-10 — Xero "favourites", QuickBooks
 * "bookmarks", Tally "Go To" recents).
 *
 * These are per-viewer conveniences (which pages a person likes to reach fast), NOT society data: they live in the
 * browser (localStorage, keyed per user + society) and losing them loses nothing. They hold module ids only and
 * every read is filtered through the pages the engine shows this user right now (keepVisible), so a role change or
 * a capability switched off can never surface a page the user may not open.
 * PURE.
 */
import { MODULE_CATALOG } from './moduleCatalog';
import { moduleForRoute } from './routeModule';

export const MAX_FAVOURITES = 12;
export const MAX_RECENTS = 8;

/** Pages that are not worth a "recent" row (they are always one tap away). */
const NOT_RECENT = new Set(['dashboard', 'myDashboard']);

export type PrefKind = 'fav' | 'recent';
export const prefsKey = (kind: PrefKind, userId: string | undefined, societyId: string | undefined) =>
  `sl.nav.${kind}.${userId || 'anon'}.${societyId || 'none'}`;

const KNOWN = new Set(MODULE_CATALOG.map((m) => m.id));

/** A stored list back to ids — anything malformed / unknown is dropped (never throws). */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const x of v) if (typeof x === 'string' && KNOWN.has(x) && !out.includes(x)) out.push(x);
    return out;
  } catch { return []; }
}

/** Add / remove a favourite (new ones go last, the list is capped). */
export function toggleId(list: string[], id: string, max = MAX_FAVOURITES): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [...list, id].slice(-max);
}

/** Put a page at the front of the recent list (no duplicates, capped). */
export function pushRecent(list: string[], id: string, max = MAX_RECENTS): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** Only the ids the user may open right now, in stored order. */
export function keepVisible(list: string[], visibleIds: ReadonlySet<string>): string[] {
  return list.filter((id) => visibleIds.has(id));
}

/** The module a visit to this path counts for (detail pages count for their list page), or null. */
export function recordableModule(pathname: string): string | null {
  const m = moduleForRoute(pathname);
  return m && !NOT_RECENT.has(m.id) ? m.id : null;
}
