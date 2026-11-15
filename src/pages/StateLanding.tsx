/**
 * StateLanding — state-wise SEO/marketing landing pages at
 * /cooperative-software/:state. Cooperatives are state-regulated, so each page
 * carries genuinely state-specific facts (Act, Registrar, apex bodies). Hindi-first,
 * bilingual meta + structured data. Uses PublicLayout. Data: src/content/states.ts.
 */
import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Link } from '@/components/LocalLink';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { findState } from '@/content/states';
import { SOCIETY_TYPES } from '@/content/societyTypes';
import { contentForState } from '@/content/relatedContent';
import RelatedKnowledge from '@/components/RelatedKnowledge';
import { ArrowRight, CheckCircle2, GraduationCap, ShieldCheck, Home, Scale } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import HindiOnlyNotice from '@/components/HindiOnlyNotice';

const SITE = 'https://sahakarlekha.com';

const StateLanding: React.FC = () => {
  const { state } = useParams();
  const data = state ? findState(state) : null;
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);

  const path = data ? `/cooperative-software/${data.slug}` : '';
  // Hook must run unconditionally (rules-of-hooks) — all fields are undefined-safe.
  useDocumentMeta(data ? {
    title: L(data.metaTitle, `${data.nameEn} Cooperative Society Software | SahakarLekha`),
    description: L(data.metaDescription, data.seoEn),
    canonicalPath: path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: data.metaTitle,
      description: data.metaDescription,
      url: `${SITE}${path}`,
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
          { '@type': 'ListItem', position: 2, name: `${data.nameEn} Cooperative Software`, item: `${SITE}${path}` },
        ],
      },
    },
  } : {});

  // Unknown / missing state → send to the software hub.
  if (!data) return <Navigate to="/software" replace />;

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
            <h1 className="text-2xl md:text-4xl font-extrabold text-foreground leading-tight">{L(data.h1Hi, `${data.nameEn} cooperative society accounting software`)}</h1>
            <p className="mt-3 text-muted-foreground">{L(data.introHi, data.seoEn)}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/register"><Button className="gap-2">{L('शुरू करें', 'Get started')} <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/guide"><Button variant="outline" className="gap-2"><GraduationCap className="h-4 w-4" /> {L('मुफ़्त गाइड', 'Free guide')}</Button></Link>
        </div>

        {/* Governing law */}
        <HindiOnlyNotice className="mt-10" what="The state details below" />
        <Card className="mt-10 border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex gap-3">
            <Scale className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{L('शासी कानून: ', 'Governing law: ')}</span>{data.act}</p>
          </CardContent>
        </Card>

        {/* State cooperative ecosystem */}
        <h2 className="mt-10 text-xl font-bold text-foreground">{L(`${data.nameHi} की सहकारी संरचना — और हमारा सॉफ्टवेयर`, `${data.nameEn}'s cooperative structure — and our software`)}</h2>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {data.ecosystem.map((e, i) => (
            <Card key={i} className="h-full">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{e.area}</p>
                <p className="mt-1 font-semibold text-foreground">{e.body}</p>
                <p className="mt-2 text-sm text-muted-foreground flex gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />{e.fits}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Compliance */}
        <h2 className="mt-10 text-xl font-bold text-foreground">{L('अनुपालन व रिपोर्ट', 'Compliance and reports')}</h2>
        <ul className="mt-4 space-y-2">
          {data.compliance.map((c, i) => (
            <li key={i} className="text-sm text-muted-foreground flex gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />{c}</li>
          ))}
        </ul>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> {L('RCS ऑडिट प्रारूप', 'RCS audit format')}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> {L('TDS · GST सारांश', 'TDS · GST summary')}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> {L('हिंदी + English', 'Hindi + English')}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> {L('₹2,999/year + GST से', 'From ₹2,999/year + GST')}</span>
        </div>

        {/* Knowledge-graph edges: state-specific guide/blog/cookbook (GOS-11) */}
        <RelatedKnowledge links={contentForState(data.slug)} heading={L(`${data.nameHi} की समितियों के लिए और सीखें`, `Learn more for ${data.nameEn} societies`)} />

        {/* English SEO paragraph */}
        {language === 'hi' && <p className="mt-8 text-sm text-muted-foreground leading-relaxed border-t pt-6">{data.seoEn}</p>}

        {/* CTA */}
        <div className="mt-8 rounded-xl bg-primary/5 border border-primary/20 p-6 text-center">
          <p className="font-semibold text-foreground">{L(`अपनी ${data.nameHi} की सहकारी समिति का हिसाब आज ही डिजिटल करें — ₹2,999/year + GST से।`, `Take your ${data.nameEn} cooperative society's accounts digital today — from ₹2,999/year + GST.`)}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button className="gap-2">{L('रजिस्टर करें', 'Register')} <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/contact"><Button variant="outline">{L('डेमो/संपर्क', 'Demo / Contact')}</Button></Link>
          </div>
        </div>

        {/* Society types (internal links) */}
        <div className="mt-12 pt-6 border-t">
          <p className="text-sm font-semibold text-muted-foreground mb-3">{L('समिति-प्रकार के अनुसार', 'By society type')}</p>
          <div className="flex flex-wrap gap-2">
            {SOCIETY_TYPES.map((s) => (
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

export default StateLanding;
