/**
 * SahakarLekha FAQ Page — Bilingual Hindi+English
 * Public page, no auth required
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HelpCircle, ArrowRight } from 'lucide-react';
import { FAQ_CATEGORIES } from '@/content/faq';

/* FAQ data + types now live in src/content/faq.ts (shared with site search). */

/* ────────────────────────── Component ────────────────────────── */

const FAQ: React.FC = () => {
  useDocumentMeta({
    title: 'अक्सर पूछे जाने वाले प्रश्न (FAQ) — SahakarLekha',
    description: 'क्या यह वाकई मुफ़्त है? ऑडिटर रिपोर्ट स्वीकार करेंगे? डेटा सुरक्षित है? Tally से कैसे आएँ? — SahakarLekha के सभी सामान्य प्रश्नों के उत्तर हिंदी व English में.',
    canonicalPath: '/faq',
    // FAQPage structured data (all Q&As) → eligible for Google's FAQ rich result.
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_CATEGORIES.flatMap((c) => c.items).map((it) => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: `${it.aHi} / ${it.aEn}` },
      })),
    },
  });
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <HelpCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            सामान्य प्रश्न — Frequently Asked Questions
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            SahakarLekha के बारे में अक्सर पूछे जाने वाले प्रश्न /
            Common questions about SahakarLekha
          </p>
        </div>
      </section>

      {/* FAQ Tabs + Accordion */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="getting-started" className="w-full">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="mb-8 flex w-max sm:w-full sm:flex-wrap gap-1">
                {FAQ_CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.value} value={cat.value} className="text-xs sm:text-sm whitespace-nowrap">
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {FAQ_CATEGORIES.map((cat) => (
              <TabsContent key={cat.value} value={cat.value}>
                <Card>
                  <CardContent className="pt-6">
                    <Accordion type="single" collapsible className="w-full">
                      {cat.items.map((item, idx) => (
                        <AccordionItem key={idx} value={`${cat.value}-${idx}`}>
                          <AccordionTrigger className="text-left text-base font-semibold">
                            {item.q}
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 text-sm leading-relaxed">
                              <p className="text-foreground">{item.aHi}</p>
                              <p className="text-muted-foreground">{item.aEn}</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            अभी भी प्रश्न हैं? / Still have questions?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            हमसे संपर्क करें — हम आपकी मदद के लिए तैयार हैं।
            <br />
            Get in touch — we are here to help.
          </p>
          <Link to="/contact">
            <Button size="lg" variant="secondary" className="gap-2">
              संपर्क करें / Contact Us <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
};

export default FAQ;
