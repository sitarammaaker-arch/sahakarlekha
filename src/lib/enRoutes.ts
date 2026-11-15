/**
 * enRoutes — the English URL space (founder 2026-11-15, batch E: "the URL decides the language").
 *
 * Every public page that has an English version also lives at /en/<same path>: /en, /en/pricing,
 * /en/help/add-member … The Hindi page stays at its old address and stays the default (x-default).
 * On these pages the language comes from the URL — /en/… is English, the plain path is Hindi — and
 * never from the saved preference; the saved preference only changes when the visitor uses the switch.
 * The logged-in app has no /en URLs: there the switch alone decides, as before.
 *
 * PURE (no React) — the router, the language provider, links, useDocumentMeta, the prerender and the
 * sitemap all read the same list, so the URL space cannot drift.
 *
 * Batch E2 added the blog (index, posts, categories), the author pages, the editorial policy and the glossary — every
 * one of them reads in English in English mode (all published posts have English bodies; glossary terms come from
 * English Knowledge Items). Deliberately NOT here, because their English page would still be largely Hindi:
 *   /software, /software/<type>  — the society-type cards and the challenges/solutions lists exist only in Hindi
 *   /cooperative-software/<state> — the state details (ecosystem table, compliance list) exist only in Hindi
 *   /downloads                   — each format's use / state / review note exists only in Hindi
 */

/** Section roots whose pages (the root and everything under it) have an English twin. '/' = home only. */
export const EN_SECTIONS: readonly string[] = [
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/guide',
  '/help',
  '/cookbook',
  '/tools',
  // batch E2
  '/blog',
  '/author',
  '/editorial-policy',
  '/glossary',
];

/** Paths inside EN_SECTIONS that have NO English version (yet) — they stay Hindi-only, no /en twin, no hreflang. */
export const EN_EXCLUDED: readonly string[] = [
  '/guide/quiz',   // quiz questions exist only in Hindi (src/content/guide/quizzes.ts)
];

const pathOnly = (to: string): string => {
  const i = to.search(/[?#]/);
  return i < 0 ? to : to.slice(0, i);
};
const rest = (to: string): string => {
  const i = to.search(/[?#]/);
  return i < 0 ? '' : to.slice(i);
};
const trim = (p: string): string => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);

/** True for /en and /en/… */
export function isEnPath(pathname: string): boolean {
  return pathname === '/en' || pathname === '/en/' || pathname.startsWith('/en/');
}

/** /en → /, /en/help/x → /help/x; anything else unchanged. */
export function stripEn(pathname: string): string {
  if (!isEnPath(pathname)) return pathname;
  const p = pathname.slice(3);
  return p === '' || p === '/' ? '/' : p;
}

/** Does this (Hindi) path have an English twin at /en/…? */
export function hasEnglishRoute(pathname: string): boolean {
  const p = trim(pathOnly(pathname));
  if (p === '/') return true;
  if (EN_EXCLUDED.some((x) => p === x || p.startsWith(x + '/'))) return false;
  return EN_SECTIONS.some((s) => s !== '/' && (p === s || p.startsWith(s + '/')));
}

/** The English address of a Hindi path: / → /en, /help/x → /en/help/x (query/hash kept). */
export function toEn(to: string): string {
  if (isEnPath(pathOnly(to))) return to;
  const p = pathOnly(to);
  return (p === '/' ? '/en' : '/en' + p) + rest(to);
}

/** The address to link to from a page in `lang`: English twin when there is one, else unchanged. */
export function localizePath(to: string, lang: 'hi' | 'en'): string {
  if (!to.startsWith('/')) return to;                    // external, relative, mailto:, #anchor
  const p = pathOnly(to);
  if (lang === 'en') return hasEnglishRoute(p) ? toEn(to) : to;
  return isEnPath(p) ? stripEn(p) + rest(to) : to;
}

/**
 * The language a URL fixes, or null when the URL does not decide (logged-in app pages, and public pages
 * that have no English twin yet — those keep following the switch).
 */
export function routeLanguage(pathname: string): 'hi' | 'en' | null {
  if (isEnPath(pathname)) return hasEnglishRoute(stripEn(pathname)) ? 'en' : null;
  return hasEnglishRoute(pathname) ? 'hi' : null;
}

/** hreflang alternates for a Hindi canonical path (null when the page has no English twin). */
export function hreflangAlternates(hindiPath: string, site: string): { hi: string; en: string; xDefault: string } | null {
  const p = trim(pathOnly(hindiPath));
  if (!hasEnglishRoute(p)) return null;
  const hi = site + p;
  return { hi, en: site + toEn(p), xDefault: hi };
}
