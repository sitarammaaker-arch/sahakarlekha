/**
 * SahakarLekha Blog — hand-authored articles (separate from the auto-generated
 * /guide course). Each post's prose lives in ./<slug>.md and is loaded raw;
 * the metadata below drives the /blog index, per-post SEO and the prerenderer.
 *
 * NOTE for scripts/prerender-guide.mjs: it parses THIS file with a regex that
 * expects, per post and IN THIS ORDER, `slug:`, `metaTitle:`, `metaDescription:`,
 * `date:` as single-quoted strings. Keep those four fields first, in that order,
 * and avoid raw apostrophes inside them.
 */
export interface BlogPost {
  slug: string;
  /** <title> + og:title (≤ ~60 chars ideal) */
  metaTitle: string;
  /** meta description + og:description */
  metaDescription: string;
  /** ISO publish date YYYY-MM-DD */
  date: string;
  /** ISO last-updated date (optional) */
  updated?: string;
  /** category label (Hindi) shown as a chip */
  category: string;
  /** on-page hero heading (Devanagari, can differ from metaTitle) */
  title: string;
  /** short heading used on cards */
  shortTitle: string;
  /** one/two-line summary for cards + article intro */
  excerpt: string;
  /** colour accent key → mapped to a gradient cover in the pages */
  accent: 'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'indigo';
  /** topic tags */
  tags: string[];
}

// Reverse-chronological is enforced by sorting on `date` below.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'voucher-entry-guide',
    metaTitle: 'वाउचर एंट्री कैसे करें: स्टेप-बाय-स्टेप गाइड | SahakarLekha',
    metaDescription: 'Receipt, Payment, Journal व Contra वाउचर सही तरीके से कैसे भरें — उदाहरण सहित संपूर्ण मार्गदर्शिका सहकारी समिति के लिए।',
    date: '2026-06-19',
    category: 'वाउचर एंट्री',
    title: 'वाउचर एंट्री कैसे करें: स्टेप-बाय-स्टेप गाइड',
    shortTitle: 'वाउचर एंट्री कैसे करें',
    excerpt: 'चार प्रकार के वाउचर, "पैसा आया या गया" से Dr/Cr तय करना, और हर रिपोर्ट को सही बनाने का सरल तरीका।',
    accent: 'violet',
    tags: ['वाउचर', 'रसीद-भुगतान', 'डबल-एंट्री'],
  },
  {
    slug: 'sahakari-lekhankan-mool-baten',
    metaTitle: 'सहकारी लेखांकन की मूल बातें: शुरुआत से समझें | SahakarLekha',
    metaDescription: 'डबल-एंट्री, खातों के पाँच प्रकार, डेबिट-क्रेडिट और लेखांकन समीकरण — नए सचिव व लेखाकार के लिए आसान हिन्दी गाइड।',
    date: '2026-06-21',
    category: 'लेखांकन मूल बातें',
    title: 'सहकारी लेखांकन की मूल बातें: नए सचिव व लेखाकार के लिए',
    shortTitle: 'सहकारी लेखांकन की मूल बातें',
    excerpt: 'खातों के पाँच प्रकार, डेबिट-क्रेडिट का सुनहरा नियम और लेखांकन समीकरण — पूरी बुनियाद एक जगह।',
    accent: 'sky',
    tags: ['बुनियाद', 'डेबिट-क्रेडिट', 'लेखांकन चक्र'],
  },
  {
    slug: 'sahakari-samiti-digital-lekhankan-zaroorat',
    metaTitle: 'सहकारी समितियों को डिजिटल लेखांकन की ज़रूरत क्यों है? | SahakarLekha',
    metaDescription: 'मैनुअल बहीखाते की कमियाँ, ऑडिट की दिक्कतें और डिजिटल लेखांकन के लाभ — जानिए सहकारी समितियाँ अब भी डिजिटल अकाउंटिंग क्यों अपनाएँ।',
    date: '2026-06-23',
    category: 'डिजिटल लेखांकन',
    title: 'सहकारी समितियों को अभी भी डिजिटल लेखांकन की आवश्यकता क्यों है?',
    shortTitle: 'डिजिटल लेखांकन की आवश्यकता क्यों है?',
    excerpt: 'भरोसा, पारदर्शिता और अनुपालन अब कागज़ की पहुँच से बाहर हैं — जानिए मैनुअल से डिजिटल की ओर बढ़ना अभी क्यों ज़रूरी है।',
    accent: 'emerald',
    tags: ['डिजिटल लेखांकन', 'ऑडिट', 'पारदर्शिता'],
  },
];

// raw markdown for every post, keyed by "./<slug>.md"
const RAW = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export function loadBlogRaw(slug: string): string | null {
  return RAW['./' + slug + '.md'] ?? null;
}

/** Posts sorted newest-first (the canonical order for index + prev/next). */
export const BLOG_ORDER: BlogPost[] = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

export function findPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}

/** Estimated reading time in minutes from the post's markdown (Hindi ~130 wpm). */
export function readingMinutes(slug: string): number {
  const raw = loadBlogRaw(slug);
  if (!raw) return 1;
  const body = raw.replace(/^#\s+.*(\r?\n)+/, '');
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 130));
}

/** Up to `n` related posts (same category first, then newest others). */
export function relatedPosts(slug: string, n = 2): BlogPost[] {
  const self = findPost(slug);
  if (!self) return [];
  const others = BLOG_ORDER.filter((p) => p.slug !== slug);
  const sameCat = others.filter((p) => p.category === self.category);
  const rest = others.filter((p) => p.category !== self.category);
  return [...sameCat, ...rest].slice(0, n);
}
