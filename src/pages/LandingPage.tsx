/**
 * SahakarLekha Public Landing Page — conversion-optimised, bilingual, no auth.
 * Section order: Hero → Trust bar → Features → Society types → Demo →
 * Product tour → Testimonials → Tally comparison → Security → Audit/compliance
 * → Academy → Why-free/Who-we-are → Referral → Final CTA → Community.
 *
 * ASSET TODOs (drop files in /public, set the constants below):
 *  - DEMO_VIDEO_ID : YouTube id for the 90-sec demo (empty → shows the CSS mock)
 *  - WHATSAPP      : support number e.g. '919999999999' (empty → links /contact)
 *  - Screenshots   : /guide-shots/*.png (hero-dashboard, voucher, trial-balance,
 *                    balance-sheet, member-register, certificate) — auto-hide if absent
 *  - TESTIMONIALS  : add real, consented quotes to activate the section
 *  - Sample report : /sample-balance-sheet.pdf
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PublicLayout from '@/components/PublicLayout';
import { SOCIAL_CHANNELS, SocialIcon } from '@/lib/socials';
import {
  BookOpen, Shield, Users, BarChart3, FileText, Globe,
  CheckCircle2, XCircle, ArrowRight, Building2, Milk, Home, Factory,
  ShoppingCart, Hammer, Wheat, Landmark, Play, Lock, Database, RefreshCw,
  Download, GraduationCap, Quote, MessageCircle, Heart, Gift, Sparkles,
} from 'lucide-react';

/* ─── Config (set these as assets become available) ─── */
const DEMO_VIDEO_ID = '';                 // e.g. 'dQw4w9WgXcQ'
const WHATSAPP = '';                      // e.g. '919999999999'
const SAMPLE_REPORT = '/sample-balance-sheet.pdf';

const FEATURES = [
  { icon: BookOpen, title: 'Double-Entry Accounting', titleHi: 'दोहरी प्रविष्टि लेखा', desc: 'Voucher, Cash Book, Bank Book, Day Book, Ledger — complete accounting system' },
  { icon: BarChart3, title: 'Financial Reports', titleHi: 'वित्तीय रिपोर्ट', desc: 'Trial Balance, Balance Sheet, I&E, R&P, Trading Account — one-click PDF' },
  { icon: FileText, title: 'TDS 26Q + GST', titleHi: 'TDS 26Q + GST', desc: 'TDS Register, Form 26Q export for TRACES, GSTR-1/3B, e-Way Bill' },
  { icon: Shield, title: 'Audit Compliance', titleHi: 'ऑडिट अनुपालन', desc: 'Reserve Fund (Sec 65), Sec 32 Loan Limit, FY Lock, Audit Certificate' },
  { icon: Users, title: 'Member Management', titleHi: 'सदस्य प्रबंधन', desc: 'Share Register, Loan Register, Member Ledger, Profit Distribution' },
  { icon: Globe, title: 'Hindi + English', titleHi: 'हिंदी + अंग्रेजी', desc: 'Fully bilingual interface — switch anytime. PDF reports in English.' },
];

const SOCIETY_TYPES = [
  { icon: Wheat, name: 'Marketing Society', nameHi: 'विपणन समिति', desc: 'Hafed/FCI agent, MSP procurement' },
  { icon: Landmark, name: 'PACS', nameHi: 'प्राथमिक कृषि ऋण समिति', desc: 'Member loans, DCCB/NABARD' },
  { icon: ShoppingCart, name: 'Consumer Store', nameHi: 'उपभोक्ता भंडार', desc: 'Retail operations, inventory' },
  { icon: Milk, name: 'Dairy Cooperative', nameHi: 'दुग्ध सहकारी', desc: 'Milk collection, BMC, cattle feed' },
  { icon: Home, name: 'Housing Society', nameHi: 'आवास समिति', desc: 'Maintenance, sinking fund' },
  { icon: Factory, name: 'Sugar Factory', nameHi: 'चीनी सहकारी', desc: 'Cane procurement, sugar/molasses' },
  { icon: Hammer, name: 'Labour Society', nameHi: 'श्रमिक समिति', desc: 'Contract work, wages' },
  { icon: Building2, name: 'Other', nameHi: 'अन्य समिति', desc: 'Fisheries, weavers, multipurpose' },
];

const STATS = [
  { value: '8', label: 'Society Types', labelHi: 'समिति प्रकार' },
  { value: '36', label: 'States & UTs', labelHi: 'राज्य/केंद्रशासित' },
  { value: '150+', label: 'Account Heads', labelHi: 'खाता शीर्ष' },
  { value: '100%', label: 'Free', labelHi: 'मुफ्त' },
];

const TOUR = [
  { shot: 'voucher.png', title: 'आसान वाउचर एंट्री', titleEn: 'Easy voucher entry', desc: 'रसीद, भुगतान, जर्नल, कोंट्रा — एक-क्लिक टेम्पलेट; Dr=Cr अपने-आप जाँच।' },
  { shot: 'trial-balance.png', title: 'एक-क्लिक ट्रायल बैलन्स व रिपोर्ट', titleEn: 'One-click Trial Balance & reports', desc: 'ट्रायल बैलन्स, बैलेंस सीट, आय-व्यय — RCS दो-खंड प्रारूप में, सीधे PDF।' },
  { shot: 'member-register.png', title: 'सदस्य, शेयर व ऋण रजिस्टर', titleEn: 'Member, share & loan registers', desc: 'शेयर रजिस्टर, ऋण रजिस्टर, लाभ-विनियोग — सहकारी नियमानुसार।' },
  { shot: 'certificate.png', title: 'ऑडिट प्रमाणपत्र व अनुपालन', titleEn: 'Audit certificate & compliance', desc: 'संचय निधि (धारा 65), FY-लॉक, ऑडिट प्रमाणपत्र — ऑडिट तैयार।' },
];

const TALLY_ROWS = [
  { f: 'Built for cooperative societies / सहकारी समितियों के लिए बना', tally: false, zoho: false, sl: true },
  { f: 'RCS audit-format reports (Sec 65, two-section TB)', tally: 'manual', zoho: false, sl: true },
  { f: 'TDS 26Q + GST for societies', tally: 'partial', zoho: 'GST', sl: true },
  { f: 'Federation / NABARD / DCCB reports', tally: false, zoho: false, sl: true },
  { f: 'Member share/loan register, profit appropriation', tally: false, zoho: false, sl: true },
  { f: 'Hindi-first, fully bilingual / हिंदी-प्रथम', tally: 'partial', zoho: 'partial', sl: true },
  { f: 'Cloud + automatic backup', tally: 'add-on', zoho: true, sl: true },
  { f: 'Free learning + certification / मुफ्त कोर्स + प्रमाणपत्र', tally: false, zoho: false, sl: true },
  { f: 'Price / मूल्य', tally: '₹ licence/yr', zoho: '₹/month', sl: 'Free' },
];

const SECURITY = [
  { icon: Lock, title: 'सुरक्षित व अलग डेटा', titleEn: 'Encrypted & isolated', desc: 'समिति-स्तरीय सुरक्षा (RLS) — कोई दूसरी समिति आपके खाते कभी नहीं देख सकती।' },
  { icon: Database, title: 'स्वतः बैकअप', titleEn: 'Automatic backups', desc: 'क्लाउड में सुरक्षित; जब चाहें PDF/Excel में पूरा डेटा निर्यात करें।' },
  { icon: RefreshCw, title: 'आपका डेटा, आपका अधिकार', titleEn: 'Your data, your control', desc: 'कभी भी सब कुछ डाउनलोड करें — कोई लॉक-इन नहीं, डेटा कभी बेचा नहीं जाता।' },
  { icon: Shield, title: 'पूरा ऑडिट-ट्रेल', titleEn: 'Full audit trail', desc: 'हर प्रविष्टि किसने/कब बनाई-बदली; रद्द भी कारण सहित — ऑडिट में पारदर्शी।' },
];

/* Add real, consented quotes here to activate the testimonials section.
   Shape: { quoteHi, quoteEn, name, role, place } */
const TESTIMONIALS: { quoteHi: string; quoteEn: string; name: string; role: string; place: string }[] = [];

/* ─── Screenshot with graceful fallback: shows the real /guide-shots image when
   present, otherwise renders the supplied fallback (mock UI / placeholder). ─── */
const Figure: React.FC<{ file: string; alt: string; fallback: React.ReactNode }> = ({ file, alt, fallback }) => {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={`/guide-shots/${file}`}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="rounded-xl border shadow-md w-full ring-1 ring-black/5"
    />
  );
};

const ShotPlaceholder: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-muted/40 aspect-[16/10] flex flex-col items-center justify-center text-center p-6">
    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
      <BarChart3 className="h-5 w-5 text-primary" />
    </div>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

/* ─── Hero CSS mock dashboard (always looks alive before real screenshots) ─── */
const MockDashboard: React.FC = () => (
  <div className="rounded-xl border bg-white shadow-2xl overflow-hidden ring-1 ring-black/5">
    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b bg-muted/40">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
      <span className="ml-3 text-[11px] text-muted-foreground">sahakarlekha.com · Dashboard</span>
    </div>
    <div className="p-4 grid grid-cols-3 gap-3">
      {[['नकद · Cash', '₹ 4,09,000'], ['सदस्य · Members', '112'], ['अधिशेष · Surplus', '₹ 11,000']].map(([k, v]) => (
        <div key={k} className="rounded-lg border bg-primary/5 p-3">
          <p className="text-[10px] text-muted-foreground">{k}</p>
          <p className="text-sm font-bold text-primary mt-1">{v}</p>
        </div>
      ))}
    </div>
    <div className="px-4 pb-4">
      <div className="rounded-lg border p-3">
        <p className="text-[11px] font-semibold text-foreground mb-2">मासिक बिक्री · Monthly Sales</p>
        <div className="flex items-end gap-1.5 h-20">
          {[40, 62, 48, 80, 55, 92, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const Yes = () => <CheckCircle2 className="h-5 w-5 text-success mx-auto" />;
const No = () => <XCircle className="h-5 w-5 text-muted-foreground/50 mx-auto" />;
const cell = (v: boolean | string) =>
  v === true ? <Yes /> : v === false ? <No /> : <span className="text-xs text-muted-foreground">{v}</span>;

const LandingPage: React.FC = () => {
  return (
    <PublicLayout>
      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Sparkles className="h-3.5 w-3.5" /> भारत की सहकारी समितियों के लिए · 100% मुफ्त
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
              अपनी समिति का ऑडिट अब हफ़्तों नहीं, <span className="text-primary">केवल दिनों में पूरा करें</span>।
            </h1>
            <p className="mt-4 text-base lg:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              भारत का <strong className="text-foreground">एकमात्र सहकारी-विशेष</strong> लेखा सॉफ्टवेयर — ट्रायल बैलन्स, बैलेंस सीट, TDS 26Q, GST व RCS ऑडिट-प्रारूप, सब एक क्लिक में।
              <br /><span className="text-sm">India's only cooperative-specific accounting platform. Hindi + English. Free forever.</span>
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link to="/register">
                <Button size="lg" className="gap-2 text-base px-8 w-full sm:w-auto">
                  मुफ्त में शुरू करें / Start Free <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#demo">
                <Button size="lg" variant="outline" className="gap-2 text-base px-6 w-full sm:w-auto">
                  <Play className="h-4 w-4" /> 90-सेकंड डेमो देखें
                </Button>
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground text-center lg:text-left">
              ✓ कोई कार्ड नहीं · ✓ डेटा कभी भी निर्यात करें · ✓ कोई लॉक-इन नहीं
            </p>
          </div>

          <div className="relative">
            <Figure file="hero-dashboard.png" alt="SahakarLekha dashboard" fallback={<MockDashboard />} />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-3xl mx-auto px-4">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.labelHi}<br />{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── TRUST BAR ───────── */}
      <section className="py-6 bg-white border-y">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
          {[
            ['🏛️', 'सहकारी-विशेष', 'Built for cooperatives'],
            ['🆓', 'हमेशा मुफ्त', 'Free forever'],
            ['🔒', 'आपका डेटा सुरक्षित', 'Your data, exportable'],
            ['🇮🇳', 'हिंदी + English', '36 states'],
          ].map(([e, hi, en]) => (
            <div key={en as string} className="flex flex-col items-center">
              <span className="text-xl">{e}</span>
              <span className="font-semibold text-foreground mt-1">{hi}</span>
              <span className="text-xs text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── FEATURES ───────── */}
      <section className="py-16 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">सम्पूर्ण लेखा प्रणाली — Complete Accounting System</h2>
          <p className="mt-2 text-center text-muted-foreground">Tally + Zoho + Auditor — सब एक जगह</p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <Card key={f.title} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <f.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{f.titleHi}</h3>
                      <p className="text-sm font-medium text-primary">{f.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── SOCIETY TYPES ───────── */}
      <section className="py-16 bg-muted/30" id="types">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">8 प्रकार की समितियों के लिए — For All Cooperative Types</h2>
          <p className="mt-2 text-center text-muted-foreground">समिति का प्रकार चुनें → खाता-चार्ट ऑटो-लोड → तुरंत शुरू करें</p>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            {SOCIETY_TYPES.map(s => (
              <Card key={s.name} className="hover:shadow-md transition-shadow text-center">
                <CardContent className="pt-6 pb-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <s.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{s.nameHi}</h3>
                  <p className="text-xs text-primary">{s.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── DEMO ───────── */}
      <section className="py-16 bg-white" id="demo">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">90 सेकंड में देखें यह कैसे काम करता है</h2>
          <p className="mt-2 text-muted-foreground">See a full year — opening balances → vouchers → audit-ready Balance Sheet.</p>
          <div className="mt-8 rounded-xl overflow-hidden border shadow-lg bg-muted/30">
            {DEMO_VIDEO_ID ? (
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}`}
                  title="SahakarLekha demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="p-6"><MockDashboard /></div>
            )}
          </div>
          <div className="mt-6">
            <a href={SAMPLE_REPORT} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> नमूना रिपोर्ट PDF डाउनलोड करें / Sample report</Button>
            </a>
          </div>
        </div>
      </section>

      {/* ───────── PRODUCT TOUR ───────── */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">अंदर एक नज़र — A look inside</h2>
          {TOUR.map((t, i) => (
            <div key={t.shot} className={`grid md:grid-cols-2 gap-8 items-center ${i % 2 ? 'md:[direction:rtl]' : ''}`}>
              <div className="[direction:ltr]">
                <h3 className="text-xl font-bold text-foreground">{t.title}</h3>
                <p className="text-sm font-medium text-primary">{t.titleEn}</p>
                <p className="mt-2 text-muted-foreground">{t.desc}</p>
              </div>
              <div className="[direction:ltr]">
                <Figure file={t.shot} alt={t.titleEn} fallback={<ShotPlaceholder label={t.titleEn} />} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── TESTIMONIALS (renders when real quotes are added) ───────── */}
      {TESTIMONIALS.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">समितियाँ क्या कहती हैं — What societies say</h2>
            <div className="mt-10 grid md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <Card key={t.name}><CardContent className="pt-6">
                  <Quote className="h-7 w-7 text-primary/30" />
                  <p className="mt-2 text-sm text-foreground">{t.quoteHi}</p>
                  <p className="mt-2 text-xs text-muted-foreground italic">{t.quoteEn}</p>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role} · {t.place}</p>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── TALLY COMPARISON ───────── */}
      <section className="py-16 bg-white" id="compare">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">Tally / Zoho बनाम SahakarLekha</h2>
          <p className="mt-2 text-center text-muted-foreground">सहकारी समिति के लिए जो ज़रूरी है, वही यहाँ बना-बनाया है।</p>
          <div className="mt-8 overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-semibold">Feature</th>
                  <th className="p-3 font-semibold text-center w-24">Tally</th>
                  <th className="p-3 font-semibold text-center w-24">Zoho</th>
                  <th className="p-3 font-semibold text-center w-28 text-primary">SahakarLekha</th>
                </tr>
              </thead>
              <tbody>
                {TALLY_ROWS.map((r) => (
                  <tr key={r.f} className="border-t even:bg-muted/20">
                    <td className="p-3">{r.f}</td>
                    <td className="p-3 text-center">{cell(r.tally)}</td>
                    <td className="p-3 text-center">{cell(r.zoho)}</td>
                    <td className="p-3 text-center bg-primary/5 font-medium">{cell(r.sl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ───────── SECURITY ───────── */}
      <section className="py-16 bg-muted/30" id="security">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">आपका डेटा, पूरी तरह सुरक्षित — Your data, fully secure</h2>
          <p className="mt-2 text-center text-muted-foreground">सदस्य-डेटा व खातों की सुरक्षा हमारी पहली प्राथमिकता है।</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SECURITY.map(s => (
              <Card key={s.titleEn}><CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{s.title}</h3>
                <p className="text-xs font-medium text-primary">{s.titleEn}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </CardContent></Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── ACADEMY ───────── */}
      <section className="py-16 bg-white" id="academy">
        <div className="max-w-5xl mx-auto px-4">
          <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
            <CardContent className="p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-primary text-sm font-semibold">
                  <GraduationCap className="h-4 w-4" /> मुफ्त लर्निंग एकेडमी
                </span>
                <h2 className="mt-2 text-2xl font-bold text-foreground">सहकारी लेखांकन — 30 अध्याय का मुफ्त कोर्स + प्रमाणपत्र</h2>
                <p className="mt-2 text-muted-foreground">
                  नींव से ऑडिट तक — सरल हिंदी व English में। क्विज़ हल करें, सत्यापन-योग्य प्रमाणपत्र पाएँ। बिना लॉगिन, बिल्कुल मुफ्त।
                  <br /><span className="text-sm">Free 30-chapter cooperative accounting course + verifiable certificate.</span>
                </p>
              </div>
              <Link to="/guide" className="shrink-0">
                <Button size="lg" className="gap-2 w-full">कोर्स शुरू करें <ArrowRight className="h-5 w-5" /></Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ───────── AUDIT / COMPLIANCE ───────── */}
      <section className="py-16 bg-muted/30" id="compliance">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">कानूनी अनुपालन बिल्ट-इन — Compliance Built-in</h2>
          <p className="mt-2 text-center text-muted-foreground">Tally aur Zoho mein yeh features nahi milte.</p>
          <div className="mt-8 space-y-3">
            {[
              'Haryana / Maharashtra / Multi-State Co-op Societies Acts',
              'Income Tax — TDS Sec 192/194A/194C/194H/194J/194Q, Form 26Q',
              'GST — GSTR-1, GSTR-3B, e-Invoice, e-Way Bill',
              'NABARD / DCCB reporting · RCS audit format (state-wise)',
              'Reserve Fund (Sec 65) · ICAI Guidance Note on Cooperative Societies',
            ].map(c => (
              <div key={c} className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm font-medium">{c}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <a href={SAMPLE_REPORT} target="_blank" rel="noopener noreferrer" className="text-primary text-sm font-medium inline-flex items-center gap-1.5 hover:underline">
              <Download className="h-4 w-4" /> असली RCS-प्रारूप बैलेंस शीट देखें (नमूना PDF)
            </a>
          </div>
        </div>
      </section>

      {/* ───────── WHY FREE / WHO WE ARE ───────── */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Heart className="h-9 w-9 text-primary mx-auto mb-3" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">यह मुफ्त क्यों है?</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            भारत की 8 लाख से ज़्यादा सहकारी समितियाँ ग्रामीण भारत की रीढ़ हैं — पर इनके लिए कभी कोई सॉफ्टवेयर नहीं बना; सब Tally जैसे सामान्य औज़ार को ज़बरदस्ती सहकारी प्रारूप में ढालते रहे।
            <strong className="text-foreground"> SahakarLekha इसी को बदलने के लिए बना है</strong> — और छोटी समितियों के लिए यह हमेशा मुफ्त रहेगा।
            <br /><span className="text-sm">We sustain it through optional premium features for large multi-branch societies — the core stays free, forever.</span>
          </p>
        </div>
      </section>

      {/* ───────── REFERRAL ───────── */}
      <section className="py-12 bg-primary/5 border-y">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Gift className="h-8 w-8 text-primary mx-auto mb-2" />
          <h3 className="text-xl font-bold text-foreground">किसी और समिति को बताएँ</h3>
          <p className="mt-1 text-sm text-muted-foreground">अपनी जान-पहचान की समिति, लेखाकार या ऑडिटर को SahakarLekha के बारे में बताएँ — मिलकर सहकारिता को डिजिटल बनाएँ।</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent('SahakarLekha — सहकारी समितियों के लिए मुफ्त लेखा सॉफ्टवेयर। देखें: https://sahakarlekha.com')}`}
              target="_blank" rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp पर शेयर करें</Button>
            </a>
          </div>
        </div>
      </section>

      {/* ───────── FINAL CTA ───────── */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">आज ही मुफ्त में शुरू करें</h2>
          <p className="mt-3 text-lg text-primary-foreground/80">
            Start Free Today — No credit card, no hidden charges. आपका डेटा कभी भी निर्यात करें; कोई लॉक-इन नहीं।
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="gap-2 text-base px-8">
                मुफ्त पंजीकरण / Free Registration <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            {WHATSAPP ? (
              <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 bg-transparent text-white border-white/40 hover:bg-white/10">
                  <MessageCircle className="h-4 w-4" /> WhatsApp सहायता
                </Button>
              </a>
            ) : (
              <Link to="/contact">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 bg-transparent text-white border-white/40 hover:bg-white/10">
                  <MessageCircle className="h-4 w-4" /> सहायता / Support
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ───────── COMMUNITY ───────── */}
      <section className="py-12 bg-muted/30 border-t">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-xl font-bold text-foreground">हमारे समुदाय से जुड़ें / Join our community</h3>
          <p className="mt-1 text-sm text-muted-foreground">हर नया फ़ीचर, टिप और वीडियो सबसे पहले पाएँ — Updates, tips & tutorials.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {SOCIAL_CHANNELS.map(c => (
              <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" aria-label={c.label}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-white text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 ${c.solidBg}`}>
                <SocialIcon paths={c.paths} className="h-4 w-4" />
                {c.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default LandingPage;
