/**
 * What a visitor carries INTO login / registration through the URL, and how much of it is believed.
 * PURE (no imports, no I/O) so scripts/test-entry-context.mjs runs it directly.
 *
 *   ?next=/sales            where to land after signing in (audit 2026-11-16, J-3)
 *   ?type=dairy&state=hr    what the visitor was reading about, pre-selected on Register (J-10)
 *
 * Everything here arrives from a link anyone can write, so nothing is trusted:
 *   - `next` is only ever an in-app path of THIS site. It can never name another host — that is the
 *     open-redirect a "return to" parameter invites. It also grants nothing: after login the route still
 *     passes CapabilityGuard, so `next` only chooses where an already-authorised user lands.
 *   - `type` / `state` must be one of the values the form already offers; anything else is ignored.
 */

export const NEXT_PARAM = 'next';
export const MAX_NEXT_LENGTH = 200;

/**
 * A safe post-login destination, or null. `isAppPath` says whether a pathname is a logged-in app
 * screen (lib/appDataPaths.needsAppData) — public pages, /login and /register are never a destination.
 */
export function safeNext(raw: string | null | undefined, isAppPath: (pathname: string) => boolean): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > MAX_NEXT_LENGTH) return null;
  // One leading slash, then a normal path character: rules out "//host", "/\host", "https://…", "javascript:…".
  if (!/^\/[A-Za-z0-9]/.test(value)) return null;
  // No backslash, no control character / whitespace, no "@", no encoded slash or backslash, no "//" anywhere.
  // eslint-disable-next-line no-control-regex
  if (/[\\@\u0000- \u007f]/.test(value) || /%(2f|5c|00|0a|0d)/i.test(value) || value.includes('//')) return null;
  const pathname = value.split(/[?#]/)[0];
  if (pathname.split('/').some((seg) => seg === '..' || seg === '.')) return null;
  // /en/… is the English twin of a PUBLIC page (lib/enRoutes) — the app itself has no /en addresses.
  if (/^\/en(\/|$)/i.test(pathname)) return null;
  if (!isAppPath(pathname)) return null;
  return value;
}

/** `/login` or `/register`, carrying `next` when it is safe. */
export function withNext(base: '/login' | '/register', next: string | null | undefined, isAppPath: (pathname: string) => boolean): string {
  const safe = safeNext(next, isAppPath);
  return safe ? `${base}?${NEXT_PARAM}=${encodeURIComponent(safe)}` : base;
}

/** Public page slugs (/software/<slug>) whose registration value has a different spelling. */
const TYPE_ALIASES: Record<string, string> = {
  marketing: 'marketing_processing',
  'thrift-credit': 'thrift_credit',
};

/** `?type=` → a society type the form offers, or ''. Accepts the form value or the /software/<slug>. */
export function resolveEntryType(raw: string | null | undefined, allowed: readonly string[]): string {
  if (typeof raw !== 'string') return '';
  const key = raw.trim().toLowerCase();
  if (!key || key.length > 40) return '';
  const value = TYPE_ALIASES[key] ?? key;
  return allowed.includes(value) ? value : '';
}

/** `?state=` → a state value the form offers, or ''. Accepts the value ("hr") or the page slug ("haryana"). */
export function resolveEntryState(raw: string | null | undefined, states: readonly { value: string; label: string }[]): string {
  if (typeof raw !== 'string') return '';
  const key = raw.trim().toLowerCase();
  if (!key || key.length > 40) return '';
  const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return states.find((s) => s.value === key)?.value ?? states.find((s) => slug(s.label) === key)?.value ?? '';
}
