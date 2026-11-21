/**
 * Privacy Policy — SahakarLekha
 * Binding policy text — every statement must match the live system. Factual corrections of
 * 2 Oct 2026 (owner-approved) are evidenced in docs/audits/PUBLIC-CLAIMS-AUDIT-2026-10.md.
 * 30 Oct 2026: Resend added as a subprocessor — it already sent the newsletter welcome (api/subscribe.ts)
 * and now sends the notification outbox + invoice emails (migrations 134/142–144, live 30 Oct).
 * 3 Nov 2026: Zoho Mail added as a subprocessor — support inbox live 2 Nov (Zoho .com data center, not India).
 * Re-verify region, fields collected, analytics and subprocessors before changing anything.
 * Bilingual Hindi + English — the page shows ONE language, following the app's Hindi / English
 * setting (Hindi default, which is what the prerender writes). Every section has a `hi` and an `en`
 * body saying the same thing; change both together.
 */
import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { PAGE_META_EN } from '@/content/pageMetaEn';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { SECTIONS } from '@/content/legal/privacySections';
import { Shield } from 'lucide-react';


const PrivacyPolicy: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L('गोपनीयता नीति — SahakarLekha | Privacy Policy', PAGE_META_EN.privacy.title),
    description: L(
      'SahakarLekha आपकी समिति का कौन-सा डेटा रखता है और उसे कैसे सुरक्षित रखता है — society-level isolation व एन्क्रिप्शन. What data SahakarLekha holds and how it protects your cooperative society data.',
      PAGE_META_EN.privacy.description,
    ),
    canonicalPath: '/privacy',
  });
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            {L('गोपनीयता नीति', 'Privacy Policy')}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {L('अंतिम अपडेट: 14 नवंबर 2026', 'Last Updated: 14 November 2026')}
          </p>
        </div>
      </section>

      {/* Policy Sections */}
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

      {/* Legal References */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {L('कानूनी संदर्भ', 'Legal References')}
              </h2>
              {language === 'hi' ? (
                <ul className="ml-6 list-disc text-muted-foreground space-y-2">
                  <li>
                    <strong>Information Technology Act, 2000 (सूचना प्रौद्योगिकी अधिनियम, 2000)</strong> — धारा 43A (डेटा की सुरक्षा में विफलता के लिए क्षतिपूर्ति) और 72A (वैध अनुबंध का उल्लंघन करके जानकारी प्रकट करने पर दंड)
                  </li>
                  <li>
                    <strong>Digital Personal Data Protection Act, 2023 (डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023)</strong> — भारत में डिजिटल व्यक्तिगत डेटा के प्रसंस्करण का ढांचा; इसका प्रारंभ G.S.R. 843(E) (13 नवंबर 2025) के तहत चरणों में है, और अधिकांश दायित्व व अधिकार 13 मई 2027 से लागू होंगे
                  </li>
                  <li>
                    <strong>General Data Protection Regulation (GDPR)</strong> — यूरोपीय संघ से प्लेटफ़ॉर्म का उपयोग करने वाले उपयोगकर्ताओं पर लागू
                  </li>
                </ul>
              ) : (
                <ul className="ml-6 list-disc text-muted-foreground space-y-2">
                  <li>
                    <strong>Information Technology Act, 2000</strong> — Sections 43A (Compensation for failure to protect data) and 72A (Punishment for disclosure of information in breach of lawful contract)
                  </li>
                  <li>
                    <strong>Digital Personal Data Protection Act, 2023</strong> — Framework for processing of digital personal data in India; commencement is phased under G.S.R. 843(E) (13 Nov 2025), with most obligations and rights in force from 13 May 2027
                  </li>
                  <li>
                    <strong>General Data Protection Regulation (GDPR)</strong> — Applicable for users accessing the platform from the European Union
                  </li>
                </ul>
              )}
              <p className="mt-6 text-sm text-muted-foreground">
                <strong>{L('प्रभावी तिथि:', 'Effective Date:')}</strong> {L('1 अप्रैल 2025', '1 April 2025')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default PrivacyPolicy;
