/**
 * CookbookEntry — a single accounting entry at /cookbook/:slug (REFERENCE layer).
 * Shows the scenario, the Dr/Cr journal posting (the core value), example narration,
 * notes, an optional deep-link into the app, and a "पूरा समझें" guide cross-link (L7).
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
import { findCookbookEntry, relatedCookbookEntries } from '@/content/cookbook';
import { findEntry } from '@/content/guide';
import { Home, ChevronRight, ArrowRight, BookOpen, AlertTriangle } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const CookbookEntry: React.FC = () => {
  const { slug = '' } = useParams();
  const entry = findCookbookEntry(slug);
  const { isAuthenticated } = useAuth();

  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  const url = `${SITE}/cookbook/${slug}`;
  useDocumentMeta({
    title: entry?.metaTitle,
    description: entry?.metaDescription,
    canonicalPath: `/cookbook/${slug}`,
    jsonLd: entry ? [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: entry.title,
        description: entry.metaDescription,
        inLanguage: 'hi',
        url,
        publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'एंट्री कुकबुक', item: `${SITE}/cookbook` },
          { '@type': 'ListItem', position: 2, name: entry.title, item: url },
        ],
      },
    ] : undefined,
  });

  if (!entry) return <Navigate to="/cookbook" replace />;

  const guide = entry.guideSlug ? findEntry(entry.guideSlug) : null;
  const related = relatedCookbookEntries(slug);
  const ctaTo = entry.deepLink
    ? (isAuthenticated ? entry.deepLink.route : `/register?next=${encodeURIComponent(entry.deepLink.route)}`)
    : null;

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/cookbook" className="inline-flex items-center gap-1 hover:text-primary">
            <Home className="h-3.5 w-3.5" /> एंट्री कुकबुक
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{entry.title}</span>
        </nav>

        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{entry.category}</span>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-1">{entry.title}</h1>
        <p className="text-muted-foreground mt-3">{entry.scenario}</p>

        {/* The journal posting — the core value */}
        <Card className="mt-6">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 px-4 font-semibold">खाता / Account</th>
                  <th className="py-2.5 px-4 font-semibold text-right w-24">Dr / Cr</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className={`py-2.5 px-4 ${l.type === 'Cr' ? 'pl-10' : ''}`}>
                      <span className="text-foreground">{l.account}</span>
                      {l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${l.type === 'Dr' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                        {l.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-2"><span className="font-semibold text-foreground">विवरण (narration):</span> {entry.narration}</p>

        {entry.societyTypes && entry.societyTypes.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">समिति प्रकार: {entry.societyTypes.join(' · ')}</p>
        )}

        {/* CTA */}
        {entry.deepLink && ctaTo && (
          <Link to={ctaTo} onClick={() => trackEvent('cookbook_cta_click', { entry: entry.slug, authed: isAuthenticated })} className="mt-6 block">
            <Button size="lg" className="w-full gap-2">{entry.deepLink.label} <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        )}

        {/* Notes */}
        {entry.notes && entry.notes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5 mb-3"><AlertTriangle className="h-5 w-5 text-amber-500" /> ध्यान दें</h2>
            <ul className="space-y-2">
              {entry.notes.map((n, i) => (
                <li key={i} className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-2.5">{n}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Guide cross-link (L7) */}
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

        <div className="mt-8"><HelpfulWidget /></div>

        {related.length > 0 && (
          <div className="mt-10 pt-6 border-t">
            <h2 className="text-sm font-semibold text-foreground mb-3">मिलती-जुलती entries</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <Link key={r.slug} to={`/cookbook/${r.slug}`} className="block">
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

        {/* Reference disclaimer (Constitution: education, not a ruling) */}
        <p className="mt-8 text-xs text-muted-foreground border-t pt-4">
          यह संदर्भ-शिक्षा है, कोई कानूनी/लेखा ruling नहीं। आपकी समिति के बायलॉज़ व राज्य नियम अलग हो सकते हैं — संदेह हो तो अपने ऑडिटर/RCS से पुष्टि करें।
        </p>
      </div>
    </PublicLayout>
  );
};

export default CookbookEntry;
