/**
 * GuideChapter — a single chapter / appendix at /guide/:slug (bilingual).
 * Loads English markdown when available, else falls back to Hindi with a note.
 */
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import GuideMarkdown, { slugifyHeading } from '@/components/guide/GuideMarkdown';
import LangToggle from '@/components/guide/LangToggle';
import { findEntry, GUIDE_ORDER, GUIDE_PARTS } from '@/content/guide';
import { loadGuideContent, localizedEntry, localizedPartTitle } from '@/content/guide/i18n';
import { useGuideProgress, toggleGuideDone } from '@/lib/guideProgress';
import { useGuideLang, useGuideT } from '@/lib/guideLang';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { ChevronLeft, ChevronRight, Clock, List, GraduationCap, Home, CheckCircle2, Circle } from 'lucide-react';

const GuideChapter: React.FC = () => {
  const { slug = '' } = useParams();
  const lang = useGuideLang();
  const t = useGuideT();
  const entry = findEntry(slug);
  const { content: raw, fallback } = loadGuideContent(slug, lang);
  const meta = entry ? localizedEntry(entry, lang) : null;

  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  // Reading-progress bar: how far the reader has scrolled through this chapter.
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

  // Structured data: an Article tied to the Course, plus a breadcrumb trail.
  // (HowTo/FAQ rich results are largely deprecated by Google; Article +
  // BreadcrumbList are the schema types that still earn SERP treatment.)
  const SITE = 'https://sahakarlekha.com';
  const part = entry ? GUIDE_PARTS.find((p) => p.chapters.some((c) => c.slug === slug)) : null;
  const jsonLd = entry && meta ? [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: meta.shortTitle,
      description: meta.summary,
      inLanguage: lang === 'en' ? 'en' : 'hi',
      url: `${SITE}/guide/${slug}`,
      isPartOf: {
        '@type': 'Course',
        name: lang === 'en'
          ? 'Cooperative Society Accounting & Audit — Complete Course'
          : 'सहकारी समिति लेखांकन व अंकेक्षण — सम्पूर्ण कोर्स',
        url: `${SITE}/guide`,
      },
      ...(part ? { articleSection: localizedPartTitle(part, lang) } : {}),
      publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: lang === 'en' ? 'Guide' : 'गाइड', item: `${SITE}/guide` },
        { '@type': 'ListItem', position: 2, name: meta.shortTitle, item: `${SITE}/guide/${slug}` },
      ],
    },
  ] : undefined;

  useDocumentMeta({
    title: entry && meta ? `${meta.shortTitle} — ${lang === 'en' ? 'SahakarLekha Guide' : 'सहकार लेखा गाइड'}` : undefined,
    description: meta?.summary || undefined,
    canonicalPath: `/guide/${slug}`,
    jsonLd,
  });
  const done = useGuideProgress();

  if (!entry || raw == null || !meta) {
    return <Navigate to="/guide" replace />;
  }

  const isDone = done.has(slug);

  // Overall course progress (chapters completed) — shown in the chapter header.
  const allChapterSlugs = GUIDE_PARTS.flatMap((p) => p.chapters.filter((c) => c.kind === 'chapter').map((c) => c.slug));
  const totalChapters = allChapterSlugs.length;
  const completedChapters = allChapterSlugs.filter((s) => done.has(s)).length;
  const coursePct = totalChapters ? Math.round((completedChapters / totalChapters) * 100) : 0;

  // strip the leading H1 (the page hero already shows the title)
  const body = raw.replace(/^#\s+.*(\r?\n)+/, '');

  // in-chapter TOC from ## headings
  const sections = Array.from(body.matchAll(/^##\s+(.+)$/gm)).map((m) => {
    const text = m[1].trim();
    return { text, id: slugifyHeading(text) };
  });

  const words = body.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / (lang === 'en' ? 200 : 130)));

  const idx = GUIDE_ORDER.findIndex((e) => e.slug === slug);
  const prevE = idx > 0 ? findEntry(GUIDE_ORDER[idx - 1].slug) : null;
  const nextE = idx >= 0 && idx < GUIDE_ORDER.length - 1 ? findEntry(GUIDE_ORDER[idx + 1].slug) : null;
  const prev = prevE ? { slug: prevE.slug, title: localizedEntry(prevE, lang).shortTitle } : null;
  const next = nextE ? { slug: nextE.slug, title: localizedEntry(nextE, lang).shortTitle } : null;

  return (
    <PublicLayout>
      {/* Reading-progress bar (scroll position through this chapter) */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[60] no-print pointer-events-none" aria-hidden="true">
        <div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${readPct}%` }} />
      </div>

      <div className="mx-auto px-4 py-8 md:py-12 max-w-6xl">
        {/* Breadcrumb + language toggle */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            <Link to="/guide" className="inline-flex items-center gap-1 hover:text-primary">
              <Home className="h-3.5 w-3.5" /> {t('ch.home')}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium line-clamp-1">{meta.shortTitle}</span>
          </nav>
          <LangToggle className="flex-shrink-0" />
        </div>

        <div className="grid lg:grid-cols-[1fr_240px] gap-8">
          {/* Main */}
          <main className="min-w-0">
            <header className="mb-6 pb-6 border-b">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                <GraduationCap className="h-3.5 w-3.5" />
                {entry.kind === 'appendix' ? t('ch.badge.appendix') : entry.kind === 'chapter' ? t('ch.badge.chapter', { n: entry.num ?? '' }) : t('ch.badge.guide')}
              </div>
              <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight">{meta.shortTitle}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                <Clock className="h-4 w-4" /> {t('ch.readtime', { n: minutes })}
              </div>
              {/* Overall course progress */}
              <div className="mt-4 max-w-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('ch.courseprogress')}</span>
                  <span>{completedChapters} / {totalChapters} · {coursePct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${coursePct}%` }} />
                </div>
              </div>
            </header>

            {fallback && (
              <div className="mb-5 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 text-sm px-4 py-2.5">
                ℹ️ {t('ch.fallback')}
              </div>
            )}

            <GuideMarkdown source={body} />

            {/* Mark complete */}
            <div className="mt-10 flex justify-center">
              <Button
                variant={isDone ? 'default' : 'outline'}
                onClick={() => toggleGuideDone(slug)}
                className={`gap-2 ${isDone ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                {isDone ? t('ch.done') : t('ch.markdone')}
              </Button>
            </div>

            {/* Prev / Next */}
            <div className="grid sm:grid-cols-2 gap-3 mt-12 pt-6 border-t">
              {prev ? (
                <Link to={`/guide/${prev.slug}`}>
                  <Card className="h-full transition-all hover:border-primary/50 hover:shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                      <ChevronLeft className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t('ch.prev')}</p>
                        <p className="font-medium text-foreground line-clamp-1">{prev.title}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ) : <span className="hidden sm:block" />}
              {next ? (
                <Link to={`/guide/${next.slug}`} className="sm:text-right">
                  <Card className="h-full transition-all hover:border-primary/50 hover:shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3 sm:flex-row-reverse">
                      <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t('ch.next')}</p>
                        <p className="font-medium text-foreground line-clamp-1">{next.title}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ) : <span className="hidden sm:block" />}
            </div>
          </main>

          {/* In-chapter TOC */}
          {sections.length > 1 && (
            <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardContent className="p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground mb-3">
                    <List className="h-3.5 w-3.5" /> {t('ch.inthis')}
                  </p>
                  <nav className="space-y-1 text-sm max-h-[60vh] overflow-y-auto">
                    {sections.map((s) => (
                      <a key={s.id} href={`#${s.id}`} className="block px-2 py-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors line-clamp-1">
                        {s.text}
                      </a>
                    ))}
                  </nav>
                  <Link to="/guide">
                    <Button variant="outline" size="sm" className="w-full mt-4 gap-1">
                      <ChevronLeft className="h-3.5 w-3.5" /> {t('ch.allchapters')}
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

export default GuideChapter;
