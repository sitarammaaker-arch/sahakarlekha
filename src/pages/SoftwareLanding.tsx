/**
 * SoftwareLanding — society-type SEO/marketing landing pages.
 *  - /software         → hub listing all society types
 *  - /software/:type   → a focused page targeting that type's search keyword
 * Hindi-first, bilingual, with per-type meta + structured data. Uses PublicLayout.
 */
import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Link } from '@/components/LocalLink';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { SOCIETY_TYPES, findSocietyType } from '@/content/societyTypes';
import { STATES } from '@/content/states';
import { contentForSociety } from '@/content/relatedContent';
import RelatedKnowledge from '@/components/RelatedKnowledge';
import { ArrowRight, CheckCircle2, AlertTriangle, GraduationCap, ShieldCheck, Home } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import HindiOnlyNotice from '@/components/HindiOnlyNotice';

const SITE = 'https://sahakarlekha.com';

const SoftwareLanding: React.FC = () => {
  const { type } = useParams();
  const data = type ? findSocietyType(type) : null;

  // Unknown type → send to the hub.
  if (type && !data) return <Navigate to="/software" replace />;

  return data ? <TypePage data={data} /> : <HubPage />;
};

/* ── Hub: /software ─────────────────────────────────────────────────────────── */
const HubPage: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L('सहकारी समिति लेखा सॉफ्टवेयर | Cooperative Society Software', 'Cooperative Society Accounting Software | SahakarLekha'),
    description: L('PACS, दुग्ध, विपणन, उपभोक्ता, आवास, चीनी, श्रमिक व बहुउद्देशीय — हर प्रकार की सहकारी समिति के लिए लेखा सॉफ्टवेयर, ₹2,999/year + GST से। अपनी समिति का प्रकार चुनें।', 'PACS, dairy, marketing, consumer, housing, sugar, labour and multipurpose — accounting software for every type of cooperative society, from ₹2,999/year + GST. Choose your society type.'),
    canonicalPath: '/software',
  });

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> {L('होम', 'Home')}</Link>
          <span>/</span><span className="text-foreground font-medium">{L('सॉफ्टवेयर', 'Software')}</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight">
          {L('हर प्रकार की सहकारी समिति के लिए लेखा सॉफ्टवेयर', 'Accounting software for every type of cooperative society')}
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          {L('अपनी समिति का प्रकार चुनें — हर प्रकार के लिए अनुकूलित खाता-संरचना (COA), रिपोर्ट व अनुपालन।', 'Choose your society type — a chart of accounts (COA), reports and compliance tailored to each type.')}
          {language === 'hi' && <span className="block mt-1 text-sm">Cooperative society accounting software, tailored for every society type in India — from ₹2,999/year + GST.</span>}
        </p>
        <HindiOnlyNotice className="mt-4" what="The short description on each society-type card" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {SOCIETY_TYPES.map((s) => (
            <Link key={s.slug} to={`/software/${s.slug}`} className="group block h-full">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="p-5 flex gap-3 h-full">
                  <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <s.Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{L(s.nameHi, s.nameEn)}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.introHi}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/register"><Button className="gap-2">{L('रजिस्टर करें', 'Register')} <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/guide"><Button variant="outline" className="gap-2"><GraduationCap className="h-4 w-4" /> {L('सीखें (मुफ़्त गाइड)', 'Learn (free guide)')}</Button></Link>
        </div>

        {STATES.length > 0 && (
          <div className="mt-12 pt-6 border-t">
            <p className="text-sm font-semibold text-muted-foreground mb-3">{L('राज्य के अनुसार', 'By state')}</p>
            <div className="flex flex-wrap gap-2">
              {STATES.map((s) => (
                <Link key={s.slug} to={`/cooperative-software/${s.slug}`} className="text-sm px-3 py-1.5 rounded-full border bg-muted/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                  {L(s.nameHi, s.nameEn)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

/* ── Type page: /software/:type ─────────────────────────────────────────────── */
const TypePage: React.FC<{ data: NonNullable<ReturnType<typeof findSocietyType>> }> = ({ data }) => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L(data.metaTitle, `${data.nameEn} Accounting Software | SahakarLekha`),
    description: L(data.metaDescription, data.seoEn),
    canonicalPath: `/software/${data.slug}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: data.metaTitle,
      description: data.metaDescription,
      url: `${SITE}/software/${data.slug}`,
      inLanguage: 'hi',
      isPartOf: { '@type': 'WebSite', name: 'SahakarLekha', url: SITE },
      about: {
        '@type': 'SoftwareApplication',
        name: 'SahakarLekha',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '1499', priceCurrency: 'INR' },
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Software', item: `${SITE}/software` },
          { '@type': 'ListItem', position: 2, name: data.nameEn, item: `${SITE}/software/${data.slug}` },
        ],
      },
    },
  });

  const others = SOCIETY_TYPES.filter((s) => s.slug !== data.slug);

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> {L('होम', 'Home')}</Link>
          <span>/</span><Link to="/software" className="hover:text-primary">{L('सॉफ्टवेयर', 'Software')}</Link>
          <span>/</span><span className="text-foreground font-medium line-clamp-1">{L(data.nameHi, data.nameEn)}</span>
        </nav>

        {/* Hero */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <data.Icon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-foreground leading-tight">{L(data.h1Hi, `Accounting software for ${data.nameEn}`)}</h1>
            <p className="mt-3 text-muted-foreground">{L(data.introHi, data.seoEn)}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/register"><Button className="gap-2">{L('शुरू करें', 'Get started')} <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/guide"><Button variant="outline" className="gap-2"><GraduationCap className="h-4 w-4" /> {L('मुफ़्त गाइड', 'Free guide')}</Button></Link>
        </div>

        {/* Pains + Solves */}
        <HindiOnlyNotice className="mt-10" what="This list of challenges and solutions" />
        <div className="grid md:grid-cols-2 gap-4 mt-10">
          <Card className="border-amber-200">
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 font-semibold text-foreground mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> {L(`${data.nameHi} की चुनौतियाँ`, `Challenges for ${data.nameEn}`)}
              </h2>
              <ul className="space-y-2">
                {data.painsHi.map((p, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-amber-600">•</span>{p}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 font-semibold text-foreground mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> {L('SahakarLekha में समाधान', 'How SahakarLekha solves them')}
              </h2>
              <ul className="space-y-2">
                {data.solvesHi.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> {L('RCS ऑडिट प्रारूप', 'RCS audit format')}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> {L('TDS · GST सारांश', 'TDS · GST summary')}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> {L('हिंदी + English', 'Hindi + English')}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> {L('₹2,999/year + GST से', 'From ₹2,999/year + GST')}</span>
        </div>

        {/* Knowledge-graph edges: type-specific guide/blog/help/cookbook (GOS-11) */}
        <RelatedKnowledge links={contentForSociety(data.slug)} heading={L(`${data.nameHi} के लिए और सीखें`, `Learn more for ${data.nameEn}`)} />

        {/* English SEO paragraph */}
        {language === 'hi' && <p className="mt-8 text-sm text-muted-foreground leading-relaxed border-t pt-6">{data.seoEn}</p>}

        {/* CTA */}
        <div className="mt-8 rounded-xl bg-primary/5 border border-primary/20 p-6 text-center">
          <p className="font-semibold text-foreground">{L(`अपनी ${data.nameHi} का खाता आज ही डिजिटल करें — ₹2,999/year + GST से।`, `Take your ${data.nameEn} accounts digital today — from ₹2,999/year + GST.`)}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button className="gap-2">{L('रजिस्टर करें', 'Register')} <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/contact"><Button variant="outline">{L('डेमो/संपर्क', 'Demo / Contact')}</Button></Link>
          </div>
        </div>

        {/* Other types */}
        <div className="mt-12 pt-6 border-t">
          <p className="text-sm font-semibold text-muted-foreground mb-3">{L('अन्य समिति प्रकार', 'Other society types')}</p>
          <div className="flex flex-wrap gap-2">
            {others.map((s) => (
              <Link key={s.slug} to={`/software/${s.slug}`} className="text-sm px-3 py-1.5 rounded-full border bg-muted/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                {L(s.nameHi, s.nameEn)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default SoftwareLanding;
