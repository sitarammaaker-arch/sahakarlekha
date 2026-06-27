/**
 * BlogIndex — the /blog landing page. A polished, scannable magazine-style
 * index: a featured latest post, category filters, and gradient-cover cards.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { publishedOrder, readingMinutes, type BlogPost } from '@/content/blog';
import { ACCENTS, formatDate } from '@/components/blog/blogTheme';
import { ArrowRight, Calendar, Clock, Newspaper, Rss, ArrowUpRight } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

/** Decorative gradient cover with a faint dotted texture + accent icon. */
const Cover: React.FC<{ post: BlogPost; className?: string; big?: boolean }> = ({ post, className = '', big }) => {
  const a = ACCENTS[post.accent];
  const Icon = a.icon;
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${a.cover} ${className}`}>
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: '#fff' }}
        aria-hidden="true"
      />
      <Icon className={`absolute text-white/25 ${big ? 'h-40 w-40 -bottom-8 -right-6' : 'h-24 w-24 -bottom-5 -right-4'}`} aria-hidden="true" />
      <div className="relative h-full w-full flex items-start p-4">
        <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-semibold text-white">
          {post.category}
        </span>
      </div>
    </div>
  );
};

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
      <div className="mx-auto px-4 py-10 md:py-16 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Newspaper className="h-4 w-4" /> सहकार लेखा ब्लॉग
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
            सहकारी समिति का हिसाब, <span className="text-primary">आसान भाषा में</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट व अनुपालन पर व्यावहारिक लेख — सचिव, लेखाकार, ऑडिटर व बोर्ड सदस्यों के लिए।
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                active === c
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Featured */}
        {featured && (
          <Link to={`/blog/${featured.slug}`} className="group block mb-12">
            <Card className="overflow-hidden transition-all hover:shadow-lg hover:border-primary/40">
              <div className="grid md:grid-cols-2">
                <Cover post={featured} big className="h-48 md:h-full min-h-[12rem]" />
                <CardContent className="p-6 md:p-8 flex flex-col justify-center">
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">✦ नवीनतम लेख</span>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                    {featured.title}
                  </h2>
                  <p className="text-muted-foreground mt-3 line-clamp-3">{featured.excerpt}</p>
                  <Meta post={featured} className="mt-4" />
                  <span className="inline-flex items-center gap-1 text-primary font-medium mt-5 group-hover:gap-2 transition-all">
                    पूरा पढ़ें <ArrowRight className="h-4 w-4" />
                  </span>
                </CardContent>
              </div>
            </Card>
          </Link>
        )}

        {/* Grid */}
        {rest.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group block h-full">
                <Card className="h-full overflow-hidden flex flex-col transition-all hover:shadow-md hover:border-primary/40">
                  <Cover post={post} className="h-32" />
                  <CardContent className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                      {post.shortTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex-1">{post.excerpt}</p>
                    <Meta post={post} className="mt-4" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* CTA band */}
        <section className="mt-16">
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
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
