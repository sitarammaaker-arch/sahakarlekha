/**
 * AskAssistant — "Ask SahakarLekha" at /ask. A GROUNDED answer assistant: it takes a
 * natural-language question, retrieves the best-matching Knowledge Objects (help, cookbook,
 * guide, blog, faq) via the existing site-search engine, and presents the top one as a
 * direct answer with citation + a few related links.
 *
 * This is the retrieval ("R") foundation of the AI copilot. By design it ONLY ever surfaces
 * real, existing content — it never generates free-form text, so it cannot fabricate numbers
 * or law (Constitution Art. VIII). A later optional layer can add LLM synthesis on top of
 * the same retrieval, behind a cost/API-key decision.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { trackEvent } from '@/lib/analytics';
import { search, TYPE_LABEL } from '@/lib/siteSearch';
import { WHATSAPP_NUMBER } from '@/lib/socials';
import { Sparkles, Send, ArrowRight, ShieldCheck } from 'lucide-react';

const EXAMPLES = [
  'member kaise jode',
  'GST जमा की एंट्री',
  'Trial Balance कैसे देखें',
  'क्लोज़िंग स्टॉक की एंट्री',
  'bank reconciliation kaise kare',
];

const AskAssistant: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = React.useState(q);

  useDocumentMeta({
    title: q ? `"${q}" — पूछें | SahakarLekha` : 'पूछें (Ask SahakarLekha) — सहकारी समिति लेखांकन सहायक',
    description: 'सहकारी समिति लेखांकन का कोई भी सवाल पूछें — मदद, एंट्री कुकबुक, गाइड व FAQ से सीधा, स्रोत-सहित जवाब। कोई अनुमान नहीं, सिर्फ़ असली जानकारी।',
    canonicalPath: '/ask',
  });

  React.useEffect(() => { setInput(q); }, [q]);
  const results = React.useMemo(() => (q ? search(q, 8) : []), [q]);
  React.useEffect(() => { if (q) trackEvent('ask_query', { q, results: results.length }); /* eslint-disable-line */ }, [q]);

  const ask = (value: string) => { const v = value.trim(); setParams(v ? { q: v } : {}); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); ask(input); };

  const top = results[0];
  const rest = results.slice(1, 6);

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Sparkles className="h-6 w-6" />
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">पूछें — Ask SahakarLekha</h1>
        </div>
        <p className="text-muted-foreground mb-5">सहकारी समिति लेखांकन का कोई भी सवाल लिखें — सीधा, स्रोत-सहित जवाब मिलेगा।</p>

        <form onSubmit={submit} className="relative">
          <input
            type="search" value={input} onChange={(e) => setInput(e.target.value)} autoFocus
            placeholder="जैसे: member kaise jode, GST जमा की एंट्री, क्लोज़िंग स्टॉक…"
            className="w-full rounded-xl border border-border bg-background pl-4 pr-12 py-3.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button type="submit" aria-label="पूछें" className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90">
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/* Example questions */}
        {!q && (
          <div className="mt-5 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => ask(ex)} className="text-sm rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Top answer */}
        {q && top && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">जवाब · स्रोत: {TYPE_LABEL[top.type]}</p>
            <Card className="border-primary/30">
              <CardContent className="p-5">
                <p className="font-bold text-lg text-foreground">{top.title}</p>
                {top.snippet && <p className="text-foreground mt-2 leading-relaxed">{top.snippet}</p>}
                <Link to={top.url} className="inline-flex items-center gap-1 text-primary font-semibold mt-3 hover:underline">
                  पूरा पढ़ें <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Related sources */}
        {q && rest.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-3">और प्रासंगिक</p>
            <div className="space-y-2">
              {rest.map((r) => (
                <Link key={r.id} to={r.url} className="block">
                  <Card className="hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    <CardContent className="p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{TYPE_LABEL[r.type]}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {q && results.length === 0 && (
          <div className="mt-10 text-center">
            <p className="text-muted-foreground">इसका सीधा जवाब अभी नहीं मिला।</p>
            <p className="text-sm text-muted-foreground mt-2">
              अलग शब्दों में आज़माएँ, या{' '}
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">WhatsApp पर पूछें</a>।
            </p>
          </div>
        )}

        {/* Grounding / safety note (Constitution Art. VIII) */}
        {q && (
          <p className="mt-8 text-xs text-muted-foreground border-t pt-4 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            ये जवाब SahakarLekha के मदद, कुकबुक, गाइड व FAQ से सीधे लिए गए हैं — कोई अनुमान नहीं। यह सामान्य जानकारी है, कानूनी/लेखा ruling नहीं; ज़रूरी मामलों में अपने ऑडिटर/RCS से पुष्टि करें।
          </p>
        )}
      </div>
    </PublicLayout>
  );
};

export default AskAssistant;
