/**
 * guideQuiz — tracks which part-quizzes the reader has passed (≥70%), stored in
 * localStorage. Shared via a tiny external store so the hub badges, quiz page and
 * certificate page stay in sync.
 */
import { useSyncExternalStore } from 'react';
import { trackEvent } from '@/lib/analytics';

const KEY = 'sl_guide_quizzes';

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
    /* ignore */
  }
}

export function setQuizPassed(partId: string, passed: boolean) {
  // GOS-20: fire only on a NEW pass (retakes of an already-passed part don't recount).
  if (passed && !state.has(partId)) trackEvent('quiz_passed', { part: partId });
  const next = new Set(state);
  if (passed) next.add(partId);
  else next.delete(partId);
  state = next;
  persist();
  emit();
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

/** Returns the Set of passed part-quiz ids; re-renders when it changes. */
export function useGuideQuizzes(): Set<string> {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
