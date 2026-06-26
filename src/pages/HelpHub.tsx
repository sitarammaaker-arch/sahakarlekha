/**
 * HelpHub — the Help Center landing at /help (the DO layer). Lists task-oriented
 * "kaise kare" articles by category. Distinct from /guide (LEARN) and /blog (narrative).
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { HELP_TASKS, HELP_CATEGORIES } from '@/content/help';
import { LifeBuoy, Clock, ArrowRight, Search as SearchIcon } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const HelpHub: React.FC = () => {
  const navigate = useNavigate();
  const [q, setQ] = React.useState('');
  const onSearch = (e: React.FormEvent) => { e.preventDefault(); const v = q.trim(); if (v) navigate(`/search?q=${encodeURIComponent(v)}`); };
  useDocumentMeta({
    title: 'मदद केंद्र (Help Center) — कैसे करें | SahakarLekha',
    description: 'सहकारी समिति लेखांकन के रोज़मर्रा के काम — Member कैसे जोड़ें, Opening Balance कैसे डालें, Voucher कैसे करें — आसान स्टेप-बाय-स्टेप, सीधे app में करने के लिंक सहित।',
    canonicalPath: '/help',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'मदद केंद्र', item: `${SITE}/help` }],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: HELP_TASKS.map((t, i) => ({
          '@type': 'ListItem', position: i + 1, name: t.title, url: `${SITE}/help/${t.slug}`,
        })),
      },
    ],
  });

  return (
    <PublicLayout>
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <LifeBuoy className="h-11 w-11 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">मदद केंद्र — कैसे करें</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            हर काम के लिए छोटा, सीधा स्टेप-बाय-स्टेप — और हर लेख से सीधे SahakarLekha में वही काम करने का लिंक।
          </p>
          {/* Site-wide search entry */}
          <form onSubmit={onSearch} className="relative max-w-xl mx-auto mt-6">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="खोजें: member kaise jode, ट्रायल बैलेंस, loan entry…"
              className="w-full rounded-xl border border-border bg-background pl-12 pr-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </form>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 space-y-10">
          {HELP_CATEGORIES.map((cat) => (
            <div key={cat}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-4">{cat}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {HELP_TASKS.filter((t) => t.category === cat).map((t) => (
                  <Link key={t.slug} to={`/help/${t.slug}`} className="block">
                    <Card className="h-full hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      <CardContent className="p-5">
                        <p className="font-semibold text-foreground flex items-center gap-1">
                          {t.title} <ArrowRight className="h-4 w-4 text-primary" />
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.tldr}</p>
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {t.estTime}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
};

export default HelpHub;
