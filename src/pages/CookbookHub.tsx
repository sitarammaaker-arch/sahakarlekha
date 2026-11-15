/**
 * CookbookHub — the Entry Cookbook landing at /cookbook (REFERENCE layer).
 * Lists "to record X, Dr/Cr this" cooperative accounting entries by category.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { COOKBOOK_ENTRIES, COOKBOOK_CATEGORIES } from '@/content/cookbook';
import { localizeCookbookEntry, cookbookCategoryLabel } from '@/content/cookbook/en';
import { BookOpenCheck, ArrowRight } from 'lucide-react';
import { HUB_META } from '@/content/hubMeta';
import { useLanguage } from '@/contexts/LanguageContext';

const SITE = 'https://sahakarlekha.com';

const CookbookHub: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L(HUB_META.cookbook.title, 'Entry Cookbook (Accounting Entries) — which entry, and how | SahakarLekha'),
    description: L(HUB_META.cookbook.description, 'Common journal entries for a cooperative society — cash/credit sales and purchases, share capital, loans and interest, salary, depreciation, closing stock, HAFED commission — each with a Dr/Cr example.'),
    canonicalPath: '/cookbook',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'एंट्री कुकबुक', item: `${SITE}/cookbook` }],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: COOKBOOK_ENTRIES.map((e, i) => ({
          '@type': 'ListItem', position: i + 1, name: e.title, url: `${SITE}/cookbook/${e.slug}`,
        })),
      },
    ],
  });

  return (
    <PublicLayout>
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <BookOpenCheck className="h-11 w-11 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">{L('एंट्री कुकबुक', 'Entry Cookbook')}</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {L('"ये लेन-देन कौन-सी एंट्री से करें?" — हर आम स्थिति का सीधा Dr/Cr, उदाहरण और सावधानियों सहित।', '"Which entry records this transaction?" — the plain Dr/Cr for every common situation, with an example and the points to watch.')}
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 space-y-10">
          {COOKBOOK_CATEGORIES.map((cat) => (
            <div key={cat}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-4">{cookbookCategoryLabel(cat, language)}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {COOKBOOK_ENTRIES.filter((e) => e.category === cat).map((raw) => localizeCookbookEntry(raw, language)).map((e) => (
                  <Link key={e.slug} to={`/cookbook/${e.slug}`} className="block">
                    <Card className="h-full hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      <CardContent className="p-5">
                        <p className="font-semibold text-foreground flex items-center gap-1">
                          {e.title} <ArrowRight className="h-4 w-4 text-primary" />
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.scenario}</p>
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

export default CookbookHub;
