/**
 * guideSearch — client-side full-text search across every guide chapter, in
 * both Hindi and English (so a query in either language finds the chapter).
 */
import { findEntry } from '@/content/guide';

const RAW_HI = import.meta.glob('../content/guide/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const RAW_EN = import.meta.glob('../content/guide/en/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function toPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_|]/g, ' ')
    .replace(/[-]{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface IndexEntry {
  slug: string;
  shortTitle: string;
  titleLower: string;
  plain: string;
  plainLower: string;
}

const INDEX: IndexEntry[] = Object.entries(RAW_HI).map(([path, md]) => {
  const slug = path.split('/').pop()!.replace(/\.md$/, '');
  const e = findEntry(slug);
  const en = RAW_EN['../content/guide/en/' + slug + '.md'];
  const plain = toPlain(md) + (en ? '  ' + toPlain(en) : '');
  return {
    slug,
    shortTitle: e?.shortTitle ?? slug,
    titleLower: ((e?.title ?? slug) + ' ' + (e?.shortTitle ?? '')).toLowerCase(),
    plain,
    plainLower: plain.toLowerCase(),
  };
});

export interface GuideSearchHit {
  slug: string;
  snippet: string;
  inTitle: boolean;
}

export function searchGuide(query: string, limit = 12): GuideSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: GuideSearchHit[] = [];
  for (const it of INDEX) {
    const inTitle = it.titleLower.includes(q);
    const idx = it.plainLower.indexOf(q);
    if (!inTitle && idx < 0) continue;
    let snippet: string;
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      snippet = (start > 0 ? '…' : '') + it.plain.slice(start, idx + q.length + 70).trim() + '…';
    } else {
      snippet = it.plain.slice(0, 110).trim() + '…';
    }
    hits.push({ slug: it.slug, snippet, inTitle });
  }
  return hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle)).slice(0, limit);
}
