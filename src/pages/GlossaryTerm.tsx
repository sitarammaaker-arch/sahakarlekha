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
import { trackEvent } from '@/lib/analytics';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { glossaryTitle } from '@/lib/seo';
import { findTerm, learningPath, allGlossary } from '@/content/glossary';
import { calculatorsForGlossary } from '@/content/calculators';
import { blogForGlossary } from '@/content/relatedContent';
import { glossaryMetaDescription } from '@/content/hubMeta';
import {
  Home, ChevronRight, BookOpen, ArrowRight, Lightbulb, AlertTriangle, Link2,
  GraduationCap, MonitorPlay, FileText, ShieldCheck, Languages, Compass, Calculator as CalcIcon,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const SITE = 'https://sahakarlekha.com';

/* A human label for an in-app route, for "related module / links" buttons. */
const ROUTE_LABELS: Record<string, string> = {
  '/vouchers': 'वाउचर', '/cash-book': 'कैश बुक', '/bank-book': 'बैंक बुक',
  '/ledger': 'लेजर', '/ledger-heads': 'लेजर हेड', '/day-book': 'डे बुक',
  '/members': 'सदस्य', '/member-application': 'सदस्य आवेदन', '/share-register': 'शेयर रजिस्टर',
  '/balance-sheet': 'बैलेंस शीट', '/profit-loss': 'लाभ-हानि', '/trial-balance': 'ट्रायल बैलेंस',
  '/receipts-payments': 'रसीद-भुगतान', '/reports': 'रिपोर्ट', '/dashboard': 'डैशबोर्ड',
  '/society-setup': 'समिति सेटअप', '/backup-restore': 'बैकअप व रिस्टोर', '/bank-reconciliation': 'बैंक समाधान',
  '/register': 'रजिस्टर करें', '/software': 'सॉफ्टवेयर', '/pricing': 'मूल्य',
  '/guide': 'गाइड', '/blog': 'ब्लॉग', '/faq': 'सामान्य प्रश्न', '/ask': 'पूछें',
};
const ROUTE_LABELS_EN: Record<string, string> = {
  '/vouchers': 'Vouchers', '/cash-book': 'Cash Book', '/bank-book': 'Bank Book',
  '/ledger': 'Ledger', '/ledger-heads': 'Ledger Heads', '/day-book': 'Day Book',
  '/members': 'Members', '/member-application': 'Member Application', '/share-register': 'Share Register',
  '/balance-sheet': 'Balance Sheet', '/profit-loss': 'Profit & Loss', '/trial-balance': 'Trial Balance',
  '/receipts-payments': 'Receipts & Payments', '/reports': 'Reports', '/dashboard': 'Dashboard',
  '/society-setup': 'Society Setup', '/backup-restore': 'Backup & Restore', '/bank-reconciliation': 'Bank Reconciliation',
  '/register': 'Register', '/software': 'Software', '/pricing': 'Pricing',
  '/guide': 'Guide', '/blog': 'Blog', '/faq': 'FAQ', '/ask': 'Ask',
};
const routeLabel = (r: string, lang: string = 'hi') =>
  (lang === 'hi' ? ROUTE_LABELS[r] : ROUTE_LABELS_EN[r]) || r.replace(/^\//, '').replace(/-/g, ' ');

const READINESS_LABEL: Record<string, string> = {
  A: 'शैक्षिक (Level A)', B: 'लेखांकन (Level B)', C: 'अनुपालन (Level C)', D: 'कानूनी (Level D)',
};
const READINESS_LABEL_EN: Record<string, string> = {
  A: 'Educational (Level A)', B: 'Accounting (Level B)', C: 'Compliance (Level C)', D: 'Legal (Level D)',
};

const Field: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="mt-7">
    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-2">{icon}{title}</h2>
    {children}
  </section>
);

const GlossaryTerm: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
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
    title: term ? glossaryTitle(`${term.hindiName || term.title} (${term.englishName})`) : undefined,
    description: term ? glossaryMetaDescription(term) : undefined,  // L5: Hindi first, same as the prerender
    canonicalPath: `/glossary/${slug}`,
    jsonLd,
  });

  if (!term) return <Navigate to="/glossary" replace />;

  const path = learningPath(slug);
  const internalNonModule = term.internalLinks.filter((l) => !term.modules.includes(l));
  const calcs = calculatorsForGlossary(slug);
  const pairedBlog = blogForGlossary(slug); // GOS-11: definition → narrative deep-dive
  // English mode leads with the English name; Hindi mode (default, prerendered) is unchanged.
  const primaryName = language === 'hi' ? (term.hindiName || term.title) : (term.englishName || term.title);
  const secondaryName = language === 'hi' ? term.englishName : term.hindiName;

  return (
    <PublicLayout>
      <main className="mx-auto max-w-3xl px-4 py-8 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-5" aria-label="breadcrumb">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> {L('होम', 'Home')}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/glossary" className="hover:text-primary">{L('शब्दकोश', 'Glossary')}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{primaryName}</span>
        </nav>

        {/* Title */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {term.category && <Badge variant="secondary">{term.category}</Badge>}
          <Badge variant="outline" className="gap-1"><Languages className="h-3 w-3" /> {L('हिन्दी + English', 'Hindi + English')}</Badge>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mt-2">{primaryName}</h1>
        <p className="text-lg text-muted-foreground mt-1">{secondaryName}</p>

        {/* Definition (the single source of truth) */}
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wide mb-1.5">
            <BookOpen className="h-3.5 w-3.5" /> {L('परिभाषा · Definition', 'Definition')}
          </p>
          <p className="text-[1.05rem] leading-relaxed text-foreground">{term.definition}</p>
        </div>

        {/* Plain language */}
        {term.plain && (
          <Field icon={<Lightbulb className="h-4 w-4 text-amber-500" />} title={L('आसान शब्दों में', 'In plain words')}>
            <p className="leading-relaxed text-foreground/90">{term.plain}</p>
          </Field>
        )}

        {/* Hindi + English explanations */}
        <div className="grid md:grid-cols-2 gap-4 mt-7">
          {term.hindi && (
            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-primary mb-1">{L('हिन्दी में', 'In Hindi')}</p>
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
          <Field icon={<Compass className="h-4 w-4 text-sky-500" />} title={L('यह क्यों ज़रूरी है', 'Why it matters')}>
            <p className="leading-relaxed text-foreground/90">{term.why}</p>
          </Field>
        )}

        {/* Common misconceptions */}
        {term.misconceptions && (
          <Field icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} title={L('आम गलतफ़हमियाँ', 'Common misconceptions')}>
            <GuideMarkdown source={term.misconceptions} />
          </Field>
        )}

        {/* Learning objectives (from the KI — was parsed but never shown) */}
        {term.learningObjectives && (
          <Field icon={<GraduationCap className="h-4 w-4 text-emerald-600" />} title={L('इस शब्द से आप क्या सीखेंगे', 'What you will learn from this term')}>
            <GuideMarkdown source={term.learningObjectives} />
          </Field>
        )}

        {/* Related concepts (link active glossary terms) */}
        {term.related.length > 0 && (
          <Field icon={<Link2 className="h-4 w-4 text-violet-500" />} title={L('जुड़े विषय', 'Related topics')}>
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
          <Field icon={<MonitorPlay className="h-4 w-4 text-emerald-600" />} title={L('इसे SahakarLekha में करें', 'Do this in SahakarLekha')}>
            <div className="flex flex-wrap gap-2">
              {term.modules.map((m) => (
                <Link key={m} to={m}>
                  <Button variant="outline" size="sm" className="gap-1">{routeLabel(m, language)}<ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              ))}
            </div>
          </Field>
        )}

        {/* Related calculators (reverse link from the calculator engine) */}
        {calcs.length > 0 && (
          <Field icon={<CalcIcon className="h-4 w-4 text-indigo-500" />} title={L('जुड़ा कैलकुलेटर', 'Related calculator')}>
            <div className="flex flex-wrap gap-2">
              {calcs.map((c) => (
                <Link key={c.slug} to={`/tools/${c.slug}`} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border bg-card hover:border-primary/50 hover:text-primary transition-colors">
                  {language === 'hi' ? c.hindiName : c.englishName} <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </Field>
        )}

        {/* Paired narrative article (GOS-11: glossary → blog edge) */}
        {pairedBlog && (
          <Link to={`/blog/${pairedBlog.slug}`} className="mt-7 block">
            <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">{L('📝 पूरा लेख पढ़ें · ब्लॉग', '📝 Read the full article · Blog')}</p>
                <p className="font-semibold text-foreground mt-1 flex items-center gap-1">{pairedBlog.title} <ArrowRight className="h-4 w-4" /></p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Related knowledge: guide/blog/faq (only real, navigable links — no dead "coming soon") */}
        {(internalNonModule.length > 0 || term.suggestedFaq) && (
          <Field icon={<FileText className="h-4 w-4 text-indigo-500" />} title={L('और पढ़ें / जुड़ी सामग्री', 'Read more / related content')}>
            <div className="space-y-2 text-sm">
              {internalNonModule.map((l) => (
                <Link key={l} to={l} className="flex items-center gap-2 text-primary hover:underline">
                  <ArrowRight className="h-3.5 w-3.5" /> {routeLabel(l, language)}
                </Link>
              ))}
              {term.suggestedFaq && (
                <Link to="/faq" className="flex items-center gap-2 text-primary hover:underline">
                  <ArrowRight className="h-3.5 w-3.5" /> {L('सामान्य प्रश्न: ', 'FAQ: ')}{term.suggestedFaq}
                </Link>
              )}
            </div>
          </Field>
        )}

        {/* Learning path */}
        {path.length > 0 && (
          <Field icon={<GraduationCap className="h-4 w-4 text-teal-600" />} title={L('सीखने का रास्ता', 'Learning path')}>
            <div className="grid sm:grid-cols-2 gap-2">
              {path.map((e) => (
                <Link key={e.slug} to={`/glossary/${e.slug}`} className="group flex items-center justify-between gap-2 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">{language === 'hi' ? (e.hindiName || e.title) : (e.englishName || e.title)}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{language === 'hi' ? e.englishName : e.hindiName}</p>
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
            <p className="font-bold text-lg text-foreground">{L('अपनी समिति का खाता डिजिटल कीजिए — ₹2,999/year + GST से', 'Take your society\'s accounts digital — from ₹2,999/year + GST')}</p>
            <p className="text-sm text-muted-foreground mt-1">{L('सहकारी समितियों के लिए ही बना, हिन्दी-केंद्रित प्लेटफ़ॉर्म।', 'A Hindi-first platform built only for cooperative societies.')}</p>
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              <Link to="/register" onClick={() => trackEvent('cta_click', { location: 'glossary_footer', target: 'register', term: slug })}><Button className="gap-2">{L('रजिस्टर करें', 'Register')} <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/glossary" onClick={() => trackEvent('cta_click', { location: 'glossary_footer', target: 'glossary', term: slug })}><Button variant="outline">{L('पूरा शब्दकोश', 'Full glossary')}</Button></Link>
            </div>
          </CardContent>
        </Card>

        {/* Trust / governance footer */}
        <div className="mt-8 pt-5 border-t flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {(language === 'hi' ? READINESS_LABEL : READINESS_LABEL_EN)[term.readiness] || term.readiness}</span>
          {term.lastUpdated && <span>{L('अंतिम अद्यतन: ', 'Last updated: ')}{term.lastUpdated}</span>}
          <span className="font-mono opacity-70">{term.id}</span>
        </div>
      </main>
    </PublicLayout>
  );
};

export default GlossaryTerm;
