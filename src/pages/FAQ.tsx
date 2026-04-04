/**
 * SahakarLekha FAQ Page — Bilingual Hindi+English
 * Public page, no auth required
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
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

/* ────────────────────────── FAQ Data ────────────────────────── */

interface FAQItem {
  q: string;
  aHi: string;
  aEn: string;
}

interface FAQCategory {
  value: string;
  label: string;
  items: FAQItem[];
}

const FAQ_CATEGORIES: FAQCategory[] = [
  {
    value: 'getting-started',
    label: 'शुरुआत / Getting Started',
    items: [
      {
        q: 'SahakarLekha क्या है? / What is SahakarLekha?',
        aHi: 'SahakarLekha भारत की सहकारी समितियों के लिए विशेष रूप से बनाया गया मुफ्त क्लाउड-आधारित लेखा सॉफ्टवेयर है। यह 8 प्रकार की समितियों, 36 राज्यों, TDS/GST अनुपालन और द्विभाषी (हिंदी+अंग्रेजी) इंटरफेस का समर्थन करता है।',
        aEn: 'SahakarLekha is a free cloud-based accounting software built specifically for Indian cooperative societies. It supports 8 society types, 36 states, TDS/GST compliance, and a bilingual (Hindi+English) interface.',
      },
      {
        q: 'कैसे रजिस्टर करें? / How to register?',
        aHi: 'Register पेज पर जाएं, अपनी ईमेल और समिति का नाम दर्ज करें। 2 मिनट में रजिस्ट्रेशन पूरा हो जाता है। कोई क्रेडिट कार्ड नहीं चाहिए।',
        aEn: 'Visit the Register page, enter your email and society name. Registration completes in 2 minutes. No credit card needed.',
      },
      {
        q: 'क्या यह सच में मुफ्त है? / Is it really free?',
        aHi: 'हां, 100% मुफ्त। कोई छिपा शुल्क नहीं, कोई ट्रायल अवधि नहीं। सभी फीचर्स — वाउचर, रिपोर्ट, TDS, GST, ऑडिट — सब मुफ्त में उपलब्ध हैं।',
        aEn: 'Yes, 100% free. No hidden charges, no trial period. All features — vouchers, reports, TDS, GST, audit — are available for free.',
      },
      {
        q: 'कौन-कौन सी समितियों के लिए है? / Which society types are supported?',
        aHi: '8 प्रकार: विपणन एवं प्रसंस्करण (CMS), PACS, उपभोक्ता, दुग्ध, आवास, चीनी, श्रमिक, और अन्य। प्रत्येक प्रकार के लिए अलग COA टेम्पलेट उपलब्ध है।',
        aEn: '8 types: Marketing & Processing (CMS), PACS, Consumer, Dairy, Housing, Sugar, Labour, and Other. Each type has its own Chart of Accounts template.',
      },
      {
        q: 'क्या इंटरनेट जरूरी है? / Is internet required?',
        aHi: 'हां, यह क्लाउड-आधारित सॉफ्टवेयर है। इंटरनेट कनेक्शन आवश्यक है। लेकिन कम बैंडविड्थ पर भी अच्छा काम करता है।',
        aEn: 'Yes, it\'s cloud-based software. Internet connection is required. However, it works well even on low bandwidth connections.',
      },
    ],
  },
  {
    value: 'accounting',
    label: 'लेखा / Accounting',
    items: [
      {
        q: 'दोहरी प्रविष्टि कैसे काम करती है? / How does double-entry work?',
        aHi: 'हर लेन-देन में डेबिट और क्रेडिट दोनों दर्ज होते हैं। सिस्टम स्वचालित रूप से सुनिश्चित करता है कि Dr = Cr। Cash Book, Bank Book, Day Book सब स्वतः अपडेट होते हैं।',
        aEn: 'Every transaction records both debit and credit. The system automatically ensures Dr = Cr. Cash Book, Bank Book, Day Book all update automatically.',
      },
      {
        q: 'PDF रिपोर्ट कैसे बनाएं? / How to generate PDF reports?',
        aHi: 'किसी भी रिपोर्ट पेज पर जाएं (Trial Balance, Balance Sheet, P&L आदि) और \'PDF\' बटन दबाएं। रिपोर्ट समिति के नाम, पंजीकरण संख्या, और हस्ताक्षर ब्लॉक के साथ डाउनलोड हो जाती है।',
        aEn: 'Go to any report page (Trial Balance, Balance Sheet, P&L etc.) and click the \'PDF\' button. The report downloads with society name, registration number, and signature block.',
      },
      {
        q: 'Opening Balance कैसे डालें? / How to enter opening balances?',
        aHi: 'Settings → Opening Balances पर जाएं। प्रत्येक खाते के लिए प्रारंभिक शेष (Dr/Cr) दर्ज करें। सुनिश्चित करें कि कुल Dr = कुल Cr।',
        aEn: 'Go to Settings → Opening Balances. Enter the opening balance (Dr/Cr) for each account. Ensure total Dr = total Cr.',
      },
      {
        q: 'Tally से डेटा कैसे लाएं? / How to import from Tally?',
        aHi: 'Universal Importer टूल का उपयोग करें। Tally से CSV एक्सपोर्ट करें, फिर SahakarLekha में इम्पोर्ट करें। वाउचर, सदस्य, और खाता शीर्ष सभी इम्पोर्ट किए जा सकते हैं।',
        aEn: 'Use the Universal Importer tool. Export CSV from Tally, then import into SahakarLekha. Vouchers, members, and account heads can all be imported.',
      },
    ],
  },
  {
    value: 'compliance',
    label: 'अनुपालन / Compliance',
    items: [
      {
        q: 'TDS 26Q कैसे बनाएं? / How to generate Form 26Q?',
        aHi: 'TDS Register पेज पर जाएं → तिमाही चुनें → \'26Q Export\' बटन दबाएं। TRACES-संगत पाइप-डिलिमिटेड फाइल डाउनलोड हो जाती है जो सीधे TRACES पर अपलोड की जा सकती है।',
        aEn: 'Go to TDS Register page → select quarter → click \'26Q Export\'. A TRACES-compatible pipe-delimited file downloads that can be directly uploaded to TRACES portal.',
      },
      {
        q: 'GST रिटर्न में कैसे मदद मिलती है? / How does GST help work?',
        aHi: 'GST Summary पेज GSTR-1 (बिक्री) और GSTR-3B (कर सारांश) दोनों दिखाता है। HSN-वार, दर-वार विभाजन। e-Way Bill प्रबंधन भी उपलब्ध है।',
        aEn: 'The GST Summary page shows both GSTR-1 (sales) and GSTR-3B (tax summary). HSN-wise, rate-wise breakup. e-Way Bill management is also available.',
      },
      {
        q: 'Audit Certificate कैसे निकालें? / How to get Audit Certificate?',
        aHi: 'Registers → Audit Certificate पर जाएं। वित्तीय आंकड़े स्वतः भरे जाते हैं। ऑडिटर का विवरण भरें और PDF डाउनलोड करें। State-wise Audit Schedules (I-X) भी उपलब्ध हैं।',
        aEn: 'Go to Registers → Audit Certificate. Financial figures auto-fill. Enter auditor details and download PDF. State-wise Audit Schedules (I-X) are also available.',
      },
    ],
  },
  {
    value: 'technical',
    label: 'तकनीकी / Technical',
    items: [
      {
        q: 'डेटा कहाँ स्टोर होता है? / Where is data stored?',
        aHi: 'सभी डेटा Supabase (PostgreSQL) पर स्टोर होता है, जो AWS Mumbai (ap-south-1) क्षेत्र में होस्ट है। AES-256 एन्क्रिप्शन और Row-Level Security (RLS) के साथ।',
        aEn: 'All data is stored on Supabase (PostgreSQL), hosted in AWS Mumbai (ap-south-1) region. With AES-256 encryption and Row-Level Security (RLS).',
      },
      {
        q: 'मोबाइल पर चलता है? / Does it work on mobile?',
        aHi: 'हां, SahakarLekha पूरी तरह से responsive है। मोबाइल ब्राउज़र (Chrome, Safari) पर अच्छा काम करता है। कोई अलग ऐप डाउनलोड करने की जरूरत नहीं।',
        aEn: 'Yes, SahakarLekha is fully responsive. Works well on mobile browsers (Chrome, Safari). No separate app download needed.',
      },
      {
        q: 'बैकअप कैसे लें? / How to take backup?',
        aHi: 'Settings → Backup & Restore पर जाएं। \'Download Backup\' बटन दबाएं — सभी डेटा JSON फाइल में डाउनलोड हो जाता है। इसे बाद में Restore भी किया जा सकता है।',
        aEn: 'Go to Settings → Backup & Restore. Click \'Download Backup\' — all data downloads as a JSON file. It can be restored later as well.',
      },
    ],
  },
  {
    value: 'pricing',
    label: 'मूल्य / Pricing',
    items: [
      {
        q: 'क्या कोई छिपा शुल्क है? / Any hidden charges?',
        aHi: 'बिल्कुल नहीं। SahakarLekha पूरी तरह से मुफ्त है। कोई छिपा शुल्क नहीं, कोई विज्ञापन नहीं, कोई डेटा बिक्री नहीं।',
        aEn: 'Absolutely not. SahakarLekha is completely free. No hidden charges, no ads, no data selling.',
      },
      {
        q: 'Pro Plan कब आएगा? / When will Pro plan launch?',
        aHi: 'Pro Plan पर काम चल रहा है। इसमें multi-society consolidation, priority support, और advanced analytics शामिल होंगे। जल्द ही उपलब्ध होगा।',
        aEn: 'Pro Plan is under development. It will include multi-society consolidation, priority support, and advanced analytics. Coming soon.',
      },
    ],
  },
];

/* ────────────────────────── Component ────────────────────────── */

const FAQ: React.FC = () => {
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
