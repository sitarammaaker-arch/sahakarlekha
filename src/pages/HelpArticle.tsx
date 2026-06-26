/**
 * HelpArticle — a single task at /help/:slug (the DO layer). Steps-first, short,
 * with the two defining features of this layer:
 *   - a deep-link CTA into the exact app screen (PLG): logged-in → the screen,
 *     logged-out → /register (so signup drops them on the task).
 *   - a "पूरा समझें" link DOWN to the in-depth guide chapter (L7, no duplication).
 */
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import HelpfulWidget from '@/components/HelpfulWidget';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/analytics';
import { findHelpTask, relatedHelpTasks } from '@/content/help';
import { findEntry } from '@/content/guide';
import { Home, ChevronRight, Clock, BarChart3, ArrowRight, BookOpen, AlertTriangle, ListChecks } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

/** Render a short Hinglish line with **bold** spans, without dangerouslySetInnerHTML. */
function boldify(text: string): React.ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'शुरुआती', intermediate: 'मध्यम', advanced: 'उन्नत',
};

const HelpArticle: React.FC = () => {
  const { slug = '' } = useParams();
  const task = findHelpTask(slug);
  const { isAuthenticated } = useAuth();

  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  const url = `${SITE}/help/${slug}`;
  useDocumentMeta({
    title: task?.metaTitle,
    description: task?.metaDescription,
    canonicalPath: `/help/${slug}`,
    jsonLd: task ? [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: task.title,
        description: task.metaDescription,
        inLanguage: 'hi',
        url,
        publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'मदद केंद्र', item: `${SITE}/help` },
          { '@type': 'ListItem', position: 2, name: task.title, item: url },
        ],
      },
      ...(task.faqs && task.faqs.length ? [{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: task.faqs.map((f) => ({
          '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }] : []),
    ] : undefined,
  });

  if (!task) return <Navigate to="/help" replace />;

  const guide = task.guideSlug ? findEntry(task.guideSlug) : null;
  const related = relatedHelpTasks(slug);
  const ctaTo = isAuthenticated ? task.deepLink.route : `/register?next=${encodeURIComponent(task.deepLink.route)}`;

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/help" className="inline-flex items-center gap-1 hover:text-primary">
            <Home className="h-3.5 w-3.5" /> मदद केंद्र
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{task.title}</span>
        </nav>

        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{task.category}</span>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-1">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-3">
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {task.estTime}</span>
          <span className="inline-flex items-center gap-1"><BarChart3 className="h-4 w-4" /> {DIFFICULTY_LABEL[task.difficulty]}</span>
        </div>

        {/* TL;DR (atomic answer) */}
        <Card className="mt-6 border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">संक्षेप में</p>
            <p className="text-foreground">{task.tldr}</p>
          </CardContent>
        </Card>

        {/* Primary deep-link CTA */}
        <Link to={ctaTo} onClick={() => trackEvent('help_cta_click', { task: task.slug, authed: isAuthenticated })} className="mt-6 block">
          <Button size="lg" className="w-full gap-2">{task.deepLink.label} <ArrowRight className="h-4 w-4" /></Button>
        </Link>

        {/* Prerequisites */}
        {task.prerequisites && task.prerequisites.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2"><ListChecks className="h-4 w-4 text-primary" /> पहले से ज़रूरी</h2>
            <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
              {task.prerequisites.map((p, i) => <li key={i}>{p.slug ? <Link to={`/help/${p.slug}`} className="text-primary hover:underline">{p.label}</Link> : p.label}</li>)}
            </ul>
          </div>
        )}

        {/* Steps */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-foreground mb-3">स्टेप्स</h2>
          <ol className="space-y-3">
            {task.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center">{i + 1}</span>
                <span className="text-foreground pt-0.5">{boldify(s)}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Common mistakes */}
        {task.commonMistakes && task.commonMistakes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5 mb-3"><AlertTriangle className="h-5 w-5 text-amber-500" /> आम गलतियाँ</h2>
            <ul className="space-y-2">
              {task.commonMistakes.map((m, i) => (
                <li key={i} className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-2.5">{boldify(m)}</li>
              ))}
            </ul>
          </div>
        )}

        {/* FAQs */}
        {task.faqs && task.faqs.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground mb-3">सामान्य सवाल</h2>
            <div className="space-y-4">
              {task.faqs.map((f, i) => (
                <div key={i}>
                  <p className="font-semibold text-foreground">{f.q}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deeper read → guide chapter (L7 canonical-by-intent) */}
        {guide && (
          <Link to={`/guide/${guide.slug}`} className="mt-8 block">
            <Card className="border-primary/30 hover:bg-primary/5 transition-colors">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> पूरा गहराई से समझें · गाइड</p>
                <p className="font-semibold text-foreground mt-1 flex items-center gap-1">{guide.shortTitle} <ArrowRight className="h-4 w-4" /></p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Was this helpful? */}
        <div className="mt-8"><HelpfulWidget /></div>

        {/* Next CTA + related */}
        <Link to={ctaTo} onClick={() => trackEvent('help_cta_click', { task: task.slug, authed: isAuthenticated, pos: 'bottom' })} className="mt-8 block">
          <Button size="lg" variant="outline" className="w-full gap-2">{task.deepLink.label} <ArrowRight className="h-4 w-4" /></Button>
        </Link>

        {related.length > 0 && (
          <div className="mt-10 pt-6 border-t">
            <h2 className="text-sm font-semibold text-foreground mb-3">आगे ये भी करें</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <Link key={r.slug} to={`/help/${r.slug}`} className="block">
                  <Card className="hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    <CardContent className="p-4">
                      <p className="font-medium text-foreground flex items-center gap-1">{r.title} <ArrowRight className="h-3.5 w-3.5 text-primary" /></p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default HelpArticle;
