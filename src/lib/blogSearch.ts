/**
 * Blog-only search — the box on /blog and /blog/category/<slug>.
 *
 * It runs the SAME ranker as /search and /ask (search/rank.ts: Hindi/Hinglish
 * synonyms, nukta-insensitive, 1-typo tolerant), over the SAME per-post document
 * that siteSearch.ts indexes — blogSearchDoc() below is used by both — so a word
 * that finds an article in one box finds it in the other.
 *
 * Deliberately metadata-only (title, excerpt, category, tags): article bodies are
 * lazy per-post chunks and must not be pulled into the list pages.
 */
import type { BlogPost } from '@/content/blog';
import { norm, searchIndex, type SearchDoc } from './search/rank';

/** The search document for one blog post (shared with siteSearch.ts). */
export function blogSearchDoc(b: BlogPost): SearchDoc {
  return {
    id: `blog:${b.slug}`,
    type: 'blog',
    title: b.title,
    url: `/blog/${b.slug}`,
    snippet: b.excerpt,
    category: b.category,
    haystack: norm([b.title, b.excerpt, b.category, ...b.tags].join(' ')),
  };
}

/** `posts` ranked best-first for `query`; [] for an empty query. */
export function searchBlogPosts(posts: BlogPost[], query: string): BlogPost[] {
  if (!query.trim()) return [];
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  return searchIndex(posts.map(blogSearchDoc), query, posts.length)
    .map((r) => bySlug.get(r.id.slice('blog:'.length)))
    .filter((p): p is BlogPost => p != null);
}
