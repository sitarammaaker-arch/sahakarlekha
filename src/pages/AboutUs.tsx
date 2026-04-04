/**
 * SahakarLekha About Us Page — bilingual Hindi+English
 * Public page, no auth required
 */
import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  Target, Eye, Heart, Users, Shield, BookOpen,
  Globe, CheckCircle2, Building2,
} from 'lucide-react';

const COMPLIANCE_ITEMS = [
  'Haryana Co-op Societies Act 1984',
  'Maharashtra Co-op Societies Act 1960',
  'Multi-State Co-op Societies Act 2002',
  'Income Tax Act — TDS (192/194A/194C/194H/194J/194Q)',
  'GST Act — GSTR-1, GSTR-3B, e-Way Bill',
  'NABARD / DCCB Reporting',
  'RCS Audit Format (State-wise)',
  'ICAI Guidance Note on Cooperative Societies',
];

const AboutUs: React.FC = () => {
  return (
    <PublicLayout>
      {/* Section 1: Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            हमारे बारे में — <span className="text-primary">About SahakarLekha</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            India's first cooperative-specific cloud accounting platform
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
                  <h2 className="text-xl font-bold text-foreground">Vision / दृष्टि</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  भारत की हर सहकारी समिति को डिजिटल बनाना — यही हमारा सपना है। चाहे गांव की छोटी समिति हो या राज्य स्तरीय फेडरेशन, सबको आधुनिक लेखा प्रणाली मिलनी चाहिए।
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  To digitize every cooperative society in India — from village-level societies to state-level federations. Modern accounting should not be a privilege.
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
                  <h2 className="text-xl font-bold text-foreground">Mission / लक्ष्य</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  मुफ्त, अनुपालन-युक्त, द्विभाषी सॉफ्टवेयर बनाना जो हर सहकारी समिति के लिए सुलभ हो। कोई छिपा शुल्क नहीं, कोई जटिलता नहीं।
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Build free, compliant, bilingual accounting software accessible to every cooperative society. No hidden charges, no complexity.
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
            क्यों SahakarLekha? / Why SahakarLekha?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">8</p>
                <p className="mt-2 font-semibold text-foreground text-sm">समिति प्रकार / Society Types</p>
                <p className="mt-1 text-xs text-muted-foreground">Each type gets its own COA template</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">36</p>
                <p className="mt-2 font-semibold text-foreground text-sm">राज्य एवं केंद्रशासित / States & UTs</p>
                <p className="mt-1 text-xs text-muted-foreground">State-wise audit formats</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">100%</p>
                <p className="mt-2 font-semibold text-foreground text-sm">अनुपालन / Compliance-First</p>
                <p className="mt-1 text-xs text-muted-foreground">TDS, GST, Reserve Fund, Audit built-in</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">₹0</p>
                <p className="mt-2 font-semibold text-foreground text-sm">हमेशा मुफ्त / Forever Free</p>
                <p className="mt-1 text-xs text-muted-foreground">No credit card, no trial period</p>
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
              सहकारी आंदोलन / The Cooperative Movement
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">
              भारत में 8.5 लाख से अधिक सहकारी समितियां हैं — विश्व में सबसे अधिक। ये समितियां कृषि, डेयरी, आवास, उपभोक्ता वस्तुओं और वित्तीय सेवाओं में करोड़ों भारतीयों की सेवा करती हैं। 1904 से चली आ रही इस सहकारी आंदोलन ने ग्रामीण भारत की अर्थव्यवस्था की रीढ़ बनाई है।
            </p>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">
              India has over 8.5 lakh cooperative societies — the highest in the world. These societies serve crores of Indians across agriculture, dairy, housing, consumer goods, and financial services. Despite this scale, most societies still rely on manual registers or generic accounting software that doesn't understand cooperative law.
            </p>
            <p className="text-base sm:text-lg font-semibold text-primary text-center mt-6">
              SahakarLekha bridges this digital divide.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Built For India — Compliance */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            भारत के लिए बना / Built For India
          </h2>
          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-4">
            {COMPLIANCE_ITEMS.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-green-500/5 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
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
                हमारी टीम / Our Growing Team
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                सहकारी क्षेत्र के विशेषज्ञ, चार्टर्ड एकाउंटेंट और तकनीकी पेशेवरों की एक समर्पित टीम SahakarLekha को बनाती और बेहतर करती है।
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A dedicated team of cooperative sector experts, chartered accountants, and technology professionals builds and improves SahakarLekha every day.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default AboutUs;
