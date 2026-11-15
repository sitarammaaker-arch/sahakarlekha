/**
 * SahakarLekha About Us Page — Hindi or English, following the language switch
 * Public page, no auth required
 */
import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  Target, Eye, Heart, Users, Shield, BookOpen,
  Globe, CheckCircle2, Building2,
} from 'lucide-react';

// Product capabilities, not compliance guarantees — sections/formats differ by state Act.
const COMPLIANCE_ITEMS: { hi: string; en: string }[] = [
  {
    hi: 'राज्यवार ऑडिट अनुसूचियाँ — हरियाणा, महाराष्ट्र, गुजरात, कर्नाटक, केरल, UP और अन्य',
    en: 'State-wise audit schedules — Haryana, Maharashtra, Gujarat, Karnataka, Kerala, UP and more',
  },
  {
    hi: 'सांविधिक आरक्षित निधि (Reserve Fund) विनियोजन — % आपके राज्य अधिनियम / उपनियमों के अनुसार',
    en: 'Statutory Reserve Fund appropriation — % as per your state Act / bye-laws',
  },
  {
    hi: 'TDS रजिस्टर + तिमाही TDS डेटा एक्सपोर्ट (पुराना Form 26Q ढाँचा; फाइलिंग आप e-Filing पोर्टल पर करते हैं)',
    en: 'TDS register + quarterly TDS data export (legacy Form 26Q layout; you file on the e-Filing portal)',
  },
  {
    hi: 'GST — GSTR-1 / GSTR-3B के आँकड़े, e-Way Bill JSON (फाइलिंग आप सरकारी पोर्टल पर करते हैं)',
    en: 'GST — GSTR-1 / GSTR-3B figures, e-Way Bill JSON (you file on the government portals)',
  },
  {
    hi: 'NABARD / DCCB जैसी MIS रिपोर्ट',
    en: 'NABARD / DCCB-style MIS report',
  },
  {
    hi: 'RCS दो-खंड वाला ट्रायल बैलेंस व बैलेंस शीट',
    en: 'RCS two-section Trial Balance & Balance Sheet',
  },
];

const AboutUs: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L(
      'हमारे बारे में — SahakarLekha | सहकारी समिति लेखा सॉफ्टवेयर',
      'About Us — SahakarLekha | Cooperative Society Accounting Software',
    ),
    description: L(
      'SahakarLekha भारत की सहकारी समितियों के लिए बना लेखा प्लेटफ़ॉर्म है — हमारा उद्देश्य, दृष्टि व अनुपालन (RCS, TDS, GST, NABARD). Learn about our mission to digitise cooperative society accounting across India.',
      'SahakarLekha is an accounting platform built for India\'s cooperative societies — our mission, vision and compliance (RCS, TDS, GST, NABARD). Learn about our mission to digitise cooperative society accounting across India.',
    ),
    canonicalPath: '/about',
  });
  return (
    <PublicLayout>
      {/* Section 1: Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            {language === 'hi' ? (
              <>हमारे बारे में — <span className="text-primary">सहकार लेखा</span></>
            ) : (
              <span className="text-primary">About SahakarLekha</span>
            )}
          </h1>
          <p className="mt-4 text-sm sm:text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            {L('सहकारी समितियों के लिए बना क्लाउड लेखा प्लेटफ़ॉर्म', 'A cooperative-specific cloud accounting platform')}
          </p>
        </div>
      </section>

      {/* Section 2: Vision & Mission */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Vision */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{L('दृष्टि', 'Vision')}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {L(
                    'भारत की हर सहकारी समिति को डिजिटल बनाना — यही हमारा सपना है। चाहे गांव की छोटी समिति हो या राज्य स्तरीय फेडरेशन, सबको आधुनिक लेखा प्रणाली मिलनी चाहिए।',
                    'To digitize every cooperative society in India — from village-level societies to state-level federations. Modern accounting should not be a privilege.',
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Mission */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Eye className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{L('लक्ष्य', 'Mission')}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {L(
                    'किफ़ायती, अनुपालन-युक्त, द्विभाषी सॉफ्टवेयर बनाना जो हर सहकारी समिति के लिए सुलभ हो। कोई छिपा शुल्क नहीं, कोई जटिलता नहीं।',
                    'Build affordable, compliant, bilingual accounting software accessible to every cooperative society. No hidden charges, no complexity.',
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Section 3: Why SahakarLekha */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            {L('क्यों SahakarLekha?', 'Why SahakarLekha?')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">8</p>
                <p className="mt-2 font-semibold text-foreground text-sm">{L('समिति प्रकार', 'Society Types')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{L('हर प्रकार का अपना खाता-चार्ट (COA) टेम्पलेट', 'Each type gets its own COA template')}</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">36</p>
                <p className="mt-2 font-semibold text-foreground text-sm">{L('राज्य एवं केंद्रशासित', 'States & UTs')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{L('राज्यवार ऑडिट प्रारूप', 'State-wise audit formats')}</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">100%</p>
                <p className="mt-2 font-semibold text-foreground text-sm">{L('अनुपालन', 'Compliance-First')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{L('TDS, GST, आरक्षित निधि, ऑडिट — सब अंदर ही', 'TDS, GST, Reserve Fund, Audit built-in')}</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">₹2,999</p>
                <p className="mt-2 font-semibold text-foreground text-sm">{L('प्रति वर्ष + GST से', 'Per year + GST, from')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{L('कोई छिपा शुल्क नहीं, कभी भी एक्सपोर्ट करें', 'No hidden charges, export anytime')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Section 4: The Cooperative Movement */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-8">
              {L('सहकारी आंदोलन', 'The Cooperative Movement')}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">
              {L(
                'भारत में 8.5 लाख से अधिक सहकारी समितियां हैं — विश्व में सबसे अधिक। ये समितियां कृषि, डेयरी, आवास, उपभोक्ता वस्तुओं और वित्तीय सेवाओं में करोड़ों भारतीयों की सेवा करती हैं। 1904 से चली आ रही इस सहकारी आंदोलन ने ग्रामीण भारत की अर्थव्यवस्था की रीढ़ बनाई है।',
                'India has over 8.5 lakh cooperative societies — the highest in the world. These societies serve crores of Indians across agriculture, dairy, housing, consumer goods, and financial services. Despite this scale, most societies still rely on manual registers or generic accounting software that doesn\'t understand cooperative law.',
              )}
            </p>
            <p className="text-base sm:text-lg font-semibold text-primary text-center mt-6">
              {L('SahakarLekha यही डिजिटल दूरी मिटाता है।', 'SahakarLekha bridges this digital divide.')}
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Built For India — Compliance */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            {L('भारत के लिए बना', 'Built For India')}
          </h2>
          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-4">
            {COMPLIANCE_ITEMS.map((item) => (
              <div key={item.en} className="flex items-start gap-3 rounded-lg bg-green-500/5 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{L(item.hi, item.en)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6: Team */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <div className="rounded-full bg-primary/10 p-4 w-fit mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
                {L('हमारी टीम', 'Our Growing Team')}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {L(
                  'सहकारी क्षेत्र के विशेषज्ञ, चार्टर्ड एकाउंटेंट और तकनीकी पेशेवरों की एक समर्पित टीम SahakarLekha को बनाती और बेहतर करती है।',
                  'A dedicated team of cooperative sector experts, chartered accountants, and technology professionals builds and improves SahakarLekha every day.',
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default AboutUs;
