/**
 * SoftwareLanding — society-type SEO/marketing landing pages.
 *  - /software         → hub listing all society types
 *  - /software/:type   → a focused page targeting that type's search keyword
 * Hindi-first, bilingual, with per-type meta + structured data. Uses PublicLayout.
 */
import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { SOCIETY_TYPES, findSocietyType } from '@/content/societyTypes';
import { ArrowRight, CheckCircle2, AlertTriangle, GraduationCap, ShieldCheck, Home } from 'lucide-react';

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
  useDocumentMeta({
    title: 'सहकारी समिति लेखा सॉफ्टवेयर — हर प्रकार के लिए | Cooperative Society Software',
    description: 'PACS, दुग्ध, विपणन, उपभोक्ता, आवास, चीनी, श्रमिक व बहुउद्देशीय — हर प्रकार की सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर। अपनी समिति का प्रकार चुनें।',
    canonicalPath: '/software',
  });

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> होम</Link>
          <span>/</span><span className="text-foreground font-medium">सॉफ्टवेयर</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight">
          हर प्रकार की सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          अपनी समिति का प्रकार चुनें — हर प्रकार के लिए अनुकूलित खाता-संरचना (COA), रिपोर्ट व अनुपालन।
          <span className="block mt-1 text-sm">Free cooperative society accounting software, tailored for every society type in India.</span>
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {SOCIETY_TYPES.map((s) => (
            <Link key={s.slug} to={`/software/${s.slug}`} className="group block h-full">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="p-5 flex gap-3 h-full">
                  <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <s.Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{s.nameHi}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.introHi}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/register"><Button className="gap-2">मुफ़्त रजिस्टर करें <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/guide"><Button variant="outline" className="gap-2"><GraduationCap className="h-4 w-4" /> सीखें (मुफ़्त गाइड)</Button></Link>
        </div>
      </div>
    </PublicLayout>
  );
};

/* ── Type page: /software/:type ─────────────────────────────────────────────── */
const TypePage: React.FC<{ data: NonNullable<ReturnType<typeof findSocietyType>> }> = ({ data }) => {
  useDocumentMeta({
    title: data.metaTitle,
    description: data.metaDescription,
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
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
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
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> होम</Link>
          <span>/</span><Link to="/software" className="hover:text-primary">सॉफ्टवेयर</Link>
          <span>/</span><span className="text-foreground font-medium line-clamp-1">{data.nameHi}</span>
        </nav>

        {/* Hero */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <data.Icon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-foreground leading-tight">{data.h1Hi}</h1>
            <p className="mt-3 text-muted-foreground">{data.introHi}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/register"><Button className="gap-2">मुफ़्त शुरू करें <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/guide"><Button variant="outline" className="gap-2"><GraduationCap className="h-4 w-4" /> मुफ़्त गाइड</Button></Link>
        </div>

        {/* Pains + Solves */}
        <div className="grid md:grid-cols-2 gap-4 mt-10">
          <Card className="border-amber-200">
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 font-semibold text-foreground mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> {data.nameHi} की चुनौतियाँ
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
                <CheckCircle2 className="h-4 w-4 text-green-600" /> SahakarLekha में समाधान
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
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> RCS ऑडिट प्रारूप</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> TDS 26Q · GST</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> हिंदी + English</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> 100% मुफ़्त</span>
        </div>

        {/* English SEO paragraph */}
        <p className="mt-8 text-sm text-muted-foreground leading-relaxed border-t pt-6">{data.seoEn}</p>

        {/* CTA */}
        <div className="mt-8 rounded-xl bg-primary/5 border border-primary/20 p-6 text-center">
          <p className="font-semibold text-foreground">अपनी {data.nameHi} का खाता आज ही डिजिटल करें — बिल्कुल मुफ़्त।</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button className="gap-2">मुफ़्त रजिस्टर करें <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/contact"><Button variant="outline">डेमो/संपर्क</Button></Link>
          </div>
        </div>

        {/* Other types */}
        <div className="mt-12 pt-6 border-t">
          <p className="text-sm font-semibold text-muted-foreground mb-3">अन्य समिति प्रकार</p>
          <div className="flex flex-wrap gap-2">
            {others.map((s) => (
              <Link key={s.slug} to={`/software/${s.slug}`} className="text-sm px-3 py-1.5 rounded-full border bg-muted/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                {s.nameHi}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default SoftwareLanding;
