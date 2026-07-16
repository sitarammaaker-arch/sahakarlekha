/**
 * Site-wide search across the knowledge layers — Help (DO), Cookbook (REFERENCE),
 * Guide (LEARN), Blog (narrative), FAQ, Glossary (the KI corpus) and Calculators.
 * Client-side, build-time index from the content modules; no server.
 *
 * THIS MODULE IS THE CORPUS. The scoring lives in `search/rank.ts` (pure, importable
 * from node and from the Edge Function). Only this file touches the content
 * registries — several of which use `import.meta.glob`, which makes this module
 * Vite-only. That split is deliberate: `buildIndex()` is bound to the bundler,
 * `searchIndex()` is bound to nothing, and both the CAIOS ask-core and
 * `npm run eval:ask` need the second without the first.
 *
 * Why synonym expansion works without a transliterator: the help/cookbook `intent`
 * fields are already roman Hinglish and titles carry Devanagari, so the SYNONYMS
 * groups bridge a query token to whichever script the content uses.
 */
import { HELP_TASKS } from '@/content/help';
import { COOKBOOK_ENTRIES } from '@/content/cookbook';
import { GUIDE_ORDER, findEntry } from '@/content/guide';
import { BLOG_POSTS } from '@/content/blog';
import { FAQ_CATEGORIES } from '@/content/faq';
import { allGlossary } from '@/content/glossary';
import { CALCULATORS } from '@/content/calculators';
import { norm, searchIndex } from './search/rank';
import type { SearchDoc, SearchResult, SearchType } from './search/rank';

// Re-exported so existing importers (AskAssistant, SearchDialog, …) need no change.
export type { SearchDoc, SearchResult, SearchType };

export const TYPE_LABEL: Record<SearchType, string> = {
  help: 'मदद · कैसे करें',
  cookbook: 'एंट्री कुकबुक',
  guide: 'गाइड',
  blog: 'ब्लॉग',
  faq: 'सामान्य प्रश्न (FAQ)',
  glossary: 'शब्दकोश',
  calculator: 'कैलकुलेटर',
};

/** Build the search index once (module-level, so it is computed lazily on first use). */
let INDEX: SearchDoc[] | null = null;
export function buildIndex(): SearchDoc[] {
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
      altTitle: g.title,   // the KI's own title — carries the acronym
      url: `/glossary/${g.slug}`,
      snippet: g.definition, category: g.category,
      haystack: norm([g.title, g.hindiName, g.englishName, g.category, g.definition, ...g.keywords].join(' ')),
    });
  }
  // Calculators (Calculator Engine registry) — searchable + linked; FAQ questions deepen recall.
  for (const c of CALCULATORS) {
    docs.push({
      id: `calculator:${c.slug}`, type: 'calculator',
      title: `${c.hindiName} · ${c.englishName}`,
      altTitle: c.title,   // same shape as glossary — the registry title is dropped from display
      url: `/tools/${c.slug}`,
      snippet: c.intro, category: c.category,
      haystack: norm([c.title, c.hindiName, c.englishName, c.category, c.intro, ...c.keywords, ...(c.faqs?.map((f) => f.q) ?? [])].join(' ')),
    });
  }
  INDEX = docs;
  return docs;
}

export function search(query: string, limit = 30): SearchResult[] {
  return searchIndex(buildIndex(), query, limit);
}
