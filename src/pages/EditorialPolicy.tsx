/**
 * /editorial-policy — संपादकीय व सुधार नीति. The words live in src/content/editorialPolicy.ts,
 * which scripts/prerender-guide.mjs renders too (static HTML == this page).
 */
import React from 'react';
import { Link } from '@/components/LocalLink';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { EDITORIAL_POLICY, EDITORIAL_POLICY_EN, EDITORIAL_POLICY_PATH } from '@/content/editorialPolicy';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronRight, Home } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const EditorialPolicy: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  // the policy text in the chosen language (Hindi = the shared module, unchanged)
  const policy = language === 'hi' ? EDITORIAL_POLICY : EDITORIAL_POLICY_EN;
  useDocumentMeta({
    title: policy.title,
    description: policy.description,
    canonicalPath: EDITORIAL_POLICY_PATH,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        // English twin (/en/editorial-policy): English names, /en/… items — same as its prerendered copy
        { '@type': 'ListItem', position: 1, name: L('होम', 'Home'), item: `${SITE}${L('/', '/en')}` },
        { '@type': 'ListItem', position: 2, name: L('ब्लॉग', 'Blog'), item: `${SITE}${L('/blog', '/en/blog')}` },
        { '@type': 'ListItem', position: 3, name: policy.h1, item: `${SITE}${L(EDITORIAL_POLICY_PATH, '/en' + EDITORIAL_POLICY_PATH)}` },
      ],
    },
  });

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <nav aria-label={L('ब्रेडक्रम्ब', 'Breadcrumb')} className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-5">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" aria-hidden="true" /> {L('होम', 'Home')}</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to="/blog" className="hover:text-primary">{L('ब्लॉग', 'Blog')}</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground/70" aria-current="page">{policy.h1}</span>
        </nav>

        <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">{policy.h1}</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">{policy.intro}</p>

        {policy.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-xl font-bold text-foreground mb-2">{s.heading}</h2>
            {s.paras.map((p) => <p key={p} className="text-foreground/90 leading-relaxed mb-3">{p}</p>)}
          </section>
        ))}

        <p className="mt-10 text-sm">
          <Link to="/contact" className="text-primary font-medium hover:underline">{L('ग़लती बताएँ: संपर्क पन्ना', 'Report a mistake: contact page')}</Link>
          <span className="text-muted-foreground"> · </span>
          <Link to="/author/sitaram" className="text-primary hover:underline">{L('लेखक की प्रोफ़ाइल', 'Author profile')}</Link>
          <span className="text-muted-foreground"> · </span>
          <Link to="/blog" className="text-primary hover:underline">{L('सभी लेख', 'All articles')}</Link>
        </p>
      </div>
    </PublicLayout>
  );
};

export default EditorialPolicy;
