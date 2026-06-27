/**
 * SiteSearch — public site-wide search at /search?q=… across Help, Cookbook,
 * Guide and Blog. Client-side (src/lib/siteSearch.ts), Hindi/Hinglish/typo tolerant.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { trackEvent } from '@/lib/analytics';
import { search, TYPE_LABEL, type SearchType } from '@/lib/siteSearch';
import { allGlossary } from '@/content/glossary';
import { Search as SearchIcon, ArrowRight, BookOpen } from 'lucide-react';
import { WHATSAPP_NUMBER } from '@/lib/socials';

const TYPE_ORDER: SearchType[] = ['glossary', 'calculator', 'help', 'faq', 'cookbook', 'guide', 'blog'];

// A few high-value glossary terms suggested when the box is empty.
const SUGGESTED_SLUGS = ['voucher', 'cash-book', 'ledger', 'double-entry', 'bank-book', 'membership', 'share', 'financial-year', 'accounting', 'society-setup'];

const SiteSearch: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = React.useState(q);
  // Live results as the user types (deferred keeps typing responsive on big indexes).
  const deferred = React.useDeferredValue(input.trim());

  useDocumentMeta({
    title: q ? `"${q}" — खोज परिणाम | SahakarLekha` : 'खोजें — SahakarLekha मदद, कुकबुक, गाइड, ब्लॉग व शब्दकोश',
    description: 'सहकारी समिति लेखांकन से जुड़ा कुछ भी खोजें — मदद लेख, एंट्री कुकबुक, गाइड अध्याय, ब्लॉग और शब्दकोश, एक साथ।',
    canonicalPath: '/search',
  });

  React.useEffect(() => { setInput(q); }, [q]);

  const results = React.useMemo(() => (deferred ? search(deferred) : []), [deferred]);
  const suggested = React.useMemo(() => allGlossary().filter((g) => SUGGESTED_SLUGS.includes(g.slug)), []);

  // Fire a search event when the committed (URL) query changes — for analytics + shareable URLs.
  React.useEffect(() => {
    if (q) trackEvent('site_search', { q, results: search(q).length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    setParams(v ? { q: v } : {});
  };

  const grouped = TYPE_ORDER.map((t) => ({ type: t, items: results.filter((r) => r.type === t) })).filter((g) => g.items.length);

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-5">खोजें</h1>
        <form onSubmit={submit} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            placeholder="जैसे: member kaise jode, ट्रायल बैलेंस, loan entry, क्लोज़िंग स्टॉक…"
            className="w-full rounded-xl border border-border bg-background pl-12 pr-4 py-3.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </form>

        {deferred && (
          <p className="text-sm text-muted-foreground mt-4" aria-live="polite">
            "<span className="text-foreground font-medium">{deferred}</span>" के लिए {results.length} परिणाम
          </p>
        )}

        {/* Results */}
        <div className="mt-6 space-y-8">
          {grouped.map((g) => (
            <div key={g.type}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">{TYPE_LABEL[g.type]}</h2>
              <div className="space-y-3">
                {g.items.map((r) => (
                  <Link key={r.id} to={r.url} className="block">
                    <Card className="hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      <CardContent className="p-4">
                        <p className="font-semibold text-foreground flex items-center gap-1">{r.title} <ArrowRight className="h-3.5 w-3.5 text-primary" /></p>
                        {r.snippet && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.snippet}</p>}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Empty / no-results states */}
        {deferred && results.length === 0 && (
          <div className="mt-10 text-center">
            <p className="text-muted-foreground">कोई परिणाम नहीं मिला।</p>
            <p className="text-sm text-muted-foreground mt-2">
              अलग शब्दों में आज़माएँ, <Link to="/glossary" className="text-primary hover:underline">शब्दकोश देखें</Link>, या{' '}
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">WhatsApp पर पूछें</a>।
            </p>
          </div>
        )}
        {!deferred && (
          <div className="mt-8 space-y-6">
            <div className="grid sm:grid-cols-2 gap-3">
              <Link to="/help"><Card className="hover:bg-primary/5"><CardContent className="p-4"><p className="font-medium text-foreground">मदद केंद्र — कैसे करें →</p></CardContent></Card></Link>
              <Link to="/cookbook"><Card className="hover:bg-primary/5"><CardContent className="p-4"><p className="font-medium text-foreground">एंट्री कुकबुक — Dr/Cr →</p></CardContent></Card></Link>
            </div>
            {/* Suggested glossary terms */}
            <div>
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary mb-3">
                <BookOpen className="h-3.5 w-3.5" /> लोकप्रिय शब्द · शब्दकोश
              </h2>
              <div className="flex flex-wrap gap-2">
                {suggested.map((g) => (
                  <Link key={g.slug} to={`/glossary/${g.slug}`} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border bg-card hover:border-primary/50 hover:text-primary transition-colors">
                    {g.hindiName || g.title}
                  </Link>
                ))}
                <Link to="/glossary" className="inline-flex items-center gap-1 text-sm px-3 py-1.5 text-primary hover:underline">
                  पूरा शब्दकोश <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default SiteSearch;
