/**
 * Privacy Policy — SahakarLekha
 * Binding policy text — every statement must match the live system. Factual corrections of
 * 2 Oct 2026 (owner-approved) are evidenced in docs/audits/PUBLIC-CLAIMS-AUDIT-2026-10.md.
 * Re-verify region, fields collected, analytics and subprocessors before changing anything.
 * Bilingual Hindi + English
 */
import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
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
          हम आपकी सहकारी समिति का खाता चलाने के लिए यह जानकारी रखते हैं: उपयोगकर्ता का नाम, ईमेल, फ़ोन नंबर, समिति का नाम व पंजीकरण संख्या, तथा लेखा डेटा (वाउचर, सदस्य, खाते)।
          आप जिन modules का उपयोग करते हैं, उनके अनुसार आपकी समिति ये विवरण भी दर्ज कर सकती है: सदस्यों का आधार व PAN (KYC);
          कर्मचारियों/मज़दूरों का PAN, आधार, बैंक खाता संख्या व IFSC (वेतन भुगतान हेतु); आपूर्तिकर्ताओं/ग्राहकों का PAN, GSTIN व बैंक विवरण; और समिति का बैंक खाता विवरण।
          ये विवरण आपकी समिति द्वारा दर्ज किए जाते हैं और केवल सेवा प्रदान करने के लिए उपयोग होते हैं। हम बायोमेट्रिक डेटा एकत्र नहीं करते।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          We hold the following to operate your cooperative society account: user name, email address, phone number, society name and registration number, and accounting data (vouchers, members, accounts).
          Depending on the modules you use, your society may also enter: members' Aadhaar and PAN (KYC); employees'/workers' PAN, Aadhaar, bank account number and IFSC (for wage/salary payment); suppliers'/customers' PAN, GSTIN and bank details; and the society's own bank account details.
          These details are entered by your society and used only to provide the service. We do <strong>not</strong> collect biometric data.
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
          आपका डेटा Supabase (PostgreSQL) डेटाबेस में संग्रहीत है, जो <strong>टोक्यो, जापान (ap-northeast-1)</strong> क्षेत्र में होस्ट है — यानी डेटा भारत के बाहर संग्रहीत होता है।
          स्वचालित साप्ताहिक बैकअप भी उसी प्रदाता व क्षेत्र में रखे जाते हैं। Supabase के अनुसार डेटा स्थिर अवस्था में AES-256 और ट्रांज़िट में TLS से एन्क्रिप्ट होता है।
          Row-Level Security (RLS) नीतियाँ हर समिति का डेटा अलग रखती हैं, ताकि एक समिति दूसरी समिति का डेटा न देख सके।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Your data is stored in a Supabase (PostgreSQL) database hosted in the <strong>Tokyo, Japan (ap-northeast-1)</strong> region — i.e. data is stored outside India.
          Automated weekly backups are kept with the same provider and region. Per Supabase, data is encrypted at rest with AES-256 and in transit with TLS.
          Row-Level Security (RLS) policies keep each society's data separate so that one society cannot see another society's data.
        </p>
      </>
    ),
  },
  {
    num: 4,
    icon: Cookie,
    title: 'कुकीज़ व एनालिटिक्स — Cookies & Analytics',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          लॉगिन सत्र (session) आपके browser के local storage में रखा जाता है और logout करने या समय-सीमा पूरी होने पर समाप्त होता है।
          साइट व ऐप को बेहतर बनाने के लिए हम Google Analytics (GA4) का उपयोग करते हैं, जो browser में एक छद्म-नाम (pseudonymous) पहचान-कुकी रखता है। GA4 को ये जानकारी भेजी जाती है:
          देखे गए पेज (URL व पेज-शीर्षक सहित), public साइट पर किए गए खोज-शब्द, बटन-क्लिक जैसे इवेंट, तथा device/प्रदर्शन व तकनीकी-त्रुटि की जानकारी।
          हम आपके वाउचर, खाते या रिपोर्ट जैसे लेखा-रिकॉर्ड जान-बूझकर Analytics को नहीं भेजते। हम साइट पर विज्ञापन नहीं दिखाते और आपका डेटा नहीं बेचते।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Your login session is kept in your browser's local storage and ends when you log out or it expires.
          To improve the site and app we use Google Analytics (GA4), which sets a pseudonymous identifier cookie in your browser. GA4 receives:
          pages viewed (including URL and page title), search terms typed on the public site, events such as button clicks, and device/performance and technical-error information.
          We do not intentionally send accounting records such as your vouchers, accounts or reports to Analytics. We do not show ads and never sell your data.
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
          <li><strong>Supabase</strong> — Database, authentication, file storage and backups (Tokyo, Japan region)</li>
          <li><strong>Vercel</strong> — Application hosting and deployment</li>
          <li><strong>Razorpay</strong> — Online payment of subscription fees (payment details are entered on Razorpay, not stored by us)</li>
          <li><strong>Google Fonts</strong> — Typography; your browser requests the fonts from Google, which receives your IP address and browser details</li>
          <li><strong>Google Analytics (GA4)</strong> — Usage analytics as described in section 4</li>
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
          SahakarLekha अपनी ओर से आपको ये सुविधाएँ देता है:
        </p>
        <p className="mt-1 text-muted-foreground leading-relaxed">
          SahakarLekha provides the following to you as product commitments:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li><strong>Access (पहुंच)</strong> — Download all your society's data at any time</li>
          <li><strong>Correct (सुधार)</strong> — Update any information in your account</li>
          <li><strong>Delete (हटाना)</strong> — Request deletion of your society's data (see section 7)</li>
          <li><strong>Export (निर्यात)</strong> — CSV, Excel, and PDF export of all reports and data</li>
          <li><strong>Portability (पोर्टेबिलिटी)</strong> — Switch to another system with your data</li>
        </ul>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अधिकांश प्रावधान — जिनमें Data Principal के अधिकार (धारा 11–14) शामिल हैं — अधिसूचना G.S.R. 843(E) दिनांक 13 नवंबर 2025 के अनुसार 13 मई 2027 से लागू होंगे।
        </p>
        <p className="mt-1 text-muted-foreground leading-relaxed">
          Most provisions of the Digital Personal Data Protection Act, 2023 — including Data Principal rights (sections 11–14) — come into force on 13 May 2027 under notification G.S.R. 843(E) dated 13 November 2025.
        </p>
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
          आपका डेटा तब तक रखा जाता है जब तक आपका खाता सक्रिय है। सेवा समाप्त होने पर आपको सारा डेटा निर्यात करने के लिए 30 दिन मिलते हैं (नियम व शर्तें, धारा 8)।
          हटाने का अनुरोध (privacy@sahakarlekha.com पर) मिलने पर हम आपकी समिति का डेटा live डेटाबेस से हटाते हैं, और अनुरोध की प्रक्रिया के तहत उस समिति की बैकअप-प्रतियाँ भी हटाते हैं।
          स्वचालित साप्ताहिक बैकअप सामान्यतः सीमित अवधि तक रखे जाते हैं (नवीनतम 12 प्रतियाँ और पिछले 12 महीनों की हर महीने की एक प्रति); पुरानी प्रतियाँ अपने-आप हटती हैं।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Data is retained while your account is active. On termination you have 30 days to export all your data (Terms &amp; Conditions, section 8).
          On receiving a deletion request (at privacy@sahakarlekha.com) we delete your society's data from the live database and, as part of processing that request, also delete that society's backup copies.
          Automated weekly backups are otherwise kept for a limited period (the latest 12 copies plus one copy per month for the previous 12 months); older copies are removed automatically.
        </p>
      </>
    ),
  },
  {
    num: 8,
    icon: UserCheck,
    title: 'गाइड प्रमाणपत्र — Guide Certificate',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          हमारा सीखने वाला गाइड (/guide) पढ़ने के लिए किसी पंजीकरण की आवश्यकता नहीं है। केवल जब आप
          पूर्णता <strong>प्रमाणपत्र</strong> प्राप्त करना चुनते हैं, तब आपका <strong>नाम व ईमेल</strong> (और वैकल्पिक रूप से
          समिति का नाम) केवल प्रमाणपत्र जारी करने व उसके सत्यापन के लिए सुरक्षित रखा जाता है। यह आपकी सहमति से ही होता है।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Reading the learning guide requires no registration. Only when you choose to claim the completion
          <strong> certificate</strong> do we store your <strong>name and email</strong> (and optionally your society name),
          solely to issue and verify the certificate, and only with your consent. Your email is never shown on the public
          verification page and is never sold.
        </p>
      </>
    ),
  },
  {
    num: 9,
    icon: Mail,
    title: 'गोपनीयता संपर्क व शिकायत — Privacy Contact & Grievances',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          गोपनीयता संबंधी किसी भी प्रश्न, डेटा हटाने के अनुरोध या शिकायत के लिए हमसे संपर्क करें:
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          For any privacy-related query, data-deletion request or grievance, contact us:
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
  useDocumentMeta({
    title: 'गोपनीयता नीति — SahakarLekha | Privacy Policy',
    description: 'SahakarLekha आपकी समिति का कौन-सा डेटा रखता है और उसे कैसे सुरक्षित रखता है — society-level isolation व एन्क्रिप्शन. What data SahakarLekha holds and how it protects your cooperative society data.',
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
            गोपनीयता नीति
          </h1>
          <p className="mt-2 text-xl md:text-2xl text-muted-foreground font-medium">
            Privacy Policy
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            अंतिम अपडेट / Last Updated: 2 अक्टूबर 2026 / 2 October 2026
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
                  <strong>Digital Personal Data Protection Act, 2023</strong> — Framework for processing of digital personal data in India; commencement is phased under G.S.R. 843(E) (13 Nov 2025), with most obligations and rights in force from 13 May 2027
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
