/**
 * /editorial-policy — संपादकीय व सुधार नीति. The words live in src/content/editorialPolicy.ts,
 * which scripts/prerender-guide.mjs renders too (static HTML == this page).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { EDITORIAL_POLICY, EDITORIAL_POLICY_PATH } from '@/content/editorialPolicy';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronRight, Home } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

/**
 * English reading of EDITORIAL_POLICY (same structure, same meaning), shown only when the site is switched
 * to English. The Hindi text in src/content/editorialPolicy.ts stays the source of truth and is what the
 * prerendered page carries — if a Hindi sentence changes, change its English twin here too.
 */
const EDITORIAL_POLICY_EN = {
  title: 'Editorial & corrections policy | SahakarLekha Blog',
  h1: 'Editorial & corrections policy',
  description:
    'Who writes the SahakarLekha blog articles, how legal and tax information is checked, what the "Last reviewed" date means, and how to tell us if you spot a mistake in an article.',
  intro:
    'The SahakarLekha blog is written for secretaries, accountants, treasurers and office-bearers of cooperative societies. This page explains how we write and check articles, and what we do when a mistake is found.',
  sections: [
    {
      heading: 'Who writes the articles',
      paras: [
        'Articles are written by the SahakarLekha team. Every article carries the author\'s name and a link to their profile, which lists their qualifications and experience.',
      ],
    },
    {
      heading: 'Where the information comes from',
      paras: [
        'For laws, rules, rates and schemes we try to go to the original source, such as the Cooperative Societies Act and Rules, the government gazette, department circulars and orders, PIB press releases, and court judgments.',
        'If we cannot find the original source for a claim, we either remove it or say clearly that it is based on a news report or some other source.',
      ],
    },
    {
      heading: 'What the "Last reviewed" date means',
      paras: [
        'An article on law, tax or a government scheme shows a "Last reviewed" date only when, on that day, its figures, sections and claims were checked by opening the original sources.',
        'An article without this date has not yet had such a full check. Treat it as general information. The "Updated" date is a different thing: it tells you when the article was last changed.',
      ],
    },
    {
      heading: 'State rules differ',
      paras: [
        'Cooperative societies are governed by state law, and every state\'s rules are different. Many of our articles are about Haryana\'s rules and schemes. Such articles are marked "📍 Haryana". A society in another state should check its own state\'s Act, its bye-laws and the instructions of its Registrar\'s office.',
      ],
    },
    {
      heading: 'This is information, not advice',
      paras: [
        'Blog articles are meant to explain. They are not legal, tax or financial advice. Rules, rates and schemes keep changing. Before taking any decision, always confirm with the original government order, your bye-laws, your auditor/CA or the Registrar\'s office.',
      ],
    },
    {
      heading: 'Spotted a mistake? Tell us',
      paras: [
        'If you see a wrong figure, an outdated rule or a broken link in an article, tell us on WhatsApp or by email (both are on the contact page). Send the article\'s link and the mistake, and if you can, a source for the correct information.',
        'We check the point against the original source. If the mistake is confirmed, we correct the article and change its "Updated" date. If a figure or rule has been changed, we also add a note about it in the article.',
      ],
    },
  ],
} as const;

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
        { '@type': 'ListItem', position: 1, name: 'होम', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'ब्लॉग', item: `${SITE}/blog` },
        { '@type': 'ListItem', position: 3, name: EDITORIAL_POLICY.h1, item: `${SITE}${EDITORIAL_POLICY_PATH}` },
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
