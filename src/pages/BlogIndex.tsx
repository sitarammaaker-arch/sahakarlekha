/**
 * BlogIndex — the /blog landing page. Clean, Medium/Ahrefs-style: a text-first
 * reading list (serif titles, category filter, featured latest post, divide-y
 * rows) — no gradient covers, just typography and whitespace.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { publishedOrder, readingMinutes, type BlogPost } from '@/content/blog';
import { formatDate } from '@/components/blog/blogTheme';
import { ArrowRight, Calendar, Clock, Newspaper, Rss, ArrowUpRight } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const Meta: React.FC<{ post: BlogPost; className?: string }> = ({ post, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground ${className}`}>
    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(post.date)}</span>
    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingMinutes(post.slug)} मिनट पढ़ें</span>
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

  const categories = React.useMemo(() => ['सभी', ...Array.from(new Set(posts.map((p) => p.category)))], []);
  const [active, setActive] = React.useState('सभी');
  const filtered = active === 'सभी' ? posts : posts.filter((p) => p.category === active);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <PublicLayout>
      {/* Hero — compact on mobile, full on desktop */}
      <div className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-5 md:py-16 text-center">
          {/* Badge + subtitle are decorative — hidden on mobile so content shows sooner; the H1 stays for SEO + clarity. */}
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
            <Newspaper className="h-4 w-4" /> सहकार लेखा ब्लॉग
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-0 md:mb-3 leading-tight">
            सहकारी समिति का हिसाब, <span className="text-primary">आसान भाषा में</span>
          </h1>
          <p className="hidden md:block text-lg text-muted-foreground max-w-2xl mx-auto">
            डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट व अनुपालन पर व्यावहारिक लेख — सचिव, लेखाकार, ऑडिटर व बोर्ड सदस्यों के लिए।
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        {/* Category filter — single scrollable row on mobile, wraps + centered on desktop */}
        <div className="flex flex-nowrap md:flex-wrap md:justify-center gap-2 mb-6 md:mb-8 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {/* Featured (latest) */}
        {featured && (
          <Link to={`/blog/${featured.slug}`} className="group block pb-8 mb-2 border-b">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">✦ नवीनतम लेख · {featured.category}</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground leading-tight mt-2 group-hover:text-primary transition-colors">
              {featured.title}
            </h2>
            <p className="text-muted-foreground mt-3">{featured.excerpt}</p>
            <Meta post={featured} className="mt-4" />
          </Link>
        )}

        {/* Reading list */}
        {rest.length > 0 && (
          <div className="divide-y">
            {rest.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group block py-6">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">{post.category}</span>
                <h3 className="font-serif text-lg md:text-xl font-bold text-foreground leading-snug mt-1.5 group-hover:text-primary transition-colors">
                  {post.shortTitle}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                <Meta post={post} className="mt-3" />
              </Link>
            ))}
          </div>
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
