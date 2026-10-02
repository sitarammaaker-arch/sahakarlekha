/**
 * Stale-chunk recovery after a deploy (Phase L1).
 *
 * A tab left open across a deploy still runs the OLD build; its next dynamic import() asks for an old
 * hashed chunk that no longer exists and rejects. Reloading once fetches the fresh HTML + chunk map.
 *
 * The guard is ONLY a timestamp: at most one reload per RELOAD_WINDOW_MS, whatever else happens. A failure
 * right after our own reload is a real failure (network down / chunk truly missing) → no reload, the caller
 * shows an error; a later deploy in the same tab (after the window) can recover again.
 * It is deliberately NOT cleared when some chunk loads fine: the page chunk can load and the article-body
 * chunk then fail — clearing on that success re-armed the reload every time, an infinite reload loop
 * (caught by e2e). sessionStorage can throw (privacy mode, blocked storage) — then we never reload.
 */
const KEY = 'sl_chunk_reloaded';
export const RELOAD_WINDOW_MS = 30_000;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** true ⇒ a reload was started (keep showing the loading state); false ⇒ give up and show an error. */
export function reloadOnceForStaleChunk(
  store: Store | undefined = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
  reload: () => void = () => window.location.reload(),
  now: () => number = Date.now,
): boolean {
  try {
    if (!store) return false;
    const last = Number(store.getItem(KEY) || 0);
    if (last && now() - last < RELOAD_WINDOW_MS) return false;
    store.setItem(KEY, String(now()));
    reload();
    return true;
  } catch {
    return false;
  }
}
