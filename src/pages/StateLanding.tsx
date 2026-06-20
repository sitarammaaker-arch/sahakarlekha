/**
 * StateLanding — state-wise SEO/marketing landing pages at
 * /cooperative-software/:state. Cooperatives are state-regulated, so each page
 * carries genuinely state-specific facts (Act, Registrar, apex bodies). Hindi-first,
 * bilingual meta + structured data. Uses PublicLayout. Data: src/content/states.ts.
 */
import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { findState } from '@/content/states';
import { SOCIETY_TYPES } from '@/content/societyTypes';
import { ArrowRight, CheckCircle2, GraduationCap, ShieldCheck, Home, Scale } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const StateLanding: React.FC = () => {
  const { state } = useParams();
  const data = state ? findState(state) : null;

  // Unknown / missing state → send to the software hub.
  if (!data) return <Navigate to="/software" replace />;

  const path = `/cooperative-software/${data.slug}`;
  useDocumentMeta({
    title: data.metaTitle,
    description: data.metaDescription,
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
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Software', item: `${SITE}/software` },
          { '@type': 'ListItem', position: 2, name: `${data.nameEn} Cooperative Software`, item: `${SITE}${path}` },
        ],
      },
    },
  });

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

        {/* Governing law */}
        <Card className="mt-10 border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex gap-3">
            <Scale className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">शासी कानून: </span>{data.act}</p>
          </CardContent>
        </Card>

        {/* State cooperative ecosystem */}
        <h2 className="mt-10 text-xl font-bold text-foreground">{data.nameHi} की सहकारी संरचना — और हमारा सॉफ्टवेयर</h2>
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
        <h2 className="mt-10 text-xl font-bold text-foreground">अनुपालन व रिपोर्ट</h2>
        <ul className="mt-4 space-y-2">
          {data.compliance.map((c, i) => (
            <li key={i} className="text-sm text-muted-foreground flex gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />{c}</li>
          ))}
        </ul>

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
          <p className="font-semibold text-foreground">अपनी {data.nameHi} की सहकारी समिति का हिसाब आज ही डिजिटल करें — बिल्कुल मुफ़्त।</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button className="gap-2">मुफ़्त रजिस्टर करें <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/contact"><Button variant="outline">डेमो/संपर्क</Button></Link>
          </div>
        </div>

        {/* Society types (internal links) */}
        <div className="mt-12 pt-6 border-t">
          <p className="text-sm font-semibold text-muted-foreground mb-3">समिति-प्रकार के अनुसार</p>
          <div className="flex flex-wrap gap-2">
            {SOCIETY_TYPES.map((s) => (
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

export default StateLanding;
