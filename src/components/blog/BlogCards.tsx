/**
 * Pieces shared by the blog list pages (/blog and /blog/category/<slug>): the
 * date · minutes · views line, the grid card and the category pills (real links,
 * so every category has a shareable URL).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { readingMinutes, type BlogPost } from '@/content/blog';
import { BLOG_CATEGORIES } from '@/content/blog/categories';
import { catColor, formatDate } from '@/components/blog/blogTheme';
import { formatViews } from '@/lib/blogViews';
import { Calendar, Clock, Eye } from 'lucide-react';

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
