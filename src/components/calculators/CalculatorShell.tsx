/**
 * CalculatorShell — the shared framework for EVERY calculator. Renders a config from
 * the registry: form (validated, instant), results (stats + table), formula / explanation
 * / example / common-mistakes, related glossary / knowledge / help / articles / modules,
 * a print action and a CTA. Handles SEO (WebApplication + Breadcrumb JSON-LD), a11y,
 * mobile and dark mode. Adding a calculator needs NO new component — just a registry entry.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import GuideMarkdown from '@/components/guide/GuideMarkdown';
import HelpfulWidget from '@/components/HelpfulWidget';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { trackEvent } from '@/lib/analytics';
import { findTerm } from '@/content/glossary';
import { relatedCalculators, type CalcConfig } from '@/content/calculators';
import { cookbookForCalc } from '@/content/relatedContent';
import { COOKBOOK_ENTRIES } from '@/content/cookbook';
import {
  Home, ChevronRight, Calculator as CalcIcon, ArrowRight, Sigma, BookOpen, Lightbulb,
  AlertTriangle, Link2, FileText, MonitorPlay, Printer, ShieldCheck, GraduationCap, HelpCircle,
} from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="mt-8">
    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-2">{icon}{title}</h2>
    {children}
  </section>
);

const CalculatorShell: React.FC<{ config: CalcConfig }> = ({ config }) => {
  // Form state — keep raw values so the user can clear/type; compute coerces.
  const [values, setValues] = React.useState<Record<string, number | string>>(() =>
    Object.fromEntries(config.inputs.map((i) => [i.key, i.default])),
  );
  React.useEffect(() => {
    setValues(Object.fromEntries(config.inputs.map((i) => [i.key, i.default])));
  }, [config]);

  const result = React.useMemo(() => {
    try { return config.compute(values); } catch { return { ok: false, stats: [], note: 'गणना में त्रुटि — कृपया मान जाँचें।' }; }
  }, [config, values]);

  // GOS-20: count real usage once per calculator visit (first input change, not page view).
  const usedRef = React.useRef(false);
  React.useEffect(() => { usedRef.current = false; }, [config.slug]);
  const set = (key: string, val: string) => {
    if (!usedRef.current) {
      usedRef.current = true;
      trackEvent('calculator_used', { calc: config.slug });
    }
    setValues((p) => ({ ...p, [key]: val }));
  };

  const url = `${SITE}/tools/${config.slug}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: `${config.hindiName} (${config.englishName})`,
      description: config.metaDescription,
      url,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      inLanguage: 'hi',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'होम', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'कैलकुलेटर', item: `${SITE}/tools` },
        { '@type': 'ListItem', position: 3, name: config.englishName, item: url },
      ],
    },
    // HowTo — how to use this calculator (steps from its inputs)
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `${config.hindiName} कैसे इस्तेमाल करें`,
      inLanguage: 'hi',
      step: [
        ...config.inputs.map((inp, i) => ({ '@type': 'HowToStep', position: i + 1, name: `${inp.label} भरें`, text: `${inp.label}${inp.sub ? ' — ' + inp.sub : ''}।` })),
        { '@type': 'HowToStep', position: config.inputs.length + 1, name: 'परिणाम देखें', text: 'परिणाम तुरंत दिख जाता है — कोई बटन दबाने की ज़रूरत नहीं।' },
      ],
    },
    // FAQPage — for rich results + People Also Ask
    ...(config.faqs && config.faqs.length
      ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: config.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }]
      : []),
  ];

  useDocumentMeta({
    title: config.metaTitle,
    description: config.metaDescription,
    canonicalPath: `/tools/${config.slug}`,
    jsonLd,
  });

  const glossaryTerms = config.relatedGlossary.map((s) => findTerm(s)).filter((t): t is NonNullable<typeof t> => t != null);
  const relatedCalcs = relatedCalculators(config.slug);
  const paired = config.relatedArticles[0];        // primary paired educational article (deep-dive)
  const toneCls = (t?: string) => (t === 'good' ? 'text-emerald-600' : t === 'bad' ? 'text-destructive' : 'text-primary');

  return (
    <PublicLayout>
      <main className="mx-auto max-w-3xl px-4 py-8 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-5" aria-label="breadcrumb">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> होम</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/tools" className="hover:text-primary">कैलकुलेटर</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{config.hindiName}</span>
        </nav>

        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary">{config.category}</Badge>
          <Badge variant="outline" className="gap-1"><CalcIcon className="h-3 w-3" /> मुफ्त कैलकुलेटर</Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight mt-1">{config.title}</h1>
        <p className="text-muted-foreground mt-1">{config.intro}</p>

        {config.nev && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>दर/लागू होना आप स्वयं डालते हैं — यह कोई कानूनी दर नहीं सुझाता। सही दर के लिए अपने CA/नियमों से पुष्टि करें (Needs Expert Validation)।</span>
          </div>
        )}

        {/* Calculator: inputs + results */}
        <div className="mt-5 grid md:grid-cols-2 gap-4 print:grid-cols-2">
          {/* Inputs */}
          <Card>
            <CardContent className="p-4 space-y-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">मान भरें</p>
              {config.inputs.map((inp) => {
                const id = `calc-${inp.key}`;
                return (
                  <div key={inp.key}>
                    <label htmlFor={id} className="block text-sm font-medium text-foreground">{inp.label}</label>
                    {inp.sub && <span className="block text-[11px] text-muted-foreground mb-1">{inp.sub}</span>}
                    {inp.type === 'select' ? (
                      <select
                        id={id}
                        value={String(values[inp.key])}
                        onChange={(e) => set(inp.key, e.target.value)}
                        className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {inp.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <div className="mt-1 relative">
                        {inp.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">{inp.prefix}</span>}
                        <Input
                          id={id}
                          type="number"
                          inputMode="decimal"
                          value={String(values[inp.key])}
                          min={inp.min}
                          step={inp.step ?? 1}
                          onChange={(e) => set(inp.key, e.target.value)}
                          aria-label={inp.label}
                          className={`${inp.prefix ? 'pl-7' : ''} ${inp.suffix ? 'pr-12' : ''}`}
                        />
                        {inp.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden="true">{inp.suffix}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">परिणाम</p>
                <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" aria-label="परिणाम प्रिंट या सेव करें">
                  <Printer className="h-3.5 w-3.5" /> प्रिंट / सेव
                </button>
              </div>
              {result.ok ? (
                <div className="mt-3 space-y-3" aria-live="polite">
                  {result.stats.map((s, i) => (
                    <div key={i} className={s.primary ? 'rounded-lg bg-card border p-3' : ''}>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`font-bold ${s.primary ? 'text-2xl' : 'text-lg'} ${toneCls(s.tone)}`}>{s.value}</p>
                    </div>
                  ))}
                  {result.note && <p className="text-xs text-muted-foreground pt-1">{result.note}</p>}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">{result.note || 'कृपया सभी मान भरें।'}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table (amortization / schedule / growth) */}
        {result.ok && result.table && result.table.rows.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-primary text-primary-foreground">
                <tr>{result.table.head.map((h, i) => <th key={i} className="text-left font-semibold p-2.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {result.table.rows.map((row, ri) => (
                  <tr key={ri} className="even:bg-muted/40 border-b">{row.map((c, ci) => <td key={ci} className="p-2.5 align-top">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paired educational article — deep dive (cluster spoke) */}
        {paired && (
          <Link to={`/blog/${paired.slug}`} className="mt-6 block">
            <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">पूरा गहराई से समझें · लेख</p>
                  <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">{paired.title} <ArrowRight className="h-4 w-4" /></p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Formula / Explanation / Example / Mistakes */}
        <Section icon={<Sigma className="h-4 w-4 text-violet-500" />} title="सूत्र"><GuideMarkdown source={config.formula} /></Section>
        <Section icon={<BookOpen className="h-4 w-4 text-primary" />} title="समझाइश"><GuideMarkdown source={config.explanation} /></Section>
        <Section icon={<Lightbulb className="h-4 w-4 text-amber-500" />} title="उदाहरण"><GuideMarkdown source={config.example} /></Section>
        <Section icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} title="आम गलतियाँ"><GuideMarkdown source={config.mistakes} /></Section>

        {/* FAQ */}
        {config.faqs && config.faqs.length > 0 && (
          <Section icon={<HelpCircle className="h-4 w-4 text-sky-500" />} title="अक्सर पूछे जाने वाले प्रश्न">
            <div className="space-y-3">
              {config.faqs.map((f, i) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <p className="font-semibold text-foreground text-sm">{f.q}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Related glossary */}
        {glossaryTerms.length > 0 && (
          <Section icon={<Link2 className="h-4 w-4 text-violet-500" />} title="जुड़े शब्द (शब्दकोश)">
            <div className="flex flex-wrap gap-2">
              {glossaryTerms.map((t) => (
                <Link key={t.slug} to={`/glossary/${t.slug}`} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border bg-card hover:border-primary/50 hover:text-primary transition-colors">
                  {t.hindiName || t.title} <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* Related software module */}
        {config.relatedModules.length > 0 && (
          <Section icon={<MonitorPlay className="h-4 w-4 text-emerald-600" />} title="इसे SahakarLekha में करें">
            <div className="flex flex-wrap gap-2">
              {config.relatedModules.map((m) => (
                <Link key={m.route} to={m.route}><Button variant="outline" size="sm" className="gap-1">{m.label} <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
              ))}
            </div>
          </Section>
        )}

        {/* Cookbook edge: how to RECORD what this calculator computes (GOS-11) */}
        {(() => {
          const entries = cookbookForCalc(config.slug)
            .map((s) => COOKBOOK_ENTRIES.find((e) => e.slug === s))
            .filter((e): e is NonNullable<typeof e> => e != null);
          if (!entries.length) return null;
          return (
            <Section icon={<BookOpen className="h-4 w-4 text-amber-600" />} title="एंट्री कैसे दर्ज करें (कुकबुक)">
              <div className="grid sm:grid-cols-2 gap-3">
                {entries.map((e) => (
                  <Link key={e.slug} to={`/cookbook/${e.slug}`} className="block">
                    <Card className="hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      <CardContent className="p-4">
                        <p className="font-medium text-foreground flex items-center gap-1">{e.title} <ArrowRight className="h-3.5 w-3.5 text-primary" /></p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{e.scenario}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </Section>
          );
        })()}

        {/* Related articles + help */}
        {(config.relatedArticles.length > 0 || (config.relatedHelp && config.relatedHelp.length > 0)) && (
          <Section icon={<FileText className="h-4 w-4 text-indigo-500" />} title="और पढ़ें">
            <div className="space-y-2 text-sm">
              {config.relatedArticles.map((a) => (
                <Link key={a.slug} to={`/blog/${a.slug}`} className="flex items-center gap-2 text-primary hover:underline"><ArrowRight className="h-3.5 w-3.5" /> {a.title}</Link>
              ))}
              {config.relatedHelp?.map((h) => (
                <Link key={h.slug} to={`/help/${h.slug}`} className="flex items-center gap-2 text-primary hover:underline"><HelpCircle className="h-3.5 w-3.5" /> {h.title}</Link>
              ))}
            </div>
          </Section>
        )}

        {/* Learning path (cluster spine) */}
        <Section icon={<GraduationCap className="h-4 w-4 text-teal-600" />} title="सीखने का रास्ता">
          <ol className="space-y-2">
            {glossaryTerms[0] && (
              <li>
                <Link to={`/glossary/${glossaryTerms[0].slug}`} className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <span className="text-sm text-foreground group-hover:text-primary">पहले समझें: <b>{glossaryTerms[0].hindiName || glossaryTerms[0].title}</b> (शब्दकोश)</span>
                </Link>
              </li>
            )}
            <li>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">{glossaryTerms[0] ? 2 : 1}</span>
                <span className="text-sm text-foreground">अभी गणना करें: <b>{config.hindiName}</b> (इसी पेज पर)</span>
              </div>
            </li>
            {paired && (
              <li>
                <Link to={`/blog/${paired.slug}`} className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{glossaryTerms[0] ? 3 : 2}</span>
                  <span className="text-sm text-foreground group-hover:text-primary">गहराई से पढ़ें: <b>{paired.title}</b></span>
                </Link>
              </li>
            )}
            {relatedCalcs[0] && (
              <li>
                <Link to={`/tools/${relatedCalcs[0].slug}`} className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{(glossaryTerms[0] ? 1 : 0) + (paired ? 1 : 0) + 2}</span>
                  <span className="text-sm text-foreground group-hover:text-primary">आगे आज़माएँ: <b>{relatedCalcs[0].hindiName}</b></span>
                </Link>
              </li>
            )}
          </ol>
        </Section>

        {/* Related calculators (cluster) */}
        {relatedCalcs.length > 0 && (
          <Section icon={<CalcIcon className="h-4 w-4 text-indigo-500" />} title="जुड़े कैलकुलेटर">
            <div className="grid sm:grid-cols-2 gap-2">
              {relatedCalcs.map((rc) => (
                <Link key={rc.slug} to={`/tools/${rc.slug}`} className="group flex items-center justify-between gap-2 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">{rc.hindiName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{rc.englishName}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                </Link>
              ))}
            </div>
            <Link to="/tools" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3">सभी कैलकुलेटर देखें <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Section>
        )}

        {/* Was this helpful */}
        <HelpfulWidget />

        {/* CTA */}
        <Card className="mt-6 bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <p className="font-bold text-lg text-foreground">अपनी समिति का पूरा हिसाब डिजिटल कीजिए — मुफ्त</p>
            <p className="text-sm text-muted-foreground mt-1">कैलकुलेटर से रिपोर्ट तक, सब एक जगह — सहकारी समितियों के लिए ही बना।</p>
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              <Link to="/register"><Button className="gap-2">मुफ्त रजिस्टर करें <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/tools"><Button variant="outline">सभी कैलकुलेटर</Button></Link>
            </div>
          </CardContent>
        </Card>

        {/* Evidence note */}
        <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> शैक्षिक · Evidence Level A</span>
          {config.relatedKIs.length > 0 && <span className="font-mono opacity-70">ज्ञान-स्रोत: {config.relatedKIs.join(', ')}</span>}
        </div>
      </main>
    </PublicLayout>
  );
};

export default CalculatorShell;
