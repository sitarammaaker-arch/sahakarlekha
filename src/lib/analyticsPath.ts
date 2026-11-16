/**
 * What a page address looks like by the time it reaches Google Analytics. PURE (no imports, no I/O) so
 * scripts/test-funnel-analytics.mjs runs it directly.
 *
 * usePageTracking used to send `pathname + search` exactly as the browser had it. That put things in GA
 * that have no business there (audit 2026-11-16, S-13):
 *   - record ids:   /members/<member id>, /member/<society id> (the member portal)
 *   - secrets:      /verify-email?token=…, /email-unsubscribe?token=…  (one-time / long-lived tokens)
 *   - free text:    any app page that keeps a name or a search in its query string
 *
 * The rule now:
 *   PATH   an app screen is reported as its first segment, with whatever follows collapsed to `:id`
 *          (/members/abc → /members/:id). The member portal the same (/member/:id). Sections whose second
 *          segment is a fixed name, not a record, keep it (/hub/reports, /super-admin/feedback).
 *   QUERY  only keys on a short allow-list survive (the ones that say WHICH VIEW of a screen was open).
 *          Everything else — tokens, ids, names, `next`, referral codes — is dropped. `q` (a search typed on
 *          the public site, disclosed in the privacy policy) is kept on public pages except /ask.
 */

/** App sections whose second path segment is a fixed name, never a record id. */
const NAMED_CHILD_SECTIONS: ReadonlySet<string> = new Set(['hub', 'super-admin']);
/** Public sections whose second path segment IS an id (the member portal is /member/<society id>). */
const PUBLIC_ID_SECTIONS: ReadonlySet<string> = new Set(['member', 'sadasya']);
/** Query keys that name a view of a screen. Values are still length-limited and must look like a slug. */
const SAFE_QUERY_KEYS: ReadonlySet<string> = new Set(['billwise', 'mode', 'type', 'state', 'step', 'tab', 'cat', 'page']);
const SLUG_VALUE = /^[A-Za-z0-9_-]{1,40}$/;

const stripEn = (pathname: string): string => pathname.replace(/^\/en(?=\/|$)/, '') || '/';

/** The path as analytics should see it. `isAppPath` = lib/appDataPaths.needsAppData. */
export function analyticsPath(pathname: string, isAppPath: (pathname: string) => boolean): string {
  const inner = stripEn(pathname);
  const segs = inner.split('/').filter(Boolean);
  if (segs.length < 2) return pathname;
  const en = inner !== pathname ? '/en' : '';
  if (PUBLIC_ID_SECTIONS.has(segs[0])) return `${en}/${segs[0]}/:id`;
  if (!isAppPath(inner) || NAMED_CHILD_SECTIONS.has(segs[0])) return pathname;
  return `/${segs[0]}/:id`;
}

/** The query string as analytics should see it ('' or '?a=b&c=d'), keys in the order they arrived. */
export function analyticsQuery(pathname: string, search: string, isAppPath: (pathname: string) => boolean): string {
  if (!search || search === '?') return '';
  const inner = stripEn(pathname);
  const isAsk = /^\/ask\/?$/.test(inner);
  const publicSearchAllowed = !isAppPath(inner) && !isAsk;
  const out: string[] = [];
  let params: URLSearchParams;
  try { params = new URLSearchParams(search); } catch { return ''; }
  params.forEach((value, key) => {
    if (SAFE_QUERY_KEYS.has(key) && SLUG_VALUE.test(value)) out.push(`${key}=${value}`);
    // A search typed on the public site (the privacy policy says these are sent). Never on /ask or in the app.
    else if (key === 'q' && publicSearchAllowed && value.length <= 100) out.push(`q=${encodeURIComponent(value)}`);
  });
  return out.length ? `?${out.join('&')}` : '';
}
