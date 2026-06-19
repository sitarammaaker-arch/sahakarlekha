/**
 * guideLang — the reader's chosen guide language (hi/en), stored in localStorage
 * and shared via a tiny external store so every guide page stays in sync.
 */
import { useSyncExternalStore } from 'react';
import { GUIDE_UI, type GuideLang } from '@/content/guide/i18n';

export type { GuideLang };

const KEY = 'sl_guide_lang';

function read(): GuideLang {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'hi'; } catch { return 'hi'; }
}

let state: GuideLang = read();
const listeners = new Set<() => void>();

export function setGuideLang(lang: GuideLang) {
  state = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { state = read(); cb(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

export function useGuideLang(): GuideLang {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Returns a translator bound to the current guide language. */
export function useGuideT() {
  const lang = useGuideLang();
  return (key: string, vars?: Record<string, string | number>) => {
    const e = GUIDE_UI[key];
    let s = e ? e[lang] : key;
    if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
    return s;
  };
}
