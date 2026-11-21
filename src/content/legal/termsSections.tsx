/**
 * Terms & Conditions — the section text, shared by the page (src/pages/TermsConditions.tsx) and the build-time prerender
 * (scripts/prerender-guide.mjs, via src/content/legal/legalHtml.tsx), so a crawler without JavaScript reads the same
 * binding text the page shows (SEO-04). Same rules as before: every statement must match the live system, and the
 * hi / en bodies must say the same thing — change both together.
 */
import {
  FileText, CheckSquare, UserPlus, ShieldCheck, Database,
  Award, Server, AlertTriangle, XCircle, Scale, PenLine,
} from 'lucide-react';

export const SECTIONS = [
  {
    num: 1,
    icon: CheckSquare,
    title: { hi: 'स्वीकृति', en: 'Acceptance' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        SahakarLekha पर पंजीकरण या उपयोग करके, आप इन नियमों और शर्तों से सहमत होते हैं। आपकी आयु 18 वर्ष या उससे अधिक होनी चाहिए और आप किसी भी भारतीय सहकारी समिति अधिनियम (राज्य या बहु-राज्य) के तहत पंजीकृत सहकारी समिति के अधिकृत प्रतिनिधि होने चाहिए।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        By registering for or using SahakarLekha, you agree to these Terms and Conditions. You must be 18 years of age or older and an authorized representative of a cooperative society registered under any Indian Cooperative Societies Act (State or Multi-State).
      </p>
    ),
  },
  {
    num: 2,
    icon: UserPlus,
    title: { hi: 'खाता पंजीकरण', en: 'Account Registration' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        प्रति समिति एक खाता। आप अपनी लॉगिन साख की सुरक्षा बनाए रखने के लिए जिम्मेदार हैं। सही समिति पंजीकरण विवरण (नाम, पंजीकरण संख्या, राज्य, प्रकार) प्रदान करें। अनधिकृत पहुंच की स्थिति में तुरंत हमें सूचित करें।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        One account per cooperative society. You are responsible for maintaining the security of your login credentials. Provide accurate society registration details (name, registration number, state, type). Notify us immediately of any unauthorized access to your account.
      </p>
    ),
  },
  {
    num: 3,
    icon: ShieldCheck,
    title: { hi: 'अनुमत उपयोग', en: 'Permitted Use' },
    hi: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          इस सॉफ्टवेयर का उपयोग केवल वैध सहकारी समिति लेखांकन के लिए करें। निम्नलिखित प्रतिबंधित है:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li>प्लेटफ़ॉर्म की पुनर्बिक्री, उप-लाइसेंस या पुनर्वितरण नहीं</li>
          <li>रिवर्स इंजीनियरिंग, डीकंपाइल या डिसअसेंबल नहीं</li>
          <li>मनी लॉन्ड्रिंग, धोखाधड़ी या किसी भी अवैध गतिविधि के लिए उपयोग नहीं</li>
          <li>स्वचालित scraping, bots या डेटा-संग्रह (harvesting) नहीं</li>
          <li>सुरक्षा भंग करने या दूसरी समितियों का डेटा देखने का कोई प्रयास नहीं</li>
        </ul>
      </>
    ),
    en: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          Use this software only for legitimate cooperative society accounting. The following is prohibited:
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
    title: { hi: 'डेटा स्वामित्व', en: 'Data Ownership' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        आपकी समिति का सारा लेखा डेटा आपकी समिति का स्वामित्व है। हम आपके वाउचर, सदस्य रिकॉर्ड, वित्तीय रिपोर्ट, या किसी भी समिति डेटा पर कोई स्वामित्व का दावा नहीं करते। आप किसी भी समय अपना सारा डेटा CSV, Excel या PDF प्रारूप में निर्यात कर सकते हैं।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        Your society owns all accounting data you enter into SahakarLekha. We claim no ownership over your vouchers, member records, financial reports, or any society data. You can export all your data at any time in CSV, Excel, or PDF format.
      </p>
    ),
  },
  {
    num: 5,
    icon: Award,
    title: { hi: 'बौद्धिक संपदा', en: 'Intellectual Property' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        SahakarLekha सॉफ्टवेयर, लोगो, डिज़ाइन और कोड हमारी बौद्धिक संपदा हैं। "SahakarLekha" और "सहकारलेखा" हमारे ट्रेडमार्क हैं। पूर्व लिखित सहमति के बिना आप सॉफ्टवेयर की नकल, उसमें संशोधन या उसका वितरण नहीं कर सकते, और न ही उससे व्युत्पन्न कृतियाँ बना सकते हैं।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        The SahakarLekha software, logo, design, and source code are our intellectual property. "SahakarLekha" and "सहकारलेखा" are our trademarks. You may not copy, modify, distribute, or create derivative works from the software without prior written consent.
      </p>
    ),
  },
  {
    num: 6,
    icon: Server,
    title: { hi: 'सेवा उपलब्धता', en: 'Service Availability' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        हम 99.9% अपटाइम का प्रयास करते हैं, लेकिन निर्बाध सेवा की गारंटी नहीं देते। निर्धारित रखरखाव के लिए ईमेल द्वारा पूर्व सूचना दी जाएगी। अप्रत्याशित घटनाएँ (प्राकृतिक आपदाएँ, सरकारी कार्रवाई, इंटरनेट बाधाएँ) अपटाइम प्रतिबद्धताओं से मुक्त हैं।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be communicated with advance notice via email. Force majeure events (natural disasters, government actions, internet outages) are excused from uptime commitments.
      </p>
    ),
  },
  {
    num: 7,
    icon: AlertTriangle,
    title: { hi: 'दायित्व सीमा', en: 'Limitation of Liability' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        सॉफ्टवेयर "जैसा है" के आधार पर, बिना किसी प्रकार की वारंटी के, प्रदान किया गया है। हम प्लेटफ़ॉर्म के उपयोग से होने वाली लेखा त्रुटियों, कर फाइलिंग गलतियों, या ऑडिट विफलताओं के लिए उत्तरदायी नहीं हैं। अधिकतम दायित्व सेवा के लिए भुगतान की गई राशि तक सीमित है। हम CA/ऑडिटर नहीं हैं — सभी गणनाओं को अपने ऑडिटर से सत्यापित करें।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        The software is provided "as is" without warranties of any kind. We are not liable for accounting errors, tax filing mistakes, or audit failures resulting from use of the platform. Maximum liability is limited to the amount paid for the service. <strong>We are not a Chartered Accountant or auditor</strong> — always verify all calculations with your society's qualified auditor.
      </p>
    ),
  },
  {
    num: 8,
    icon: XCircle,
    title: { hi: 'समाप्ति', en: 'Termination' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        कोई भी पक्ष किसी भी समय सेवा समाप्त कर सकता है। समाप्ति पर, आपके पास सभी डेटा निर्यात करने के लिए 30 दिन का समय होगा। 30 दिनों के बाद, डेटा स्थायी रूप से हटाया जा सकता है। इन नियमों का उल्लंघन करने वाले खातों को हम बिना पूर्व सूचना के निलंबित करने का अधिकार रखते हैं।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        Either party may terminate this agreement at any time. Upon termination, you will have a 30-day window to export all your society data. After 30 days, data may be permanently deleted. We reserve the right to suspend accounts that violate these terms without prior notice.
      </p>
    ),
  },
  {
    num: 9,
    icon: Scale,
    title: { hi: 'शासी कानून', en: 'Governing Law' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        ये नियम भारत के कानूनों द्वारा शासित हैं। विवाद नई दिल्ली के न्यायालयों के अधीन होंगे। पहले सौहार्दपूर्ण समाधान का प्रयास किया जाएगा, फिर मध्यस्थता एवं सुलह अधिनियम, 1996 के तहत मध्यस्थता।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts at New Delhi. Parties shall first attempt amicable resolution, failing which disputes shall be resolved through arbitration under the Arbitration and Conciliation Act, 1996.
      </p>
    ),
  },
  {
    num: 10,
    icon: PenLine,
    title: { hi: 'संशोधन', en: 'Amendments' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        हम पंजीकृत खाते के ईमेल के माध्यम से 30 दिन पूर्व सूचना के साथ इन नियमों को अपडेट कर सकते हैं। सूचना अवधि के बाद निरंतर उपयोग स्वीकृति मानी जाएगी। महत्वपूर्ण परिवर्तन अधिसूचना में हाइलाइट किए जाएंगे।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        We may update these terms with 30 days' advance notice via email to the registered account. Continued use of the platform after the notice period constitutes acceptance of the updated terms. Material changes will be clearly highlighted in the notification.
      </p>
    ),
  },
];
