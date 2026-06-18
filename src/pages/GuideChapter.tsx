/**
 * GuideChapter — renders a single book chapter / appendix at /guide/:slug.
 * Shows breadcrumb, in-chapter sub-TOC (## headings), prev/next nav and the
 * styled markdown. Content comes from src/content/guide/<slug>.md.
 */
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import GuideMarkdown, { slugifyHeading } from '@/components/guide/GuideMarkdown';
import { findEntry, loadGuideRaw, GUIDE_ORDER } from '@/content/guide';
import { useGuideProgress, toggleGuideDone } from '@/lib/guideProgress';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { ChevronLeft, ChevronRight, Clock, List, GraduationCap, Home, CheckCircle2, Circle } from 'lucide-react';

const GuideChapter: React.FC = () => {
  const { slug = '' } = useParams();
  const entry = findEntry(slug);
  const raw = loadGuideRaw(slug);

  // scroll to top whenever the chapter changes
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [slug]);

  // hooks must run unconditionally (before any early return)
  useDocumentMeta({
    title: entry ? `${entry.shortTitle} — सहकार लेखा गाइड` : undefined,
    description: entry?.summary || undefined,
    canonicalPath: `/guide/${slug}`,
  });
  const done = useGuideProgress();

  if (!entry || raw == null) {
    return <Navigate to="/guide" replace />;
  }

  const isDone = done.has(slug);

  // strip the leading H1 (the page hero already shows the title)
  const body = raw.replace(/^#\s+.*(\r?\n)+/, '');

  // in-chapter TOC from ## headings
  const sections = Array.from(body.matchAll(/^##\s+(.+)$/gm)).map((m) => {
    const text = m[1].trim();
    return { text, id: slugifyHeading(text) };
  });

  // reading time (Hindi ~130 wpm)
  const words = body.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 130));

  // prev / next from the flat reading order
  const idx = GUIDE_ORDER.findIndex((e) => e.slug === slug);
  const prev = idx > 0 ? GUIDE_ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < GUIDE_ORDER.length - 1 ? GUIDE_ORDER[idx + 1] : null;

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-8 md:py-12 max-w-6xl">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/guide" className="inline-flex items-center gap-1 hover:text-primary">
            <Home className="h-3.5 w-3.5" /> गाइड
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{entry.shortTitle}</span>
        </nav>

        <div className="grid lg:grid-cols-[1fr_240px] gap-8">
          {/* Main */}
          <main className="min-w-0">
            <header className="mb-6 pb-6 border-b">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                <GraduationCap className="h-3.5 w-3.5" />
                {entry.kind === 'appendix' ? 'परिशिष्ट' : entry.kind === 'chapter' ? `अध्याय ${entry.num}` : 'सहकार लेखा गाइड'}
              </div>
              <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight">{entry.shortTitle}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                <Clock className="h-4 w-4" /> ~{minutes} मिनट पढ़ने में
              </div>
            </header>

            <GuideMarkdown source={body} />

            {/* Mark complete */}
            <div className="mt-10 flex justify-center">
              <Button
                variant={isDone ? 'default' : 'outline'}
                onClick={() => toggleGuideDone(slug)}
                className={`gap-2 ${isDone ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                {isDone ? 'पूरा हुआ ✓ (हटाने हेतु दबाएँ)' : 'इस अध्याय को पूरा चिह्नित करें'}
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
                        <p className="text-xs text-muted-foreground">पिछला</p>
                        <p className="font-medium text-foreground line-clamp-1">{prev.shortTitle}</p>
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
                        <p className="text-xs text-muted-foreground">अगला</p>
                        <p className="font-medium text-foreground line-clamp-1">{next.shortTitle}</p>
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
                    <List className="h-3.5 w-3.5" /> इस अध्याय में
                  </p>
                  <nav className="space-y-1 text-sm max-h-[60vh] overflow-y-auto">
                    {sections.map((s) => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="block px-2 py-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors line-clamp-1"
                      >
                        {s.text}
                      </a>
                    ))}
                  </nav>
                  <Link to="/guide">
                    <Button variant="outline" size="sm" className="w-full mt-4 gap-1">
                      <ChevronLeft className="h-3.5 w-3.5" /> सभी अध्याय
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
