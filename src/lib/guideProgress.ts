/**
 * guideProgress — per-reader "chapters completed" tracking, stored in
 * localStorage (no login needed). Shared across components via a tiny external
 * store so the hub progress bar and the chapter "mark complete" button stay in sync.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'sl_guide_progress';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

let state = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...state]));
  } catch {
    /* storage full / blocked — ignore */
  }
}

export function setGuideDone(slug: string, done: boolean) {
  const next = new Set(state);
  if (done) next.add(slug);
  else next.delete(slug);
  state = next;
  persist();
  emit();
}
export function toggleGuideDone(slug: string) {
  setGuideDone(slug, !state.has(slug));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = read();
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** Returns the Set of completed slugs; re-renders when it changes. */
export function useGuideProgress(): Set<string> {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
