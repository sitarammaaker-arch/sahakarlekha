/**
 * Terms & Conditions — SahakarLekha
 * SaaS usage terms for cooperative society accounting platform
 * Bilingual Hindi + English
 */
import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText, CheckSquare, UserPlus, ShieldCheck, Database,
  Award, Server, AlertTriangle, XCircle, Scale, PenLine,
} from 'lucide-react';

const SECTIONS = [
  {
    num: 1,
    icon: CheckSquare,
    title: 'स्वीकृति — Acceptance',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          SahakarLekha पर पंजीकरण या उपयोग करके, आप इन नियमों और शर्तों से सहमत होते हैं। आपकी आयु 18 वर्ष या उससे अधिक होनी चाहिए और आप किसी भी भारतीय सहकारी समिति अधिनियम के तहत पंजीकृत सहकारी समिति के अधिकृत प्रतिनिधि होने चाहिए।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          By registering for or using SahakarLekha, you agree to these Terms and Conditions. You must be 18 years of age or older and an authorized representative of a cooperative society registered under any Indian Cooperative Societies Act (State or Multi-State).
        </p>
      </>
    ),
  },
  {
    num: 2,
    icon: UserPlus,
    title: 'खाता पंजीकरण — Account Registration',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          प्रति समिति एक खाता। आप अपनी लॉगिन साख की सुरक्षा बनाए रखने के लिए जिम्मेदार हैं। सही समिति पंजीकरण विवरण प्रदान करें। अनधिकृत पहुंच की स्थिति में तुरंत हमें सूचित करें।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          One account per cooperative society. You are responsible for maintaining the security of your login credentials. Provide accurate society registration details (name, registration number, state, type). Notify us immediately of any unauthorized access to your account.
        </p>
      </>
    ),
  },
  {
    num: 3,
    icon: ShieldCheck,
    title: 'अनुमत उपयोग — Permitted Use',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          इस सॉफ्टवेयर का उपयोग केवल वैध सहकारी समिति लेखांकन के लिए करें। निम्नलिखित प्रतिबंधित है:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li>No resale, sublicense, or redistribution of the platform</li>
          <li>No reverse engineering, decompilation, or disassembly</li>
          <li>No use for money laundering, fraud, or any illegal activities</li>
          <li>No automated scraping, bots, or data harvesting</li>
          <li>No attempt to breach security or access other societies' data</li>
        </ul>
      </>
    ),
  },
  {
    num: 4,
    icon: Database,
    title: 'डेटा स्वामित्व — Data Ownership',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          आपकी समिति का सारा लेखा डेटा आपकी समिति का स्वामित्व है। हम आपके वाउचर, सदस्य रिकॉर्ड, वित्तीय रिपोर्ट, या किसी भी समिति डेटा पर कोई स्वामित्व का दावा नहीं करते।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Your society owns all accounting data you enter into SahakarLekha. We claim no ownership over your vouchers, member records, financial reports, or any society data. You can export all your data at any time in CSV, Excel, or PDF format.
        </p>
      </>
    ),
  },
  {
    num: 5,
    icon: Award,
    title: 'बौद्धिक संपदा — Intellectual Property',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          SahakarLekha सॉफ्टवेयर, लोगो, डिज़ाइन और कोड हमारी बौद्धिक संपदा हैं। "SahakarLekha" और "सहकारलेखा" हमारे ट्रेडमार्क हैं।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          The SahakarLekha software, logo, design, and source code are our intellectual property. "SahakarLekha" and "सहकारलेखा" are our trademarks. You may not copy, modify, distribute, or create derivative works from the software without prior written consent.
        </p>
      </>
    ),
  },
  {
    num: 6,
    icon: Server,
    title: 'सेवा उपलब्धता — Service Availability',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          हम 99.9% अपटाइम का प्रयास करते हैं, लेकिन निर्बाध सेवा की गारंटी नहीं देते। रखरखाव के लिए पूर्व सूचना दी जाएगी।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be communicated with advance notice via email. Force majeure events (natural disasters, government actions, internet outages) are excused from uptime commitments.
        </p>
      </>
    ),
  },
  {
    num: 7,
    icon: AlertTriangle,
    title: 'दायित्व सीमा — Limitation of Liability',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          सॉफ्टवेयर "जैसा है" के आधार पर प्रदान किया गया है। हम लेखा त्रुटियों, कर फाइलिंग गलतियों, या ऑडिट विफलताओं के लिए उत्तरदायी नहीं हैं। हम CA/ऑडिटर नहीं हैं — सभी गणनाओं को अपने ऑडिटर से सत्यापित करें।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          The software is provided "as is" without warranties of any kind. We are not liable for accounting errors, tax filing mistakes, or audit failures resulting from use of the platform. Maximum liability is limited to the amount paid for the service (currently ₹0 for free tier). <strong>We are not a Chartered Accountant or auditor</strong> — always verify all calculations with your society's qualified auditor.
        </p>
      </>
    ),
  },
  {
    num: 8,
    icon: XCircle,
    title: 'समाप्ति — Termination',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          कोई भी पक्ष किसी भी समय सेवा समाप्त कर सकता है। समाप्ति पर, आपके पास सभी डेटा निर्यात करने के लिए 30 दिन का समय होगा। 30 दिनों के बाद, डेटा स्थायी रूप से हटाया जा सकता है।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Either party may terminate this agreement at any time. Upon termination, you will have a 30-day window to export all your society data. After 30 days, data may be permanently deleted. We reserve the right to suspend accounts that violate these terms without prior notice.
        </p>
      </>
    ),
  },
  {
    num: 9,
    icon: Scale,
    title: 'शासी कानून — Governing Law',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          ये नियम भारत के कानूनों द्वारा शासित हैं। विवाद नई दिल्ली के न्यायालयों के अधीन होंगे। पहले सौहार्दपूर्ण समाधान का प्रयास किया जाएगा, फिर मध्यस्थता एवं सुलह अधिनियम, 1996 के तहत मध्यस्थता।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts at New Delhi. Parties shall first attempt amicable resolution, failing which disputes shall be resolved through arbitration under the Arbitration and Conciliation Act, 1996.
        </p>
      </>
    ),
  },
  {
    num: 10,
    icon: PenLine,
    title: 'संशोधन — Amendments',
    content: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          हम ईमेल के माध्यम से 30 दिन पूर्व सूचना के साथ इन नियमों को अपडेट कर सकते हैं। सूचना अवधि के बाद निरंतर उपयोग स्वीकृति मानी जाएगी। महत्वपूर्ण परिवर्तन अधिसूचना में हाइलाइट किए जाएंगे।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          We may update these terms with 30 days' advance notice via email to the registered account. Continued use of the platform after the notice period constitutes acceptance of the updated terms. Material changes will be clearly highlighted in the notification.
        </p>
      </>
    ),
  },
];

const TermsConditions: React.FC = () => {
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            नियम एवं शर्तें
          </h1>
          <p className="mt-2 text-xl md:text-2xl text-muted-foreground font-medium">
            Terms & Conditions
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            प्रभावी तिथि / Effective Date: 1 April 2025
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

      {/* Contact Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                संपर्क — Contact
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                इन नियमों और शर्तों से संबंधित किसी भी प्रश्न के लिए, कृपया हमसे संपर्क करें:
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                For any queries regarding these Terms and Conditions, please contact us:
              </p>
              <p className="mt-2 font-medium text-foreground">
                Email: <a href="mailto:legal@sahakarlekha.com" className="text-primary hover:underline">legal@sahakarlekha.com</a>
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                <strong>Effective Date / प्रभावी तिथि:</strong> 1 April 2025
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default TermsConditions;
