/**
 * guideSearch — client-side full-text search across every guide chapter.
 * All chapter markdown is bundled (eager glob), stripped to plain text once,
 * then matched on demand. No server, no index build step.
 */
import { findEntry } from '@/content/guide';

const RAW = import.meta.glob('../content/guide/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function toPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[#>*`_|]/g, ' ')
    .replace(/[-]{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface IndexEntry {
  slug: string;
  shortTitle: string;
  title: string;
  kind: string;
  plain: string;
  plainLower: string;
  titleLower: string;
}

const INDEX: IndexEntry[] = Object.entries(RAW).map(([path, md]) => {
  const slug = path.split('/').pop()!.replace(/\.md$/, '');
  const e = findEntry(slug);
  const plain = toPlain(md);
  return {
    slug,
    shortTitle: e?.shortTitle ?? slug,
    title: e?.title ?? slug,
    kind: e?.kind ?? 'chapter',
    plain,
    plainLower: plain.toLowerCase(),
    titleLower: (e?.title ?? slug).toLowerCase(),
  };
});

export interface GuideSearchHit {
  slug: string;
  shortTitle: string;
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
      snippet =
        (start > 0 ? '…' : '') +
        it.plain.slice(start, idx + q.length + 70).trim() +
        '…';
    } else {
      snippet = it.plain.slice(0, 110).trim() + '…';
    }
    hits.push({ slug: it.slug, shortTitle: it.shortTitle, snippet, inTitle });
  }
  // title matches first, then by snippet availability
  return hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle)).slice(0, limit);
}
