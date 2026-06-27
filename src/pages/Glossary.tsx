/**
 * Glossary index — /glossary. A fast, searchable, A–Z directory of cooperative
 * accounting terms. Every term is generated from an ACTIVE Knowledge Item
 * (KPP Wave-1A) via the glossary adapter — no hand-written entries here.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { allGlossary, filterGlossary, glossaryByLetter } from '@/content/glossary';
import { Home, ChevronRight, Search, BookMarked, ArrowRight, Sparkles } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const Glossary: React.FC = () => {
  const [q, setQ] = React.useState('');
  const all = allGlossary();
  const filtered = q.trim() ? filterGlossary(q) : null;
  const groups = glossaryByLetter();
  const letters = groups.map((g) => g.letter);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: 'सहकारी लेखांकन शब्दकोश — SahakarLekha Glossary',
      description: 'सहकारी समिति लेखांकन, बैंकिंग व प्रबंधन के मुख्य शब्द — आसान हिन्दी व English में।',
      inLanguage: 'hi',
      url: `${SITE}/glossary`,
      hasDefinedTerm: all.map((e) => ({
        '@type': 'DefinedTerm',
        name: e.hindiName ? `${e.hindiName} (${e.englishName})` : e.title,
        url: `${SITE}/glossary/${e.slug}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'होम', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'शब्दकोश', item: `${SITE}/glossary` },
      ],
    },
  ];

  useDocumentMeta({
    title: 'सहकारी लेखांकन शब्दकोश (Glossary) — हर शब्द आसान भाषा में | SahakarLekha',
    description: 'रोकड़ बही से बैलेंस शीट तक — सहकारी समिति लेखांकन के मुख्य शब्दों का आसान हिन्दी व English शब्दकोश। हर शब्द से जुड़ी गाइड, मदद व सॉफ्टवेयर तक पहुँचें।',
    canonicalPath: '/glossary',
    jsonLd,
  });

  return (
    <PublicLayout>
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700">
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '18px 18px', color: '#fff' }}
          aria-hidden="true"
        />
        <BookMarked className="absolute -bottom-10 -right-6 h-56 w-56 text-white/15" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 py-12 md:py-14">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-white/80 mb-4" aria-label="breadcrumb">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-white"><Home className="h-3.5 w-3.5" /> होम</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white">शब्दकोश</span>
          </nav>
          <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">सहकारी लेखांकन शब्दकोश</h1>
          <p className="text-white/90 text-lg mt-3 max-w-2xl">
            हर ज़रूरी शब्द — आसान हिन्दी व English में। समझें, और सीधे जुड़ी गाइड, मदद या सॉफ्टवेयर तक पहुँचें।
          </p>
          {/* Search */}
          <div className="mt-6 relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="शब्द खोजें — रोकड़ बही, voucher, खाता, debit…"
              aria-label="शब्दकोश में खोजें"
              className="pl-9 h-12 bg-white text-foreground"
            />
          </div>
          <p className="text-white/70 text-xs mt-3 inline-flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> {all.length} शब्द · ज्ञान-आधारित (हर शब्द एक सत्यापित Knowledge Item से)
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* A–Z jump bar (hidden while searching) */}
        {!filtered && (
          <nav className="flex flex-wrap gap-1.5 mb-8 justify-center" aria-label="A to Z">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l}`} className="h-8 w-8 rounded-md border flex items-center justify-center text-sm font-semibold text-muted-foreground hover:bg-primary hover:text-white hover:border-primary transition-colors">
                {l}
              </a>
            ))}
          </nav>
        )}

        {/* Search results */}
        {filtered && (
          <section aria-live="polite">
            <p className="text-sm text-muted-foreground mb-4">
              {filtered.length > 0 ? `${filtered.length} परिणाम “${q}” के लिए` : `“${q}” के लिए कोई शब्द नहीं मिला`}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map((e) => <TermCard key={e.slug} entry={e} />)}
            </div>
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                पूरी साइट में खोजें? <Link to="/search" className="text-primary hover:underline">साइट खोज खोलें →</Link>
              </p>
            )}
          </section>
        )}

        {/* A–Z listing */}
        {!filtered && groups.map((g) => (
          <section key={g.letter} id={`letter-${g.letter}`} className="mb-10 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">{g.letter}</span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {g.items.map((e) => <TermCard key={e.slug} entry={e} />)}
            </div>
          </section>
        ))}
      </div>
    </PublicLayout>
  );
};

const TermCard: React.FC<{ entry: ReturnType<typeof allGlossary>[number] }> = ({ entry }) => (
  <Link to={`/glossary/${entry.slug}`} className="group block">
    <Card className="h-full transition-all hover:border-primary/50 hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
              {entry.hindiName || entry.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{entry.englishName}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1" />
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{entry.definition}</p>
        {entry.category && (
          <span className="inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{entry.category}</span>
        )}
      </CardContent>
    </Card>
  </Link>
);

export default Glossary;
