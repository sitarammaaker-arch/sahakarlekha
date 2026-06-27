/**
 * CalculatorHub — /tools. A searchable directory of all calculators (from the registry,
 * single source of truth). Reuses PublicLayout + design system + SEO.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { CALCULATORS } from '@/content/calculators';
import { Home, ChevronRight, Search, Calculator as CalcIcon, ArrowRight, Sparkles } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const CalculatorHub: React.FC = () => {
  const [q, setQ] = React.useState('');
  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return CALCULATORS;
    return CALCULATORS.filter((c) =>
      `${c.title} ${c.hindiName} ${c.englishName} ${c.category} ${c.keywords.join(' ')}`.toLowerCase().includes(t),
    );
  }, [q]);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'सहकारी लेखांकन कैलकुलेटर — SahakarLekha',
      description: 'सहकारी समिति के लिए मुफ्त कैलकुलेटर — ब्याज, EMI, डेप्रिसिएशन, GST, TDS, शेयर कैपिटल, प्रतिशत व अधिक।',
      inLanguage: 'hi',
      url: `${SITE}/tools`,
      hasPart: CALCULATORS.map((c) => ({ '@type': 'WebApplication', name: c.englishName, url: `${SITE}/tools/${c.slug}` })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'होम', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'कैलकुलेटर', item: `${SITE}/tools` },
      ],
    },
  ];

  useDocumentMeta({
    title: 'सहकारी लेखांकन कैलकुलेटर (Calculators) — मुफ्त | SahakarLekha',
    description: 'ब्याज, EMI, डेप्रिसिएशन, GST, TDS, शेयर कैपिटल, कैश अंतर, प्रतिशत व वर्किंग कैपिटल — सहकारी समिति के लिए मुफ्त, आसान कैलकुलेटर, सूत्र व समझाइश सहित।',
    canonicalPath: '/tools',
    jsonLd,
  });

  return (
    <PublicLayout>
      <header className="relative overflow-hidden bg-gradient-to-br from-sky-600 to-indigo-700">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '18px 18px', color: '#fff' }} aria-hidden="true" />
        <CalcIcon className="absolute -bottom-10 -right-6 h-56 w-56 text-white/15" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 py-12 md:py-14">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-white/80 mb-4" aria-label="breadcrumb">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-white"><Home className="h-3.5 w-3.5" /> होम</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white">कैलकुलेटर</span>
          </nav>
          <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">सहकारी लेखांकन कैलकुलेटर</h1>
          <p className="text-white/90 text-lg mt-3 max-w-2xl">ब्याज, EMI, डेप्रिसिएशन, GST, TDS और अधिक — मुफ्त, तुरंत, सूत्र व समझाइश सहित।</p>
          <div className="mt-6 relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="कैलकुलेटर खोजें — EMI, GST, ब्याज, डेप्रिसिएशन…" aria-label="कैलकुलेटर खोजें" className="pl-9 h-12 bg-white text-foreground" />
          </div>
          <p className="text-white/70 text-xs mt-3 inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> {CALCULATORS.length} कैलकुलेटर · कोई वैधानिक दर तय नहीं (आप डालते हैं)</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground mb-4">“{q}” के लिए कोई कैलकुलेटर नहीं मिला।</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <Link key={c.slug} to={`/tools/${c.slug}`} className="group block">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">{c.hindiName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.englishName}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{c.intro}</p>
                  <span className="inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.category}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </PublicLayout>
  );
};

export default CalculatorHub;
