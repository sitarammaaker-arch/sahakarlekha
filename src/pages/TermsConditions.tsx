/**
 * Terms & Conditions — SahakarLekha
 * SaaS usage terms for cooperative society accounting platform
 * Binding text — do NOT edit without owner/legal review. §10 requires 30 days' email notice
 * before changes. 2 Oct 2026: only the false "(currently ₹0 for free tier)" phrase was removed
 * from §7 (cap rule unchanged) and the existing English cap sentence was mirrored in Hindi.
 * Cap amount/period remain for counsel: docs/audits/PUBLIC-CLAIMS-AUDIT-2026-10.md §B-1.
 * Bilingual Hindi + English — the page shows ONE language, following the app's Hindi / English
 * setting (Hindi default, which is what the prerender writes). Every section has a `hi` and an `en`
 * body saying the same thing; change both together. 15 Nov 2026: the clauses that were in English
 * only (and the §3 list) were given a faithful Hindi rendering so the Hindi page carries every term.
 */
import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { PAGE_META_EN } from '@/content/pageMetaEn';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { SECTIONS } from '@/content/legal/termsSections';
import { FileText } from 'lucide-react';


const TermsConditions: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L('नियम व शर्तें — SahakarLekha | Terms & Conditions', PAGE_META_EN.terms.title),
    description: L(
      'SahakarLekha सहकारी लेखा प्लेटफ़ॉर्म के उपयोग की नियम व शर्तें. Terms and conditions for using the SahakarLekha cooperative accounting platform.',
      PAGE_META_EN.terms.description,
    ),
    canonicalPath: '/terms',
  });
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            {L('नियम एवं शर्तें', 'Terms & Conditions')}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {L('प्रभावी तिथि: 1 अप्रैल 2025', 'Effective Date: 1 April 2025')}
          </p>
        </div>
      </section>

      {/* Terms Sections */}
      {SECTIONS.map((section, idx) => (
        <section
          key={section.num}
          className={idx % 2 === 0 ? 'py-16 bg-white' : 'py-16 bg-muted/30'}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">
                      {section.num}. {L(section.title.hi, section.title.en)}
                    </h2>
                    <div className="mt-4">
                      {language === 'hi' ? section.hi : section.en}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      ))}

      {/* Contact Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {L('संपर्क', 'Contact')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {L(
                  'इन नियमों और शर्तों से संबंधित किसी भी प्रश्न के लिए, कृपया हमसे संपर्क करें:',
                  'For any queries regarding these Terms and Conditions, please contact us:',
                )}
              </p>
              <p className="mt-2 font-medium text-foreground">
                {L('ईमेल:', 'Email:')} <a href="mailto:legal@sahakarlekha.com" className="text-primary hover:underline">legal@sahakarlekha.com</a>
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                <strong>{L('प्रभावी तिथि:', 'Effective Date:')}</strong> {L('1 अप्रैल 2025', '1 April 2025')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default TermsConditions;
