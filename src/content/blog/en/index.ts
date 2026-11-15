/**
 * English blog overlay. The Hindi posts (../index.ts + ../<slug>.md) stay the source of truth — prerender, the
 * sitemap and JSON-LD read them. In English mode a translated post shows its English card text and English body
 * (./<slug>.md, a lazy chunk like the Hindi one); an untranslated post stays Hindi with the HindiOnlyNotice.
 *
 * Section headings the article page lifts into UI have English twins (see BlogPost.tsx):
 *   "## तीन बातें याद रखें" → "## Three things to remember"
 *   "## अक्सर पूछे जाने वाले प्रश्न" → "## Frequently asked questions"
 *   "## इस लेख में" → "## In this article"
 */
import type { BlogPost } from '../index';
import { BLOG_EN_META, type BlogPostEn } from './meta';
import { BLOG_EN_TAGS } from './tags';

export type { BlogPostEn };
export { BLOG_EN_META, BLOG_EN_TAGS };

const EN_LOADERS = import.meta.glob('./*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

export function hasEnglishPost(slug: string): boolean {
  return !!BLOG_EN_META[slug] && !!EN_LOADERS['./' + slug + '.md'];
}

/** The English markdown of a translated post, or null when there is none. */
export function loadBlogRawEn(slug: string): Promise<string | null> {
  const load = hasEnglishPost(slug) ? EN_LOADERS['./' + slug + '.md'] : undefined;
  return load ? load() : Promise.resolve(null);
}

export type LocalizedBlogPost = BlogPost & { translated: boolean };

/** Card/meta text in the reader's language (dates, category and image stay from the Hindi post). */
export function localizePost<T extends BlogPost>(post: T, lang: 'hi' | 'en'): T & { translated: boolean } {
  const en = lang === 'en' && hasEnglishPost(post.slug) ? BLOG_EN_META[post.slug] : undefined;
  if (!en) return { ...post, translated: lang === 'hi' };
  return {
    ...post,
    metaTitle: en.metaTitle,
    metaDescription: en.metaDescription,
    title: en.title,
    shortTitle: en.shortTitle,
    excerpt: en.excerpt,
    imageAlt: en.imageAlt ?? post.imageAlt,
    tags: BLOG_EN_TAGS[post.slug]?.length === post.tags.length ? BLOG_EN_TAGS[post.slug] : post.tags,
    translated: true,
  };
}
