/**
 * SEO helpers shared by the live pages (useDocumentMeta) and the build-time prerender
 * (scripts/prerender-guide.mjs loads this same module), so a page's <title> and schema are identical
 * before and after React mounts. PURE — no React, no browser APIs. Tested by scripts/test-seo-helpers.mjs.
 */
import { PLAN_CATALOG } from './plans.ts'; // relative + .ts: also imported by plain-node tests (no @/ loader)

const SITE = 'https://sahakarlekha.com';

/** Search results cut a title off at roughly this many characters. */
export const TITLE_MAX = 60;

const len = (s: string): number => [...s].length;

// The brand tail a title may end with. Google shows the site name beside every result anyway, so when
// a title is too long the tail is the first thing to go — never the words that say what the page is.
const BRAND_TAIL = /\s+[|—]\s+(SahakarLekha|SahakarLekha Guide|सहकार लेखा ब्लॉग|सहकार लेखा गाइड|सहकार लेखा)\s*$/;

/** A title that fits is returned as is; a longer one loses its brand tail. Nothing else is changed. */
export function fitTitle(title: string, max: number = TITLE_MAX): string {
  if (!title || len(title) <= max) return title;
  return title.replace(BRAND_TAIL, '');
}

/** Glossary term title: the full form when it fits, else a shorter section label (fitTitle then drops the brand). */
export function glossaryTitle(name: string): string {
  const full = `${name} — सहकारी लेखांकन शब्दकोश | SahakarLekha`;
  return len(full) <= TITLE_MAX ? full : fitTitle(`${name} — शब्दकोश | SahakarLekha`);
}

const PLAN_NAME: Record<'starter' | 'plus' | 'pro', string> = { starter: 'Starter', plus: 'Plus', pro: 'Pro' };

/** /pricing structured data: the three public plans with their prices, read from the plan catalogue. */
export function pricingJsonLd(): object {
  const plans = (['starter', 'plus', 'pro'] as const).map((id) => PLAN_CATALOG[id]);
  const prices = plans.map((p) => p.price);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SahakarLekha',
    url: `${SITE}/pricing`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    inLanguage: ['hi', 'en'],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: String(Math.min(...prices)),
      highPrice: String(Math.max(...prices)),
      offerCount: plans.length,
      offers: plans.map((p) => ({
        '@type': 'Offer',
        name: PLAN_NAME[p.id as 'starter' | 'plus' | 'pro'],
        price: String(p.price),
        priceCurrency: 'INR',
        description: 'Per society, per financial year',
        url: `${SITE}/pricing`,
      })),
    },
  };
}
