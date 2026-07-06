/**
 * BlogPost — a single article at /blog/:slug. Gradient hero, reading-progress
 * bar, share buttons, a sticky in-article TOC, related posts and prev/next.
 * Body markdown is rendered with the shared GuideMarkdown styling.
 */
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import GuideMarkdown, { slugifyHeading } from '@/components/guide/GuideMarkdown';
import HelpfulWidget from '@/components/HelpfulWidget';
import EmailCapture from '@/components/EmailCapture';
import { magnetForCategory } from '@/lib/leadMagnets';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { findPost, loadBlogRaw, readingMinutes, relatedPosts, publishedOrder, isPublished } from '@/content/blog';
import { guideForBlog } from '@/content/crossLinks';
import { calculatorForArticle } from '@/content/calculators';
import { helpForBlog } from '@/content/relatedContent';
import { HELP_TASKS } from '@/content/help';
import { ACCENTS, formatDate } from '@/components/blog/blogTheme';
import {
  Home, ChevronRight, ChevronLeft, Calendar, Clock, List, ArrowRight,
  Share2, Check, Newspaper,
} from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

/* Inline X / WhatsApp / LinkedIn glyphs (no extra deps). */
const XIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
);
const WaIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448zM6.597 20.13c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.515 5.26l-.999 3.648zM17.472 14.382c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" /></svg>
);
const InIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" /></svg>
);

const ShareBar: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const [copied, setCopied] = React.useState(false);
  const enc = encodeURIComponent;
  const tw = `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`;
  const wa = `https://wa.me/?text=${enc(title + ' ' + url)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const base = 'h-9 w-9 rounded-full flex items-center justify-center transition-colors text-muted-foreground bg-muted hover:text-white';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1 mr-1"><Share2 className="h-3.5 w-3.5" /> शेयर:</span>
      <a href={tw} target="_blank" rel="noopener noreferrer" aria-label="Share on X" className={`${base} hover:bg-black`}><XIcon className="h-4 w-4" /></a>
      <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" className={`${base} hover:bg-green-500`}><WaIcon className="h-4 w-4" /></a>
      <a href={li} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" className={`${base} hover:bg-blue-600`}><InIcon className="h-4 w-4" /></a>
      <button onClick={copy} aria-label="Copy link" className={`${base} hover:bg-primary`}>
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
      </button>
    </div>
  );
};

const BlogPost: React.FC = () => {
  const { slug = '' } = useParams();
  const post = findPost(slug);
  const raw = loadBlogRaw(slug);

  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  // Reading-progress bar.
  const [readPct, setReadPct] = React.useState(0);
  React.useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setReadPct(max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [slug]);

  const url = `${SITE}/blog/${slug}`;
  const jsonLd = post ? [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.metaDescription,
      inLanguage: 'hi',
      url,
      mainEntityOfPage: url,
      datePublished: post.date,
      dateModified: post.updated || post.date,
      articleSection: post.category,
      keywords: post.tags.join(', '),
      author: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
      publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ब्लॉग', item: `${SITE}/blog` },
        { '@type': 'ListItem', position: 2, name: post.shortTitle, item: url },
      ],
    },
  ] : undefined;

  useDocumentMeta({
    title: post ? post.metaTitle : undefined,
    description: post?.metaDescription,
    canonicalPath: `/blog/${slug}`,
    jsonLd,
  });

  // Unknown post, missing body, or a still-scheduled (future-dated) post → bounce
  // to the index. Scheduled posts stay hidden until their publish date arrives.
  if (!post || raw == null || !isPublished(post)) {
    return <Navigate to="/blog" replace />;
  }

  const a = ACCENTS[post.accent];
  const Icon = a.icon;

  // strip leading H1 (the hero already shows the title)
  const body = raw.replace(/^#\s+.*(\r?\n)+/, '');
  const sections = Array.from(body.matchAll(/^##\s+(.+)$/gm)).map((m) => {
    const text = m[1].trim();
    return { text, id: slugifyHeading(text) };
  });

  // Topic-matched lead magnet + a mid-article opt-in (split the body at a heading).
  const mag = magnetForCategory(post.category);
  const hIdx = Array.from(body.matchAll(/^##\s+/gm)).map((mm) => mm.index || 0);
  const midPos = hIdx.length >= 4 ? hIdx[Math.floor(hIdx.length / 2)] : -1;
  const bodyTop = midPos > 0 ? body.slice(0, midPos) : body;
  const bodyBottom = midPos > 0 ? body.slice(midPos) : '';

  const related = relatedPosts(slug, 3);
  const deepGuide = guideForBlog(slug);
  const pairedCalc = calculatorForArticle(slug);
  // GOS-11: narrative → task edge ("पढ़ा, अब करें") — the help layer converts.
  const helpTasks = helpForBlog(slug)
    .map((s) => HELP_TASKS.find((t) => t.slug === s))
    .filter((t): t is NonNullable<typeof t> => t != null);
  const pub = publishedOrder();
  const idx = pub.findIndex((p) => p.slug === slug);
  const prev = idx > 0 ? pub[idx - 1] : null;
  const next = idx >= 0 && idx < pub.length - 1 ? pub[idx + 1] : null;

  return (
    <PublicLayout>
      {/* Reading-progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[60] no-print pointer-events-none" aria-hidden="true">
        <div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${readPct}%` }} />
      </div>

      {/* Gradient hero */}
      <header className={`relative overflow-hidden bg-gradient-to-br ${a.cover}`}>
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '18px 18px', color: '#fff' }}
          aria-hidden="true"
        />
        <Icon className="absolute -bottom-10 -right-6 h-56 w-56 text-white/15" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 py-12 md:py-16">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-white/80 mb-5">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-white"><Home className="h-3.5 w-3.5" /> होम</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/blog" className="hover:text-white">ब्लॉग</Link>
          </nav>
          <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-semibold text-white">
            {post.category}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mt-4">{post.title}</h1>
          <p className="text-white/90 text-lg mt-4 max-w-2xl">{post.excerpt}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85 mt-6">
            <Link to="/about" className="inline-flex items-center gap-1.5 font-medium hover:text-white underline-offset-2 hover:underline">
              <span className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">स</span>
              SahakarLekha टीम
            </Link>
            <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDate(post.date)}</span>
            {post.updated && <span className="inline-flex items-center gap-1">अपडेट: {formatDate(post.updated)}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {readingMinutes(slug)} मिनट</span>
          </div>
        </div>
      </header>

      <div className="mx-auto px-4 py-10 md:py-12 max-w-6xl">
        <div className="grid lg:grid-cols-[1fr_240px] gap-8">
          {/* Main */}
          <main className="min-w-0 max-w-3xl">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-5 mb-6 border-b">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span key={t} className={`text-xs font-medium px-2.5 py-1 rounded-full ${a.chip}`}>#{t}</span>
                ))}
              </div>
              <ShareBar url={url} title={post.title} />
            </div>

            <GuideMarkdown source={bodyTop} linkGlossary />
            {midPos > 0 && <EmailCapture magnet={mag} className="my-8" />}
            {bodyBottom && <GuideMarkdown source={bodyBottom} linkGlossary />}

            {/* Canonical-by-intent: link to the in-depth guide chapter (L7) */}
            {deepGuide && (
              <Link to={`/guide/${deepGuide.slug}`} className="mt-8 block">
                <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">📖 पूरा गहराई से समझें · गाइड</p>
                    <p className="font-semibold text-foreground mt-1 flex items-center gap-1">{deepGuide.shortTitle} <ArrowRight className="h-4 w-4" /></p>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Paired calculator (topic cluster) */}
            {pairedCalc && (
              <Link to={`/tools/${pairedCalc.slug}`} className="mt-6 block">
                <Card className="border-sky-300/50 bg-sky-50 dark:bg-sky-950/20 hover:bg-sky-100 dark:hover:bg-sky-950/40 transition-colors">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">🧮 तुरंत गणना करें · कैलकुलेटर</p>
                    <p className="font-semibold text-foreground mt-1 flex items-center gap-1">{pairedCalc.hindiName} <ArrowRight className="h-4 w-4" /></p>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Task-layer edge: do it now in the Help Center (GOS-11) */}
            {helpTasks.length > 0 && (
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                {helpTasks.map((t) => (
                  <Link key={t.slug} to={`/help/${t.slug}`} className="block">
                    <Card className="h-full border-emerald-300/50 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors">
                      <CardContent className="p-5">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">📋 अभी करें · मदद केंद्र</p>
                        <p className="font-semibold text-foreground mt-1 flex items-center gap-1">{t.title} <ArrowRight className="h-4 w-4" /></p>
                        <p className="text-xs text-muted-foreground mt-1">{t.estTime} · स्टेप-बाय-स्टेप</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {/* Inline CTA */}
            <Card className="mt-10 bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <Newspaper className="h-9 w-9 text-primary mx-auto mb-2" />
                <p className="font-bold text-lg text-foreground">अपनी समिति का खाता डिजिटल कीजिए — बिल्कुल मुफ्त</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
                  वाउचर से बैलेंस शीट तक, सब एक क्लिक पर। सहकारी समितियों के लिए ही बना, हिन्दी-केंद्रित प्लेटफ़ॉर्म।
                </p>
                <div className="flex flex-wrap gap-3 justify-center mt-4">
                  <Link to="/register"><Button className="gap-2">मुफ्त रजिस्टर करें <ArrowRight className="h-4 w-4" /></Button></Link>
                  <Link to="/guide"><Button variant="outline">संपूर्ण गाइड पढ़ें</Button></Link>
                </div>
              </CardContent>
            </Card>

            {/* Was this helpful? */}
            <HelpfulWidget />

            {/* Lead magnet — topic-matched checklist */}
            <EmailCapture magnet={mag} className="my-8" />

            {/* Share again */}
            <div className="mt-8 flex justify-center"><ShareBar url={url} title={post.title} /></div>

            {/* Related */}
            {related.length > 0 && (
              <section className="mt-12 pt-8 border-t">
                <h2 className="text-xl font-bold text-foreground mb-4">इन्हें भी पढ़ें</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {related.map((r) => {
                    const ra = ACCENTS[r.accent];
                    const RIcon = ra.icon;
                    return (
                      <Link key={r.slug} to={`/blog/${r.slug}`} className="group block">
                        <Card className="h-full transition-all hover:border-primary/50 hover:shadow-sm">
                          <CardContent className="p-4 flex gap-3">
                            <div className={`flex-shrink-0 h-11 w-11 rounded-lg bg-gradient-to-br ${ra.cover} flex items-center justify-center`}>
                              <RIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">{r.shortTitle}</p>
                              <p className="text-xs text-muted-foreground mt-1">{r.category} · {readingMinutes(r.slug)} मिनट</p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Prev / Next */}
            {(prev || next) && (
              <div className="grid sm:grid-cols-2 gap-3 mt-10 pt-6 border-t">
                {prev ? (
                  <Link to={`/blog/${prev.slug}`}>
                    <Card className="h-full transition-all hover:border-primary/50 hover:shadow-sm">
                      <CardContent className="p-4 flex items-center gap-3">
                        <ChevronLeft className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">पिछला लेख</p>
                          <p className="font-medium text-foreground line-clamp-1">{prev.shortTitle}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : <span className="hidden sm:block" />}
                {next ? (
                  <Link to={`/blog/${next.slug}`} className="sm:text-right">
                    <Card className="h-full transition-all hover:border-primary/50 hover:shadow-sm">
                      <CardContent className="p-4 flex items-center gap-3 sm:flex-row-reverse">
                        <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">अगला लेख</p>
                          <p className="font-medium text-foreground line-clamp-1">{next.shortTitle}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : <span className="hidden sm:block" />}
              </div>
            )}
          </main>

          {/* Sticky in-article TOC */}
          {sections.length > 1 && (
            <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardContent className="p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground mb-3">
                    <List className="h-3.5 w-3.5" /> इस लेख में
                  </p>
                  <nav className="space-y-1 text-sm max-h-[60vh] overflow-y-auto">
                    {sections.map((s) => (
                      <a key={s.id} href={`#${s.id}`} className="block px-2 py-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors line-clamp-1">
                        {s.text}
                      </a>
                    ))}
                  </nav>
                  <Link to="/blog">
                    <Button variant="outline" size="sm" className="w-full mt-4 gap-1">
                      <ChevronLeft className="h-3.5 w-3.5" /> सभी लेख
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};

export default BlogPost;
