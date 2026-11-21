/**
 * Privacy Policy — the section text, shared by the page (src/pages/PrivacyPolicy.tsx) and the build-time prerender
 * (scripts/prerender-guide.mjs, via src/content/legal/legalHtml.tsx), so a crawler without JavaScript reads the same
 * binding text the page shows (SEO-04). Same rules as before: every statement must match the live system, and the
 * hi / en bodies must say the same thing — change both together.
 */
import {
  Shield, Database, Lock, Cookie, Globe, UserCheck, Clock, Mail, Handshake,
} from 'lucide-react';

export const SECTIONS = [
  {
    num: 1,
    icon: Database,
    title: { hi: 'डेटा संग्रहण', en: 'Data We Collect' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        हम आपकी सहकारी समिति का खाता चलाने के लिए यह जानकारी रखते हैं: उपयोगकर्ता का नाम, ईमेल, फ़ोन नंबर, समिति का नाम व पंजीकरण संख्या, तथा लेखा डेटा (वाउचर, सदस्य, खाते)।
        आप जिन modules का उपयोग करते हैं, उनके अनुसार आपकी समिति ये विवरण भी दर्ज कर सकती है: सदस्यों का आधार व PAN (KYC);
        कर्मचारियों/मज़दूरों का PAN, आधार, बैंक खाता संख्या व IFSC (वेतन भुगतान हेतु); आपूर्तिकर्ताओं/ग्राहकों का PAN, GSTIN व बैंक विवरण; और समिति का बैंक खाता विवरण।
        ये विवरण आपकी समिति द्वारा दर्ज किए जाते हैं और केवल सेवा प्रदान करने के लिए उपयोग होते हैं। हम बायोमेट्रिक डेटा एकत्र नहीं करते।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        We hold the following to operate your cooperative society account: user name, email address, phone number, society name and registration number, and accounting data (vouchers, members, accounts).
        Depending on the modules you use, your society may also enter: members' Aadhaar and PAN (KYC); employees'/workers' PAN, Aadhaar, bank account number and IFSC (for wage/salary payment); suppliers'/customers' PAN, GSTIN and bank details; and the society's own bank account details.
        These details are entered by your society and used only to provide the service. We do <strong>not</strong> collect biometric data.
      </p>
    ),
  },
  {
    num: 2,
    icon: UserCheck,
    title: { hi: 'डेटा का उपयोग', en: 'How We Use Your Data' },
    hi: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          आपका डेटा केवल लेखा सेवाएं प्रदान करने के लिए उपयोग किया जाता है। हम आपका डेटा किसी तीसरे पक्ष को विपणन के लिए बेचते, किराए पर देते या साझा नहीं करते।
          डेटा का उपयोग इनके लिए किया जाता है:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li>सेवा प्रदान करना — SahakarLekha लेखा प्लेटफ़ॉर्म उपलब्ध कराना</li>
          <li>वित्तीय रिपोर्ट बनाना (Trial Balance, Balance Sheet, लाभ-हानि आदि)</li>
          <li>प्लेटफ़ॉर्म की सुरक्षा बनाए रखना और अनधिकृत पहुंच को रोकना</li>
          <li>प्लेटफ़ॉर्म का प्रदर्शन और उपयोगकर्ता अनुभव बेहतर बनाना</li>
        </ul>
      </>
    ),
    en: (
      <>
        <p className="text-muted-foreground leading-relaxed">
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
    title: { hi: 'डेटा संग्रहण स्थान', en: 'Data Storage & Security' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        आपका डेटा Supabase (PostgreSQL) डेटाबेस में संग्रहीत है, जो <strong>टोक्यो, जापान (ap-northeast-1)</strong> क्षेत्र में होस्ट है — यानी डेटा भारत के बाहर संग्रहीत होता है।
        स्वचालित साप्ताहिक बैकअप भी उसी प्रदाता व क्षेत्र में रखे जाते हैं। Supabase के अनुसार डेटा स्थिर अवस्था में AES-256 और ट्रांज़िट में TLS से एन्क्रिप्ट होता है।
        Row-Level Security (RLS) नीतियाँ हर समिति का डेटा अलग रखती हैं, ताकि एक समिति दूसरी समिति का डेटा न देख सके।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        Your data is stored in a Supabase (PostgreSQL) database hosted in the <strong>Tokyo, Japan (ap-northeast-1)</strong> region — i.e. data is stored outside India.
        Automated weekly backups are kept with the same provider and region. Per Supabase, data is encrypted at rest with AES-256 and in transit with TLS.
        Row-Level Security (RLS) policies keep each society's data separate so that one society cannot see another society's data.
      </p>
    ),
  },
  {
    num: 4,
    icon: Cookie,
    title: { hi: 'कुकीज़ व एनालिटिक्स', en: 'Cookies & Analytics' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        लॉगिन सत्र (session) आपके browser के local storage में रखा जाता है और logout करने या समय-सीमा पूरी होने पर समाप्त होता है।
        साइट व ऐप को बेहतर बनाने के लिए हम Google Analytics (GA4) का उपयोग करते हैं, जो browser में एक छद्म-नाम (pseudonymous) पहचान-कुकी रखता है। GA4 को ये जानकारी भेजी जाती है:
        देखे गए पेज (URL व पेज-शीर्षक सहित — ऐप के अंदर के पते से रिकॉर्ड की पहचान (id) और link के token हटाकर), public साइट पर किए गए खोज-शब्द, बटन-क्लिक तथा लॉगिन/पंजीकरण के चरण जैसे इवेंट (सफल या असफल और असफलता का प्रकार — आपका ईमेल, पासवर्ड या फ़ॉर्म में लिखी कोई चीज़ नहीं), तथा device/प्रदर्शन व तकनीकी-त्रुटि की जानकारी।
        हम आपके वाउचर, खाते या रिपोर्ट जैसे लेखा-रिकॉर्ड जान-बूझकर Analytics को नहीं भेजते। हम साइट पर विज्ञापन नहीं दिखाते और आपका डेटा नहीं बेचते।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        Your login session is kept in your browser's local storage and ends when you log out or it expires.
        To improve the site and app we use Google Analytics (GA4), which sets a pseudonymous identifier cookie in your browser. GA4 receives:
        pages viewed (including URL and page title — with record ids and link tokens removed from in-app addresses), search terms typed on the public site, events such as button clicks and login / registration steps (whether a step succeeded or failed and the kind of failure — never your email, your password or anything typed into a form), and device/performance and technical-error information.
        We do not intentionally send accounting records such as your vouchers, accounts or reports to Analytics. We do not show ads and never sell your data.
      </p>
    ),
  },
  {
    num: 5,
    icon: Globe,
    title: { hi: 'तृतीय-पक्ष सेवाएं', en: 'Third-Party Services' },
    hi: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          हम निम्नलिखित तृतीय-पक्ष सेवाओं का उपयोग करते हैं, और तकनीकी रूप से आवश्यक से अधिक कोई डेटा इन प्रदाताओं के साथ साझा नहीं किया जाता:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li><strong>Supabase</strong> — डेटाबेस, प्रमाणीकरण (authentication), फ़ाइल संग्रहण और बैकअप (टोक्यो, जापान क्षेत्र)</li>
          <li><strong>Vercel</strong> — एप्लिकेशन होस्टिंग और डिप्लॉयमेंट</li>
          <li><strong>Razorpay</strong> — सदस्यता शुल्क का ऑनलाइन भुगतान (भुगतान विवरण Razorpay पर दर्ज किए जाते हैं, हमारे पास संग्रहीत नहीं होते)</li>
          <li><strong>Resend</strong> — सेवा ईमेल भेजना (ईमेल सत्यापन, नए उपयोगकर्ता का स्वागत, भूमिका-परिवर्तन और वित्तीय वर्ष अनलॉक की सूचनाएँ, सदस्यता चालान, न्यूज़लेटर साइन-अप)। Resend को प्राप्तकर्ता का ईमेल पता और ईमेल की सामग्री (जैसे नाम, समिति का नाम, भूमिका, चालान की राशि) मिलती है। चालान PDF और लेखा रिपोर्ट संलग्न नहीं की जातीं — इसके बजाय ईमेल में ऐप का लिंक होता है। भूमिका-परिवर्तन और वित्तीय वर्ष की सूचनाएँ केवल उन्हीं पतों पर जाती हैं जिन्हें उनके स्वामी ने सत्यापित किया है; स्वागत ईमेल में वही सत्यापन लिंक होता है, और चालान उस उपयोगकर्ता को जाता है जिसने भुगतान किया (या समिति के admins को)</li>
          <li><strong>Zoho Mail</strong> — हमारा सहायता मेलबॉक्स (support@, privacy@, legal@ और hello@sahakarlekha.com)। जब आप इन पतों पर लिखते हैं, तो आपका ईमेल पता और आप जो कुछ भी लिखते या संलग्न करते हैं, वह भारत के बाहर Zoho के पास संग्रहीत होता है</li>
          <li><strong>Google Fonts</strong> — टाइपोग्राफ़ी; आपका browser fonts Google से मंगाता है, जिसे आपका IP पता और browser का विवरण मिलता है</li>
          <li><strong>Google Analytics (GA4)</strong> — उपयोग का विश्लेषण, जैसा धारा 4 में बताया गया है</li>
        </ul>
      </>
    ),
    en: (
      <>
        <ul className="ml-6 list-disc text-muted-foreground space-y-1">
          <li><strong>Supabase</strong> — Database, authentication, file storage and backups (Tokyo, Japan region)</li>
          <li><strong>Vercel</strong> — Application hosting and deployment</li>
          <li><strong>Razorpay</strong> — Online payment of subscription fees (payment details are entered on Razorpay, not stored by us)</li>
          <li><strong>Resend</strong> — Sending service emails (email verification, new-user welcome, role-change and financial-year unlock alerts, subscription invoices, newsletter sign-up). Resend receives the recipient's email address and the email's content (e.g. name, society name, role, invoice amounts). Invoice PDFs and accounting reports are not attached — the email links to the app instead. Role-change and financial-year alerts go only to addresses whose owner has verified them; the welcome email carries that verification link, and an invoice goes to the user who paid (or the society's admins)</li>
          <li><strong>Zoho Mail</strong> — Our support mailbox (support@, privacy@, legal@ and hello@sahakarlekha.com). When you write to these addresses, your email address and whatever you write or attach are stored with Zoho, outside India</li>
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
    title: { hi: 'आपके अधिकार', en: 'Your Rights' },
    hi: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          SahakarLekha अपनी ओर से आपको ये सुविधाएँ देता है:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li><strong>पहुंच (Access)</strong> — किसी भी समय अपनी समिति का सारा डेटा डाउनलोड करें</li>
          <li><strong>सुधार (Correct)</strong> — अपने खाते की कोई भी जानकारी अपडेट करें</li>
          <li><strong>हटाना (Delete)</strong> — अपनी समिति का डेटा हटाने का अनुरोध करें (धारा 7 देखें)</li>
          <li><strong>निर्यात (Export)</strong> — सभी रिपोर्ट और डेटा का CSV, Excel और PDF निर्यात</li>
          <li><strong>पोर्टेबिलिटी (Portability)</strong> — अपने डेटा के साथ किसी दूसरी प्रणाली पर जाएँ</li>
        </ul>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अधिकांश प्रावधान — जिनमें Data Principal के अधिकार (धारा 11–14) शामिल हैं — अधिसूचना G.S.R. 843(E) दिनांक 13 नवंबर 2025 के अनुसार 13 मई 2027 से लागू होंगे।
        </p>
      </>
    ),
    en: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          SahakarLekha provides the following to you as product commitments:
        </p>
        <ul className="mt-2 ml-6 list-disc text-muted-foreground space-y-1">
          <li><strong>Access</strong> — Download all your society's data at any time</li>
          <li><strong>Correct</strong> — Update any information in your account</li>
          <li><strong>Delete</strong> — Request deletion of your society's data (see section 7)</li>
          <li><strong>Export</strong> — CSV, Excel, and PDF export of all reports and data</li>
          <li><strong>Portability</strong> — Switch to another system with your data</li>
        </ul>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Most provisions of the Digital Personal Data Protection Act, 2023 — including Data Principal rights (sections 11–14) — come into force on 13 May 2027 under notification G.S.R. 843(E) dated 13 November 2025.
        </p>
      </>
    ),
  },
  {
    num: 7,
    icon: Clock,
    title: { hi: 'डेटा प्रतिधारण', en: 'Data Retention' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        आपका डेटा तब तक रखा जाता है जब तक आपका खाता सक्रिय है। सेवा समाप्त होने पर आपको सारा डेटा निर्यात करने के लिए 30 दिन मिलते हैं (नियम व शर्तें, धारा 8)।
        हटाने का अनुरोध (privacy@sahakarlekha.com पर) मिलने पर हम आपकी समिति का डेटा live डेटाबेस से हटाते हैं, और अनुरोध की प्रक्रिया के तहत उस समिति की बैकअप-प्रतियाँ भी हटाते हैं।
        स्वचालित साप्ताहिक बैकअप सामान्यतः सीमित अवधि तक रखे जाते हैं (नवीनतम 12 प्रतियाँ और पिछले 12 महीनों की हर महीने की एक प्रति); पुरानी प्रतियाँ अपने-आप हटती हैं।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        Data is retained while your account is active. On termination you have 30 days to export all your data (Terms &amp; Conditions, section 8).
        On receiving a deletion request (at privacy@sahakarlekha.com) we delete your society's data from the live database and, as part of processing that request, also delete that society's backup copies.
        Automated weekly backups are otherwise kept for a limited period (the latest 12 copies plus one copy per month for the previous 12 months); older copies are removed automatically.
      </p>
    ),
  },
  {
    num: 8,
    icon: UserCheck,
    title: { hi: 'गाइड प्रमाणपत्र', en: 'Guide Certificate' },
    hi: (
      <p className="text-muted-foreground leading-relaxed">
        हमारा सीखने वाला गाइड (/guide) पढ़ने के लिए किसी पंजीकरण की आवश्यकता नहीं है। केवल जब आप
        पूर्णता <strong>प्रमाणपत्र</strong> प्राप्त करना चुनते हैं, तब आपका <strong>नाम व ईमेल</strong> (और वैकल्पिक रूप से
        समिति का नाम) केवल प्रमाणपत्र जारी करने व उसके सत्यापन के लिए सुरक्षित रखा जाता है। यह आपकी सहमति से ही होता है।
        आपका ईमेल सार्वजनिक सत्यापन पेज पर कभी नहीं दिखाया जाता और कभी बेचा नहीं जाता।
      </p>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        Reading the learning guide requires no registration. Only when you choose to claim the completion
        <strong> certificate</strong> do we store your <strong>name and email</strong> (and optionally your society name),
        solely to issue and verify the certificate, and only with your consent. Your email is never shown on the public
        verification page and is never sold.
      </p>
    ),
  },
  {
    num: 9,
    icon: Handshake,
    // Hindi title kept as 'Referral partner — Partner Program' (scripts/test-referral.mjs reads it).
    title: { hi: 'Referral partner — Partner Program', en: 'Referral partner — Partner Program' },
    hi: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          <strong>Partner बनने वालों से:</strong> आवेदन में दिया गया नाम, मोबाइल नंबर, ईमेल (वैकल्पिक), काम, ज़िला/राज्य और
          आपकी घोषणा हम आवेदन की जाँच, आपसे संपर्क और आपके code से जुड़ी समितियों का रिकॉर्ड रखने के लिए सुरक्षित रखते हैं।
          Commission भेजने के लिए आप जो PAN, बैंक खाता / UPI और GSTIN देते हैं, वे सिर्फ़ भुगतान, TDS और कर-रिकॉर्ड के लिए
          रखे जाते हैं और केवल SahakarLekha का admin उन्हें देख सकता है; portal पर ये अधूरे (masked) दिखते हैं। Partner portal पर
          login आपके ईमेल पर भेजे गए कोड से होता है — कोड किसी को न बताएँ।
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          <strong>समितियों से:</strong> पंजीकरण के समय referral code देने पर उस partner को आपकी समिति का <strong>नाम, ज़िला,
          जुड़ने की तारीख़ और plan की स्थिति</strong> (trial / भुगतान हुआ) दिखती है — आपके खाते, सदस्य, वाउचर या संपर्क
          जानकारी कभी नहीं। Code देना पूरी तरह वैकल्पिक है।
        </p>
      </>
    ),
    en: (
      <p className="text-muted-foreground leading-relaxed">
        Partners: we keep the name, mobile, optional email, occupation, district/state and declaration you submit, to review
        the application, contact you and record the societies that joined with your code; the PAN, bank / UPI details and
        GSTIN you give for commission payments are used only for payment, TDS and tax records, and only our admin can see
        them (the portal shows them masked). Partner portal sign-in is by a code emailed to you — never share it. Societies: if you enter a referral
        code at sign-up, that partner sees your society's name, district, joining date and plan status only — never your
        accounts, members, vouchers or contact details. Entering a code is optional.
      </p>
    ),
  },
  {
    num: 10,
    icon: Mail,
    title: { hi: 'गोपनीयता संपर्क व शिकायत', en: 'Privacy Contact & Grievances' },
    hi: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          गोपनीयता संबंधी किसी भी प्रश्न, डेटा हटाने के अनुरोध या शिकायत के लिए हमसे संपर्क करें:
        </p>
        <p className="mt-2 font-medium text-foreground">
          ईमेल: <a href="mailto:privacy@sahakarlekha.com" className="text-primary hover:underline">privacy@sahakarlekha.com</a>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          कृपया अपने पत्र में अपनी समिति का नाम और पंजीकरण संख्या लिखें।
        </p>
      </>
    ),
    en: (
      <>
        <p className="text-muted-foreground leading-relaxed">
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
