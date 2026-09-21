/**
 * BlogIndex — /blog. Trend-forward magazine layout: a bento featured block
 * (1 large + 2 secondary), colour-coded category sections, a "most read"
 * strip (by live view counts), and per-post view counts. Selecting a category
 * chip switches to a simple filtered grid.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { publishedOrder, readingMinutes, type BlogPost } from '@/content/blog';
import { formatDate } from '@/components/blog/blogTheme';
import { fetchBlogViewCounts, formatViews } from '@/lib/blogViews';
import { ArrowRight, Calendar, Clock, Eye, Rss, ArrowUpRight, Flame } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

/** Deterministic accent colour per category (stable across renders). */
const CAT_COLORS = ['#185FA5', '#0F6E56', '#BA7517', '#534AB7', '#993C1D', '#993556', '#3B6D11', '#0C447C'];
function catColor(cat: string): string {
  let h = 0;
  for (const ch of cat) h += ch.charCodeAt(0);
  return CAT_COLORS[h % CAT_COLORS.length];
}

const Meta: React.FC<{ post: BlogPost; views?: number; className?: string }> = ({ post, views, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground ${className}`}>
    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(post.date)}</span>
    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingMinutes(post.slug)} मिनट</span>
    {views != null && views > 0 && (
      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatViews(views)}</span>
    )}
  </div>
);

const BlogIndex: React.FC = () => {
  const posts = publishedOrder();
  useDocumentMeta({
    title: 'सहकार लेखा ब्लॉग — सहकारी समिति लेखांकन, ऑडिट व प्रबंधन',
    description: 'सहकारी समितियों के लिए डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट, अनुपालन व प्रबंधन पर सरल हिन्दी लेख — PACS, मार्केटिंग, उपभोक्ता व बहुउद्देशीय समितियों के लिए।',
    canonicalPath: '/blog',
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

  const categories = React.useMemo(() => ['सभी', ...Array.from(new Set(posts.map((p) => p.category)))], []);
  const [active, setActive] = React.useState('सभी');

  const byCategory = React.useMemo(() => {
    const m = new Map<string, BlogPost[]>();
    for (const p of posts) {
      const arr = m.get(p.category);
      if (arr) arr.push(p); else m.set(p.category, [p]);
    }
    return m;
  }, []);

  const featured = posts[0];
  const secondary = posts.slice(1, 3);
  const bentoSlugs = new Set([featured, ...secondary].filter(Boolean).map((p) => p.slug));

  const mostRead = React.useMemo(() => {
    const anyViews = posts.some((p) => (views[p.slug] ?? 0) > 0);
    if (!anyViews) return posts.slice(0, 5);
    return [...posts].sort((a, b) => (views[b.slug] ?? 0) - (views[a.slug] ?? 0)).slice(0, 5);
  }, [views]);

  const Pills = (
    <div className="flex flex-nowrap md:flex-wrap gap-2 mb-8 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => setActive(c)}
          className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            active === c
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );

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

        {Pills}

        {active !== 'सभी' ? (
          /* ── Filtered category view ── */
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(byCategory.get(active) ?? []).map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group block h-full">
                <Card className="h-full flex flex-col transition-all hover:shadow-md hover:border-primary/40">
                  <CardContent className="p-5 flex flex-col flex-1">
                    <span className="text-xs font-semibold" style={{ color: catColor(post.category) }}>{post.category}</span>
                    <h3 className="font-serif text-lg font-bold text-foreground leading-snug mt-1 group-hover:text-primary transition-colors">{post.shortTitle}</h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex-1">{post.excerpt}</p>
                    <Meta post={post} views={views[post.slug]} className="mt-3" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <>
            {/* ── Bento featured (1 large + 2 secondary) ── */}
            {featured && (
              <div className="grid md:grid-cols-[1.5fr_1fr] gap-4 mb-12">
                <Link to={`/blog/${featured.slug}`} className="group block">
                  <Card className="h-full overflow-hidden flex flex-col transition-all hover:shadow-lg hover:border-primary/40">
                    <div className="bg-primary/10 h-24 sm:h-28 flex items-end p-4">
                      <span className="inline-flex items-center rounded-full bg-background/90 px-3 py-1 text-xs font-semibold" style={{ color: catColor(featured.category) }}>
                        ✦ नवीनतम · {featured.category}
                      </span>
                    </div>
                    <CardContent className="p-5 flex flex-col flex-1">
                      <h2 className="font-serif text-xl md:text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{featured.title}</h2>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{featured.excerpt}</p>
                      <Meta post={featured} views={views[featured.slug]} className="mt-4" />
                    </CardContent>
                  </Card>
                </Link>
                <div className="grid grid-cols-1 gap-4">
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
              {Array.from(byCategory.entries()).map(([cat, catPosts]) => {
                const items = catPosts.filter((p) => !bentoSlugs.has(p.slug)).slice(0, 3);
                if (items.length === 0) return null;
                const color = catColor(cat);
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2 mb-3 pb-1.5" style={{ borderBottom: `2px solid ${color}` }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                      <h3 className="text-base font-bold text-foreground flex-1">{cat}</h3>
                      <button onClick={() => setActive(cat)} className="text-xs font-medium text-primary hover:underline">सभी देखें →</button>
                    </div>
                    <div className="divide-y">
                      {items.map((post) => (
                        <Link key={post.slug} to={`/blog/${post.slug}`} className="group block py-2.5">
                          <h4 className="font-serif text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">{post.shortTitle}</h4>
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
                  <h3 className="text-base font-bold text-foreground">सबसे ज़्यादा पढ़े गए</h3>
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
                <p className="font-bold text-lg text-foreground">हर हफ्ते एक नया लेख</p>
                <p className="text-sm text-muted-foreground">
                  सहकारी लेखांकन की नई जानकारी सीधे पाएँ — और अपनी समिति का खाता आज ही मुफ्त डिजिटल कीजिए।
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center flex-shrink-0">
                <Link to="/register"><Button className="gap-2">मुफ्त शुरू करें <ArrowRight className="h-4 w-4" /></Button></Link>
                <a href="https://x.com/sahakarlekha" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-1.5">X पर फॉलो करें <ArrowUpRight className="h-3.5 w-3.5" /></Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PublicLayout>
  );
};

export default BlogIndex;
