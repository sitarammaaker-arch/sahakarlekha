/**
 * State for the blog search box (/blog and /blog/category/<slug>).
 *
 * Results follow the input as the reader types; the query is mirrored into `?q=`
 * (replace, debounced) so a search can be shared, survives a reload, and the back
 * button is not filled with one entry per keystroke.
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BlogPost } from '@/content/blog';
import { searchBlogPosts } from '@/lib/blogSearch';
import { trackEvent } from '@/lib/analytics';

export function useBlogSearch(posts: BlogPost[], scope: string) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = React.useState(q);
  React.useEffect(() => { setInput(q); }, [q]);

  const query = React.useDeferredValue(input.trim());
  const results = React.useMemo(() => searchBlogPosts(posts, query), [posts, query]);

  React.useEffect(() => {
    const v = input.trim();
    if (v === q) return;
    const t = window.setTimeout(() => setParams(v ? { q: v } : {}, { replace: true }), 400);
    return () => window.clearTimeout(t);
  }, [input, q, setParams]);

  // One analytics event per settled query — "searched, found nothing" is the content-gap signal.
  React.useEffect(() => {
    if (q) trackEvent('blog_search', { q, scope, results: searchBlogPosts(posts, q).length });
  }, [q, scope, posts]);

  return { input, setInput, query, results, searching: query.length > 0 };
}
