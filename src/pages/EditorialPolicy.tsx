/**
 * /editorial-policy — संपादकीय व सुधार नीति. The words live in src/content/editorialPolicy.ts,
 * which scripts/prerender-guide.mjs renders too (static HTML == this page).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { EDITORIAL_POLICY, EDITORIAL_POLICY_PATH } from '@/content/editorialPolicy';
import { ChevronRight, Home } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const EditorialPolicy: React.FC = () => {
  useDocumentMeta({
    title: EDITORIAL_POLICY.title,
    description: EDITORIAL_POLICY.description,
    canonicalPath: EDITORIAL_POLICY_PATH,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'होम', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'ब्लॉग', item: `${SITE}/blog` },
        { '@type': 'ListItem', position: 3, name: EDITORIAL_POLICY.h1, item: `${SITE}${EDITORIAL_POLICY_PATH}` },
      ],
    },
  });

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <nav aria-label="ब्रेडक्रम्ब" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-5">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" aria-hidden="true" /> होम</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to="/blog" className="hover:text-primary">ब्लॉग</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground/70" aria-current="page">{EDITORIAL_POLICY.h1}</span>
        </nav>

        <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">{EDITORIAL_POLICY.h1}</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">{EDITORIAL_POLICY.intro}</p>

        {EDITORIAL_POLICY.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-xl font-bold text-foreground mb-2">{s.heading}</h2>
            {s.paras.map((p) => <p key={p} className="text-foreground/90 leading-relaxed mb-3">{p}</p>)}
          </section>
        ))}

        <p className="mt-10 text-sm">
          <Link to="/contact" className="text-primary font-medium hover:underline">ग़लती बताएँ: संपर्क पन्ना</Link>
          <span className="text-muted-foreground"> · </span>
          <Link to="/author/sitaram" className="text-primary hover:underline">लेखक की प्रोफ़ाइल</Link>
          <span className="text-muted-foreground"> · </span>
          <Link to="/blog" className="text-primary hover:underline">सभी लेख</Link>
        </p>
      </div>
    </PublicLayout>
  );
};

export default EditorialPolicy;
