/**
 * Site-wide search across the knowledge layers — Help (DO), Cookbook (REFERENCE),
 * Guide (LEARN) and Blog (narrative). Client-side, build-time index from the content
 * modules; no server. Tolerates Hindi + English + Hinglish + common misspellings via
 * synonym expansion (seeded from the Hinglish glossary) + a light edit-distance fallback.
 *
 * Why this works without a heavy transliterator: the help/cookbook `intent` fields are
 * already roman Hinglish, and titles carry Devanagari — so the SYNONYMS groups bridge a
 * query token to whichever script the content uses.
 */
import { HELP_TASKS } from '@/content/help';
import { COOKBOOK_ENTRIES } from '@/content/cookbook';
import { GUIDE_ORDER, findEntry } from '@/content/guide';
import { BLOG_POSTS } from '@/content/blog';
import { FAQ_CATEGORIES } from '@/content/faq';
import { allGlossary } from '@/content/glossary';
import { CALCULATORS } from '@/content/calculators';

export type SearchType = 'help' | 'cookbook' | 'guide' | 'blog' | 'faq' | 'glossary' | 'calculator';

export interface SearchDoc {
  id: string;
  type: SearchType;
  title: string;
  url: string;
  snippet: string;
  category?: string;
  /** for cookbook docs: the Dr/Cr posting, so an answer can show it inline */
  lines?: { account: string; type: 'Dr' | 'Cr' }[];
  /** lowercased searchable haystack */
  haystack: string;
}
export interface SearchResult extends SearchDoc { score: number }

export const TYPE_LABEL: Record<SearchType, string> = {
  help: 'मदद · कैसे करें',
  cookbook: 'एंट्री कुकबुक',
  guide: 'गाइड',
  blog: 'ब्लॉग',
  faq: 'सामान्य प्रश्न (FAQ)',
  glossary: 'शब्दकोश',
  calculator: 'कैलकुलेटर',
};

// Synonym groups — variants (Devanagari / roman / common typos / abbreviations) that
// should reach the same docs. Seeded from the cooperative-accounting Hinglish glossary.
const SYNONYMS: string[][] = [
  ['member', 'membar', 'sadasya', 'सदस्य', 'मेम्बर'],
  ['voucher', 'vouchar', 'वाउचर', 'entry', 'एंट्री'],
  ['trial balance', 'tb', 'ट्रायल बैलेंस', 'talpat', 'तलपट'],
  ['balance sheet', 'बैलेंस शीट', 'tulan'],
  ['ledger', 'khata', 'खाता', 'लेजर', 'account', 'खाते'],
  ['opening', 'ओपनिंग', 'prarambhik', 'प्रारंभिक'],
  ['cash', 'nakad', 'नकद', 'कैश'],
  ['bank', 'बैंक'],
  ['loan', 'rin', 'ऋण', 'लोन', 'karz', 'कर्ज'],
  ['interest', 'byaj', 'ब्याज'],
  ['sale', 'bikri', 'बिक्री', 'sales'],
  ['purchase', 'kharid', 'खरीद', 'kharidari'],
  ['salary', 'vetan', 'वेतन', 'tankhwah', 'तनख्वाह'],
  ['depreciation', 'ghisai', 'घिसाई', 'डेप्रिसिएशन', 'मूल्यह्रास'],
  ['stock', 'inventory', 'स्टॉक', 'maal', 'इन्वेंटरी'],
  ['audit', 'ऑडिट', 'ankekshan', 'अंकेक्षण'],
  ['gst', 'जीएसटी'],
  ['tds', 'टीडीएस', '26q'],
  ['share', 'sheyar', 'शेयर', 'capital', 'पूँजी', 'punji', 'punji'],
  ['dividend', 'डिविडेंड', 'labhansh', 'लाभांश'],
  ['reserve', 'रिज़र्व', 'sanchay'],
  ['reconciliation', 'brs', 'समाधान', 'reconcile', 'milan', 'मिलान'],
  ['permission', 'role', 'भूमिका', 'user', 'rights'],
  ['hafed', 'msp', 'एमएसपी', 'mandi', 'मंडी', 'procurement'],
  ['report', 'रिपोर्ट'],
  ['society', 'samiti', 'समिति'],
  ['profit', 'munafa', 'मुनाफ़ा', 'labh', 'लाभ'],
  ['cashbook', 'cash book', 'रोकड़', 'rokad'],
];

const norm = (s: string) => s.toLowerCase().trim();

// Grammatical particles that carry no search value and are often absent from the
// content haystack — removing them keeps AND-matching from failing on phrases like
// "GST जमा की एंट्री" (the "की" would otherwise exclude every real answer).
const STOPWORDS = new Set([
  'की', 'का', 'के', 'को', 'में', 'से', 'पर', 'और', 'या', 'है', 'हैं', 'कि', 'एक',
  'यह', 'वह', 'हो', 'तो', 'भी', 'पे', 'ने',
  'the', 'a', 'an', 'of', 'to', 'in', 'is', 'for', 'on', 'how', 'do', 'i', 'my',
]);

/** Build the search index once (module-level, so it is computed lazily on first use). */
let INDEX: SearchDoc[] | null = null;
function buildIndex(): SearchDoc[] {
  if (INDEX) return INDEX;
  const docs: SearchDoc[] = [];

  for (const t of HELP_TASKS) {
    docs.push({
      id: `help:${t.slug}`, type: 'help', title: t.title, url: `/help/${t.slug}`,
      snippet: t.tldr, category: t.category,
      haystack: norm([t.title, t.intent, t.category, t.tldr].join(' ')),
    });
  }
  for (const e of COOKBOOK_ENTRIES) {
    docs.push({
      id: `cookbook:${e.slug}`, type: 'cookbook', title: e.title, url: `/cookbook/${e.slug}`,
      snippet: e.scenario, category: e.category,
      lines: e.lines.map((l) => ({ account: l.account, type: l.type })),
      haystack: norm([e.title, e.intent, e.category, e.scenario, ...e.lines.map((l) => l.account)].join(' ')),
    });
  }
  for (const g of GUIDE_ORDER) {
    const entry = findEntry(g.slug);
    docs.push({
      id: `guide:${g.slug}`, type: 'guide', title: g.shortTitle, url: `/guide/${g.slug}`,
      snippet: entry?.summary || '',
      haystack: norm([g.shortTitle, g.title, entry?.summary || ''].join(' ')),
    });
  }
  for (const b of BLOG_POSTS) {
    docs.push({
      id: `blog:${b.slug}`, type: 'blog', title: b.title, url: `/blog/${b.slug}`,
      snippet: b.excerpt, category: b.category,
      haystack: norm([b.title, b.excerpt, b.category, ...b.tags].join(' ')),
    });
  }
  for (const cat of FAQ_CATEGORIES) {
    cat.items.forEach((it, i) => {
      docs.push({
        id: `faq:${cat.value}-${i}`, type: 'faq', title: it.q, url: '/faq',
        snippet: it.aHi, category: cat.label,
        haystack: norm([it.q, it.aHi, it.aEn, cat.label].join(' ')),
      });
    });
  }
  // Glossary terms (generated from active Knowledge Items) — searchable in hi/en/mixed.
  for (const g of allGlossary()) {
    docs.push({
      id: `glossary:${g.slug}`, type: 'glossary',
      title: g.hindiName ? `${g.hindiName} · ${g.englishName}` : g.title,
      url: `/glossary/${g.slug}`,
      snippet: g.definition, category: g.category,
      haystack: norm([g.title, g.hindiName, g.englishName, g.category, g.definition, ...g.keywords].join(' ')),
    });
  }
  // Calculators (Calculator Engine registry) — searchable + linked.
  for (const c of CALCULATORS) {
    docs.push({
      id: `calculator:${c.slug}`, type: 'calculator',
      title: `${c.hindiName} · ${c.englishName}`,
      url: `/tools/${c.slug}`,
      snippet: c.intro, category: c.category,
      haystack: norm([c.title, c.hindiName, c.englishName, c.category, c.intro, ...c.keywords].join(' ')),
    });
  }
  INDEX = docs;
  return docs;
}

/** Expand a query token to its synonym set (itself + any group it appears in). */
function expand(token: string): string[] {
  const set = new Set<string>([token]);
  for (const group of SYNONYMS) {
    if (group.some((g) => g === token || g.includes(token) || token.includes(g))) {
      group.forEach((g) => set.add(g));
    }
  }
  return [...set];
}

/** Levenshtein distance (small strings only) for a 1-typo fallback. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2; // early out — we only care about <=1
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function search(query: string, limit = 30): SearchResult[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  if (!tokens.length) return [];
  const docs = buildIndex();
  const results: SearchResult[] = [];

  for (const doc of docs) {
    const title = norm(doc.title);
    // strip surrounding punctuation so the typo fallback matches e.g. "(depreciation)"
    const words = doc.haystack.split(/\s+/).map((w) => w.replace(/[^a-z0-9ऀ-ॿ]/g, '')).filter(Boolean);
    let score = 0;
    let matchedTokens = 0;

    for (const token of tokens) {
      const variants = expand(token);
      let hit = false;
      for (const v of variants) {
        if (title.includes(v)) { score += 10; hit = true; break; }
      }
      if (!hit) {
        for (const v of variants) {
          if (doc.haystack.includes(v)) { score += 4; hit = true; break; }
        }
      }
      if (!hit && token.length >= 4) {
        // 1-typo fallback against haystack words
        if (words.some((w) => w.length >= 4 && editDistance(w, token) <= 1)) { score += 2; hit = true; }
      }
      if (hit) matchedTokens++;
    }

    // require every query token to match somehow (AND semantics) for precision
    if (matchedTokens === tokens.length && score > 0) {
      results.push({ ...doc, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.title.length - b.title.length)
    .slice(0, limit);
}
