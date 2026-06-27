/**
 * Glossary term — /glossary/:slug. Generated entirely from one ACTIVE Knowledge
 * Item (single source of truth). Shows definition, plain/Hindi/English explanations,
 * why-it-matters, misconceptions, related concepts, related software module, related
 * guide/FAQ/downloads, a learning path, breadcrumb and DefinedTerm JSON-LD.
 */
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import GuideMarkdown from '@/components/guide/GuideMarkdown';
import HelpfulWidget from '@/components/HelpfulWidget';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { findTerm, learningPath, allGlossary } from '@/content/glossary';
import {
  Home, ChevronRight, BookOpen, ArrowRight, Lightbulb, AlertTriangle, Link2,
  GraduationCap, MonitorPlay, FileText, ShieldCheck, Languages, Compass,
} from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

/* A human label for an in-app route, for "related module / links" buttons. */
const ROUTE_LABELS: Record<string, string> = {
  '/vouchers': 'वाउचर', '/cash-book': 'रोकड़ बही', '/bank-book': 'बैंक बही',
  '/ledger': 'खाता बही', '/ledger-heads': 'लेजर हेड', '/day-book': 'रोज़नामचा',
  '/members': 'सदस्य', '/member-application': 'सदस्य आवेदन', '/share-register': 'शेयर रजिस्टर',
  '/balance-sheet': 'बैलेंस शीट', '/profit-loss': 'लाभ-हानि', '/trial-balance': 'ट्रायल बैलेंस',
  '/receipts-payments': 'प्राप्ति-भुगतान', '/reports': 'रिपोर्ट', '/dashboard': 'डैशबोर्ड',
  '/society-setup': 'समिति सेटअप', '/backup-restore': 'बैकअप व रिस्टोर', '/bank-reconciliation': 'बैंक समाधान',
  '/register': 'मुफ्त रजिस्टर', '/software': 'सॉफ्टवेयर', '/pricing': 'मूल्य',
  '/guide': 'गाइड', '/blog': 'ब्लॉग', '/faq': 'सामान्य प्रश्न', '/ask': 'पूछें',
};
const routeLabel = (r: string) => ROUTE_LABELS[r] || r.replace(/^\//, '').replace(/-/g, ' ');

const READINESS_LABEL: Record<string, string> = {
  A: 'शैक्षिक (Level A)', B: 'लेखांकन (Level B)', C: 'अनुपालन (Level C)', D: 'कानूनी (Level D)',
};

const Field: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="mt-7">
    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-2">{icon}{title}</h2>
    {children}
  </section>
);

const GlossaryTerm: React.FC = () => {
  const { slug = '' } = useParams();
  const term = findTerm(slug);

  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  const url = `${SITE}/glossary/${slug}`;
  const jsonLd = term ? [
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: term.hindiName ? `${term.hindiName} (${term.englishName})` : term.title,
      description: term.definition,
      inLanguage: 'hi',
      url,
      termCode: term.id,
      inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'SahakarLekha Glossary', url: `${SITE}/glossary` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'होम', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'शब्दकोश', item: `${SITE}/glossary` },
        { '@type': 'ListItem', position: 3, name: term.englishName, item: url },
      ],
    },
  ] : undefined;

  useDocumentMeta({
    title: term ? `${term.hindiName || term.title} (${term.englishName}) — सहकारी लेखांकन शब्दकोश | SahakarLekha` : undefined,
    description: term ? term.definition.slice(0, 158) : undefined,
    canonicalPath: `/glossary/${slug}`,
    jsonLd,
  });

  if (!term) return <Navigate to="/glossary" replace />;

  const path = learningPath(slug);
  const internalNonModule = term.internalLinks.filter((l) => !term.modules.includes(l));

  return (
    <PublicLayout>
      <main className="mx-auto max-w-3xl px-4 py-8 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-5" aria-label="breadcrumb">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> होम</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/glossary" className="hover:text-primary">शब्दकोश</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{term.hindiName || term.title}</span>
        </nav>

        {/* Title */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {term.category && <Badge variant="secondary">{term.category}</Badge>}
          <Badge variant="outline" className="gap-1"><Languages className="h-3 w-3" /> हिन्दी + English</Badge>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mt-2">{term.hindiName || term.title}</h1>
        <p className="text-lg text-muted-foreground mt-1">{term.englishName}</p>

        {/* Definition (the single source of truth) */}
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wide mb-1.5">
            <BookOpen className="h-3.5 w-3.5" /> परिभाषा · Definition
          </p>
          <p className="text-[1.05rem] leading-relaxed text-foreground">{term.definition}</p>
        </div>

        {/* Plain language */}
        {term.plain && (
          <Field icon={<Lightbulb className="h-4 w-4 text-amber-500" />} title="आसान शब्दों में">
            <p className="leading-relaxed text-foreground/90">{term.plain}</p>
          </Field>
        )}

        {/* Hindi + English explanations */}
        <div className="grid md:grid-cols-2 gap-4 mt-7">
          {term.hindi && (
            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-primary mb-1">हिन्दी में</p>
              <p lang="hi" className="text-sm leading-relaxed text-foreground/90">{term.hindi}</p>
            </CardContent></Card>
          )}
          {term.english && (
            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-primary mb-1">In English</p>
              <p lang="en" className="text-sm leading-relaxed text-foreground/90">{term.english}</p>
            </CardContent></Card>
          )}
        </div>

        {/* Why it matters */}
        {term.why && (
          <Field icon={<Compass className="h-4 w-4 text-sky-500" />} title="यह क्यों ज़रूरी है">
            <p className="leading-relaxed text-foreground/90">{term.why}</p>
          </Field>
        )}

        {/* Common misconceptions */}
        {term.misconceptions && (
          <Field icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} title="आम गलतफ़हमियाँ">
            <GuideMarkdown source={term.misconceptions} />
          </Field>
        )}

        {/* Related concepts (link active glossary terms) */}
        {term.related.length > 0 && (
          <Field icon={<Link2 className="h-4 w-4 text-violet-500" />} title="जुड़े विषय">
            <div className="flex flex-wrap gap-2">
              {term.related.map((r) => r.slug ? (
                <Link key={r.id} to={`/glossary/${r.slug}`} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border bg-card hover:border-primary/50 hover:text-primary transition-colors">
                  {r.label} <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <span key={r.id} className="inline-flex items-center text-sm px-3 py-1.5 rounded-full border bg-muted/40 text-muted-foreground">{r.label}</span>
              ))}
            </div>
          </Field>
        )}

        {/* Software module CTA */}
        {term.modules.length > 0 && (
          <Field icon={<MonitorPlay className="h-4 w-4 text-emerald-600" />} title="इसे SahakarLekha में करें">
            <div className="flex flex-wrap gap-2">
              {term.modules.map((m) => (
                <Link key={m} to={m}>
                  <Button variant="outline" size="sm" className="gap-1">{routeLabel(m)} <ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              ))}
            </div>
          </Field>
        )}

        {/* Related knowledge: guide/blog/faq (only real, navigable links — no dead "coming soon") */}
        {(internalNonModule.length > 0 || term.suggestedFaq) && (
          <Field icon={<FileText className="h-4 w-4 text-indigo-500" />} title="और पढ़ें / जुड़ी सामग्री">
            <div className="space-y-2 text-sm">
              {internalNonModule.map((l) => (
                <Link key={l} to={l} className="flex items-center gap-2 text-primary hover:underline">
                  <ArrowRight className="h-3.5 w-3.5" /> {routeLabel(l)}
                </Link>
              ))}
              {term.suggestedFaq && (
                <Link to="/faq" className="flex items-center gap-2 text-primary hover:underline">
                  <ArrowRight className="h-3.5 w-3.5" /> सामान्य प्रश्न: {term.suggestedFaq}
                </Link>
              )}
            </div>
          </Field>
        )}

        {/* Learning path */}
        {path.length > 0 && (
          <Field icon={<GraduationCap className="h-4 w-4 text-teal-600" />} title="सीखने का रास्ता">
            <div className="grid sm:grid-cols-2 gap-2">
              {path.map((e) => (
                <Link key={e.slug} to={`/glossary/${e.slug}`} className="group flex items-center justify-between gap-2 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">{e.hindiName || e.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{e.englishName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                </Link>
              ))}
            </div>
          </Field>
        )}

        {/* Was this helpful? — feedback into the inbox (reuses the blog/guide widget) */}
        <HelpfulWidget />

        {/* Register CTA */}
        <Card className="mt-10 bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <p className="font-bold text-lg text-foreground">अपनी समिति का खाता डिजिटल कीजिए — मुफ्त</p>
            <p className="text-sm text-muted-foreground mt-1">सहकारी समितियों के लिए ही बना, हिन्दी-केंद्रित प्लेटफ़ॉर्म।</p>
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              <Link to="/register"><Button className="gap-2">मुफ्त रजिस्टर करें <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/glossary"><Button variant="outline">पूरा शब्दकोश</Button></Link>
            </div>
          </CardContent>
        </Card>

        {/* Trust / governance footer */}
        <div className="mt-8 pt-5 border-t flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {READINESS_LABEL[term.readiness] || term.readiness}</span>
          {term.lastUpdated && <span>अंतिम अद्यतन: {term.lastUpdated}</span>}
          <span className="font-mono opacity-70">{term.id}</span>
        </div>
      </main>
    </PublicLayout>
  );
};

export default GlossaryTerm;
