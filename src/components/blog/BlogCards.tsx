/**
 * Pieces shared by the blog list pages (/blog and /blog/category/<slug>): the
 * date · minutes · views line, the grid card, the category pills (real links,
 * so every category has a shareable URL) and the search box + its results.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { readingMinutes, type BlogPost } from '@/content/blog';
import { BLOG_CATEGORIES } from '@/content/blog/categories';
import { catColor, formatDate } from '@/components/blog/blogTheme';
import { formatViews } from '@/lib/blogViews';
import { Calendar, Clock, Eye, Search, X } from 'lucide-react';

export const PostMeta: React.FC<{ post: BlogPost; views?: number; className?: string }> = ({ post, views, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground ${className}`}>
    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(post.date)}</span>
    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingMinutes(post.slug)} मिनट</span>
    {views != null && views > 0 && (
      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatViews(views)}</span>
    )}
  </div>
);

export const PostGridCard: React.FC<{ post: BlogPost; views?: number }> = ({ post, views }) => (
  <Link to={`/blog/${post.slug}`} className="group block h-full">
    <Card className="h-full flex flex-col transition-all hover:shadow-md hover:border-primary/40">
      <CardContent className="p-5 flex flex-col flex-1">
        <span className="text-xs font-semibold" style={{ color: catColor(post.category) }}>{post.category}</span>
        <h3 className="font-serif text-lg font-bold text-foreground leading-snug mt-1 group-hover:text-primary transition-colors">{post.shortTitle}</h3>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex-1">{post.excerpt}</p>
        <PostMeta post={post} views={views} className="mt-3" />
      </CardContent>
    </Card>
  </Link>
);

/** "सभी" + one pill per category that has live posts; `active` is a category slug, or null on /blog. */
export const CategoryPills: React.FC<{ active: string | null; liveCategories: Set<string> }> = ({ active, liveCategories }) => {
  const pill = (isActive: boolean) =>
    `flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
      isActive
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary'
    }`;
  return (
    <nav aria-label="लेखों की श्रेणियाँ" className="flex flex-nowrap md:flex-wrap gap-2 mb-8 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link to="/blog" aria-current={active === null ? 'page' : undefined} className={pill(active === null)}>सभी</Link>
      {BLOG_CATEGORIES.filter((c) => liveCategories.has(c.name)).map((c) => (
        <Link key={c.slug} to={`/blog/category/${c.slug}`} aria-current={active === c.slug ? 'page' : undefined} className={pill(active === c.slug)}>
          {c.name}
        </Link>
      ))}
    </nav>
  );
};

/** The search input. `scopeName` (a category) narrows the placeholder/label to that category. */
export const BlogSearchBox: React.FC<{ value: string; onChange: (v: string) => void; scopeName?: string }> = ({ value, onChange, scopeName }) => {
  const label = scopeName ? `"${scopeName}" के लेखों में खोजें` : 'ब्लॉग के लेखों में खोजें';
  return (
    <form
      role="search"
      className="relative mb-5"
      // Enter / the phone keyboard's search key: results are already live — just close the keyboard.
      onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }}
    >
      <label htmlFor="blog-search" className="sr-only">{label}</label>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
      <input
        id="blog-search"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={scopeName ? `${scopeName} में खोजें…` : 'लेख खोजें: जैसे GST, ऑडिट, PACS, वाउचर…'}
        className="w-full rounded-xl border border-border bg-background pl-10 pr-10 py-3 text-base md:text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="खोज साफ़ करें"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
};

/** Search results grid, or — when nothing matches — the ways onward (whole blog, whole site, /ask). */
export const BlogSearchResults: React.FC<{
  query: string;
  results: BlogPost[];
  views: Record<string, number>;
  /** set on a category page: offers "search all articles" when nothing matched here */
  scopeName?: string;
}> = ({ query, results, views, scopeName }) => {
  const enc = encodeURIComponent(query);
  return (
    <section aria-label="खोज के परिणाम" className="mb-12">
      <p className="text-sm text-muted-foreground mb-4" aria-live="polite">
        "<span className="text-foreground font-medium">{query}</span>"{scopeName ? ` (${scopeName} में)` : ''}: {results.length} लेख मिले
      </p>
      {results.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {results.map((post) => <PostGridCard key={post.slug} post={post} views={views[post.slug]} />)}
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/30 p-5 space-y-2 text-sm">
          <p className="text-foreground">इस शब्द से कोई लेख नहीं मिला। दूसरा या छोटा शब्द लिखकर देखें, या:</p>
          <ul className="list-disc pl-5 space-y-1">
            {scopeName && <li><Link to={`/blog?q=${enc}`} className="text-primary hover:underline">सभी लेखों में खोजें</Link></li>}
            <li><Link to={`/search?q=${enc}`} className="text-primary hover:underline">पूरी साइट में खोजें</Link> (मदद, गाइड, शब्दकोश)</li>
            <li><Link to={`/ask?q=${enc}`} className="text-primary hover:underline">अपना सवाल पूछें</Link></li>
          </ul>
        </div>
      )}
    </section>
  );
};
