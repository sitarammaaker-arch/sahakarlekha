import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllNavigation } from '@/hooks/useNavigation';
import { keepVisible, parseList, prefsKey, pushRecent, toggleId, type ModuleDefinition } from '@/lib/navigation';

/*
 * ⭐ favourites + recent pages — a per-viewer convenience kept in this browser (lib/navigation/navPrefs). Every
 * storage access is wrapped: a private window / blocked storage just means an empty list, never a broken page.
 * One tiny in-tab store so the sidebar, breadcrumbs, search and group pages all update together.
 */
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const read = (key: string): string => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } };
const write = (key: string, ids: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* storage blocked — keep working without it */ }
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith('sl.nav.')) l(); };  // other tabs
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
};

function useStoredList(key: string) {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => '');
  return useMemo(() => parseList(raw), [raw]);
}

export interface NavPrefs {
  favourites: ModuleDefinition[];
  recents: ModuleDefinition[];
  isFavourite: (id: string) => boolean;
  toggleFavourite: (id: string) => void;
  recordVisit: (id: string) => void;
}

export function useNavPrefs(): NavPrefs {
  const { user } = useAuth();
  const all = useAllNavigation();
  const favKey = prefsKey('fav', user?.id, user?.societyId);
  const recentKey = prefsKey('recent', user?.id, user?.societyId);
  const favIds = useStoredList(favKey);
  const recentIds = useStoredList(recentKey);

  const byId = useMemo(() => new Map(all.flatMap((g) => g.items).map((m) => [m.id, m])), [all]);
  const visibleIds = useMemo(() => new Set(byId.keys()), [byId]);
  const favourites = useMemo(() => keepVisible(favIds, visibleIds).map((id) => byId.get(id)!), [favIds, visibleIds, byId]);
  const recents = useMemo(() => keepVisible(recentIds, visibleIds).map((id) => byId.get(id)!), [recentIds, visibleIds, byId]);

  const isFavourite = useCallback((id: string) => favIds.includes(id), [favIds]);
  const toggleFavourite = useCallback((id: string) => {
    if (!visibleIds.has(id)) return;
    write(favKey, toggleId(parseList(read(favKey)), id));
  }, [favKey, visibleIds]);
  const recordVisit = useCallback((id: string) => {
    if (!visibleIds.has(id)) return;
    const cur = parseList(read(recentKey));
    if (cur[0] === id) return;   // already the latest — no write, no re-render
    write(recentKey, pushRecent(cur, id));
  }, [recentKey, visibleIds]);

  return { favourites, recents, isFavourite, toggleFavourite, recordVisit };
}
