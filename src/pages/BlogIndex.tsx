/**
 * BlogIndex — /blog. Trend-forward magazine layout: a bento featured block
 * (1 large + 2 secondary), colour-coded category sections, a "most read"
 * strip (by live view counts), and per-post view counts. Each category chip and
 * "सभी देखें" links to that category's own page, /blog/category/<slug>. The search
 * box (?q=) swaps the magazine layout for a ranked result grid while it has text.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { publishedOrder, blogIntro, type BlogPost } from '@/content/blog';
import { BLOG_CATEGORIES } from '@/content/blog/categories';
import { fetchBlogViewCounts, formatViews } from '@/lib/blogViews';
import { PostMeta as Meta, CategoryPills, BlogSearchBox, BlogSearchResults } from '@/components/blog/BlogCards';
import { catColor } from '@/components/blog/blogTheme';
import { useBlogSearch } from '@/lib/useBlogSearch';
import { ArrowRight, Eye, Rss, ArrowUpRight, Flame } from 'lucide-react';
import { HUB_META } from '@/content/hubMeta';

const SITE = 'https://sahakarlekha.com';

/** First few sentences of the article body (markdown stripped) for the hero card — computed at build
 *  time (J2: src/content/blog/mdMeta.ts), so the index no longer ships every article body. */
function introPreview(post: BlogPost): string {
  return blogIntro(post.slug) || post.excerpt;
}

const BlogIndex: React.FC = () => {
  const posts = React.useMemo(() => publishedOrder(), []);
  const { input, setInput, query, results, searching } = useBlogSearch(posts, 'all');
  useDocumentMeta({
    title: HUB_META.blog.title,
    description: HUB_META.blog.description,
    canonicalPath: '/blog',
    // a ?q= result list is not a page of its own — keep it out of the index (canonical stays /blog)
    robots: searching ? 'noindex, follow' : undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'सहकार लेखा ब्लॉग',
      description: 'सहकारी समितियों के लिए लेखांकन, ऑडिट व प्रबंधन पर लेख।',
      url: `${SITE}/blog`,
      inLanguage: 'hi',
      publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
      blogPost: posts.map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.metaDescription,
        datePublished: p.date,
        url: `${SITE}/blog/${p.slug}`,
      })),
    },
  });

  const [views, setViews] = React.useState<Record<string, number>>({});
  React.useEffect(() => { fetchBlogViewCounts().then(setViews); }, []);

  // Category sections in BLOG_CATEGORIES order (the same order as the prerendered /blog).
  const byCategory = React.useMemo(() => {
    const m = new Map<string, { slug: string; posts: BlogPost[] }>();
    for (const c of BLOG_CATEGORIES) {
      const catPosts = posts.filter((p) => p.category === c.name);
      if (catPosts.length) m.set(c.name, { slug: c.slug, posts: catPosts });
    }
    return m;
  }, [posts]);
  const liveCategories = React.useMemo(() => new Set<string>(byCategory.keys()), [byCategory]);

  const featured = posts[0];
  const secondary = posts.slice(1, 6);
  const bentoSlugs = new Set([featured, ...secondary].filter(Boolean).map((p) => p.slug));

  const mostRead = React.useMemo(() => {
    const anyViews = posts.some((p) => (views[p.slug] ?? 0) > 0);
    if (!anyViews) return posts.slice(0, 5);
    return [...posts].sort((a, b) => (views[b.slug] ?? 0) - (views[a.slug] ?? 0)).slice(0, 5);
  }, [posts, views]);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        {/* Compact header (H1 for SEO) */}
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">सहकार लेखा ब्लॉग</h1>
            <p className="text-sm text-muted-foreground mt-1">सहकारी लेखांकन, ऑडिट व अनुपालन — आसान भाषा में</p>
          </div>
        </div>

        <BlogSearchBox value={input} onChange={setInput} />
        <CategoryPills active={null} liveCategories={liveCategories} />

        {searching && <BlogSearchResults query={query} results={results} views={views} />}

        {!searching && (
          <>
          {/* ── Bento featured (1 large + 2 secondary) ── */}
          {featured && (
            <div className="grid md:grid-cols-[1.5fr_1fr] gap-4 mb-12">
              <Link to={`/blog/${featured.slug}`} className="group block">
                <Card className="h-full overflow-hidden flex flex-col transition-all hover:shadow-lg hover:border-primary/40">
                  <div className={featured.image ? 'relative aspect-[2/1] bg-primary/10 overflow-hidden' : 'bg-primary/10 h-24 sm:h-28 flex items-end p-4'}>
                    {featured.image && (
                      <img
                        src={featured.image}
                        alt={featured.imageAlt || featured.title}
                        width={1376}
                        height={768}
                        fetchPriority="high"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    )}
                    <span
                      className={featured.image ? 'absolute left-4 bottom-4 inline-flex items-center rounded-full bg-background/90 px-3 py-1 text-xs font-semibold shadow-sm' : 'inline-flex items-center rounded-full bg-background/90 px-3 py-1 text-xs font-semibold'}
                      style={{ color: catColor(featured.category) }}
                    >
                      ✦ नवीनतम · {featured.category}
                    </span>
                  </div>
                  <CardContent className="p-5 flex flex-col flex-1">
                    <h2 className="font-serif text-xl md:text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{featured.title}</h2>
                    <p className="text-sm md:text-base text-muted-foreground mt-3 leading-relaxed">{introPreview(featured)}</p>
                    <Meta post={featured} views={views[featured.slug]} className="mt-4" />
                  </CardContent>
                </Card>
              </Link>
              <div className="grid grid-cols-1 gap-4 content-start">
                {secondary.map((post) => (
                  <Link key={post.slug} to={`/blog/${post.slug}`} className="group block">
                    <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
                      <CardContent className="p-4">
                        <span className="text-xs font-semibold" style={{ color: catColor(post.category) }}>{post.category}</span>
                        <h3 className="font-serif text-base font-bold text-foreground leading-snug mt-1 group-hover:text-primary transition-colors line-clamp-2">{post.shortTitle}</h3>
                        <Meta post={post} views={views[post.slug]} className="mt-2" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Category sections + most-read ── */}
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
            {Array.from(byCategory.entries()).map(([cat, { slug: catSlug, posts: catPosts }]) => {
              const items = catPosts.filter((p) => !bentoSlugs.has(p.slug)).slice(0, 3);
              if (items.length === 0) return null;
              const color = catColor(cat);
              return (
                <section key={cat}>
                  <div className="flex items-center gap-2 mb-3 pb-1.5" style={{ borderBottom: `2px solid ${color}` }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    <h2 className="text-base font-bold text-foreground flex-1">
                      <Link to={`/blog/category/${catSlug}`} className="hover:text-primary">{cat}</Link>
                    </h2>
                    <Link to={`/blog/category/${catSlug}`} className="text-xs font-medium text-primary hover:underline">सभी {catPosts.length} देखें →</Link>
                  </div>
                  <div className="divide-y">
                    {items.map((post) => (
                      <Link key={post.slug} to={`/blog/${post.slug}`} className="group block py-2.5">
                        <h3 className="font-serif text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">{post.shortTitle}</h3>
                        <Meta post={post} views={views[post.slug]} className="mt-1" />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Most read */}
            <section className="rounded-xl border bg-muted/30 p-5 self-start">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-4 w-4 text-orange-500" />
                <h2 className="text-base font-bold text-foreground">सबसे ज़्यादा पढ़े गए</h2>
              </div>
              <div className="space-y-3">
                {mostRead.map((post, i) => (
                  <Link key={post.slug} to={`/blog/${post.slug}`} className="group flex gap-3 items-start">
                    <span className="font-serif text-xl text-muted-foreground/70 w-5 flex-shrink-0 leading-none">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">{post.shortTitle}</p>
                      {(views[post.slug] ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Eye className="h-3 w-3" /> {formatViews(views[post.slug])} बार पढ़ा</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
          </>
        )}

        {/* CTA band */}
        <section className="mt-16">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row items-center gap-5">
              <Rss className="h-10 w-10 text-primary flex-shrink-0" />
              <div className="flex-1 text-center sm:text-left">
                <p className="font-bold text-lg text-foreground">नियमित रूप से नए लेख</p>
                <p className="text-sm text-muted-foreground">
                  सहकारी लेखांकन की नई जानकारी सीधे पाएँ — और अपनी समिति का खाता आज ही डिजिटल कीजिए।
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center flex-shrink-0">
                <Button asChild className="gap-2"><Link to="/register">शुरू करें <ArrowRight className="h-4 w-4" /></Link></Button>
                <Button asChild variant="outline" className="gap-1.5">
                  <a href="https://x.com/sahakarlekha" target="_blank" rel="noopener noreferrer">X पर फॉलो करें <ArrowUpRight className="h-3.5 w-3.5" /></a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PublicLayout>
  );
};

export default BlogIndex;
