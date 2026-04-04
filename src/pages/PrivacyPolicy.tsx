/**
 * Privacy Policy — SahakarLekha
 * Compliant with IT Act 2000, DPDP Act 2023, GDPR
 * Bilingual Hindi + English
 */
import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield, Database, Lock, Cookie, Globe, UserCheck, Clock, Mail,
} from 'lucide-react';

const SECTIONS = [
  {
    num: 1,
    icon: Database,
    title: 'डेटा संग्रहण — Data We Collect',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          हम आपकी सहकारी समिति का संचालन करने के लिए निम्नलिखित जानकारी एकत्र करते हैं: नाम, ईमेल, फ़ोन नंबर, समिति का नाम, पंजीकरण संख्या, तथा लेखा डेटा (वाउचर, सदस्य, खाते)। हम आधार, बैंक खाता संख्या, या बायोमेट्रिक डेटा एकत्र नहीं करते।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          We collect the following information to operate your cooperative society account: name, email address, phone number, society name, registration number, and accounting data (vouchers, members, accounts). We do <strong>NOT</strong> collect Aadhaar numbers, bank account numbers, or biometric data.
        </p>
      </>
    ),
  },
  {
    num: 2,
    icon: UserCheck,
    title: 'डेटा का उपयोग — How We Use Your Data',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          आपका डेटा केवल लेखा सेवाएं प्रदान करने के लिए उपयोग किया जाता है। हम आपका डेटा किसी तीसरे पक्ष को विपणन के लिए बेचते, किराए पर देते या साझा नहीं करते।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Your data is used solely for providing accounting services. We do <strong>NOT</strong> sell, rent, or share your data with third parties for marketing purposes. Data is used for:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li>Service delivery — delivering the SahakarLekha accounting platform</li>
          <li>Generating financial reports (Trial Balance, Balance Sheet, P&L, etc.)</li>
          <li>Maintaining platform security and preventing unauthorized access</li>
          <li>Improving platform performance and user experience</li>
        </ul>
      </>
    ),
  },
  {
    num: 3,
    icon: Lock,
    title: 'डेटा संग्रहण स्थान — Data Storage & Security',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          आपका सारा डेटा Supabase (PostgreSQL) पर संग्रहीत है, जो AWS मुंबई (ap-south-1) क्षेत्र में होस्ट किया गया है। सभी डेटा स्थिर अवस्था में AES-256 एन्क्रिप्शन और ट्रांज़िट में TLS 1.2+ से सुरक्षित है।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          All data is stored on Supabase (PostgreSQL) hosted on AWS Mumbai (ap-south-1) region, ensuring data residency within India. Data is encrypted at rest using AES-256 and in transit using TLS 1.2+. Row-Level Security (RLS) policies ensure complete society data isolation — no society can access another society's data.
        </p>
      </>
    ),
  },
  {
    num: 4,
    icon: Cookie,
    title: 'कुकीज़ — Cookies',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          हम केवल प्रमाणीकरण के लिए आवश्यक सत्र कुकीज़ का उपयोग करते हैं। कोई तृतीय-पक्ष ट्रैकिंग कुकीज़, विज्ञापन कुकीज़ या एनालिटिक्स ट्रैकर नहीं हैं।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          We use only essential session cookies for authentication. There are no third-party tracking cookies, no advertising cookies, and no analytics trackers. Session cookies expire on logout or after 7 days of inactivity.
        </p>
      </>
    ),
  },
  {
    num: 5,
    icon: Globe,
    title: 'तृतीय-पक्ष सेवाएं — Third-Party Services',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          हम निम्नलिखित तृतीय-पक्ष सेवाओं का उपयोग करते हैं, और तकनीकी रूप से आवश्यक से अधिक कोई डेटा इन प्रदाताओं के साथ साझा नहीं किया जाता:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li><strong>Supabase</strong> — Database and authentication</li>
          <li><strong>Vercel</strong> — Application hosting and deployment</li>
          <li><strong>Google Fonts</strong> — Typography (no user data shared)</li>
        </ul>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          No data is shared with these providers beyond what is technically necessary to deliver the service.
        </p>
      </>
    ),
  },
  {
    num: 6,
    icon: UserCheck,
    title: 'आपके अधिकार — Your Rights',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 और GDPR के अंतर्गत आपके निम्नलिखित अधिकार हैं:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li><strong>Access (पहुंच)</strong> — Download all your society's data at any time</li>
          <li><strong>Correct (सुधार)</strong> — Update any information in your account</li>
          <li><strong>Delete (हटाना)</strong> — Request complete data deletion</li>
          <li><strong>Export (निर्यात)</strong> — CSV, Excel, and PDF export of all reports and data</li>
          <li><strong>Portability (पोर्टेबिलिटी)</strong> — Switch to another system with your data</li>
        </ul>
      </>
    ),
  },
  {
    num: 7,
    icon: Clock,
    title: 'डेटा प्रतिधारण — Data Retention',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          आपका डेटा तब तक बनाए रखा जाता है जब तक आपका खाता सक्रिय है। हटाने का अनुरोध करने पर, सभी डेटा 90 कैलेंडर दिनों के भीतर हटा दिया जाएगा।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Data is retained while your account is active. Upon a deletion request, all data — including automated backups — will be permanently removed within 90 calendar days.
        </p>
      </>
    ),
  },
  {
    num: 8,
    icon: Mail,
    title: 'डेटा सुरक्षा अधिकारी — Data Protection Officer',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          गोपनीयता संबंधी किसी भी प्रश्न के लिए हमसे संपर्क करें:
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          For any privacy-related queries, contact our Data Protection Officer:
        </p>
        <p className="mt-2 font-medium text-foreground">
          Email: <a href="mailto:privacy@sahakarlekha.com" className="text-primary hover:underline">privacy@sahakarlekha.com</a>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Please include your society name and registration number in your correspondence.
        </p>
      </>
    ),
  },
];

const PrivacyPolicy: React.FC = () => {
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            गोपनीयता नीति
          </h1>
          <p className="mt-2 text-xl md:text-2xl text-muted-foreground font-medium">
            Privacy Policy
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            अंतिम अपडेट / Last Updated: 1 April 2025
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
                      {section.num}. {section.title}
                    </h2>
                    <div className="mt-4">
                      {section.content}
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
                कानूनी संदर्भ — Legal References
              </h2>
              <ul className="ml-6 list-disc text-muted-foreground space-y-2">
                <li>
                  <strong>Information Technology Act, 2000</strong> — Sections 43A (Compensation for failure to protect data) and 72A (Punishment for disclosure of information in breach of lawful contract)
                </li>
                <li>
                  <strong>Digital Personal Data Protection Act, 2023</strong> — Comprehensive framework for processing of digital personal data in India
                </li>
                <li>
                  <strong>General Data Protection Regulation (GDPR)</strong> — Applicable for users accessing the platform from the European Union
                </li>
              </ul>
              <p className="mt-6 text-sm text-muted-foreground">
                <strong>Effective Date / प्रभावी तिथि:</strong> 1 April 2025
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default PrivacyPolicy;
