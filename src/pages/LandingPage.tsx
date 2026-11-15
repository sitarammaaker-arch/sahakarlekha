/**
 * SahakarLekha Public Landing Page — conversion-optimised, bilingual, no auth.
 * Copy follows the app language (useLanguage): Hindi by default (also what the
 * build-time prerender shows), English when the visitor switches.
 * Section order: Hero → Trust bar → Features → Society types → Demo →
 * Product tour → Testimonials → Tally comparison → Security → Audit/compliance
 * → Academy → Why-free/Who-we-are → Referral → Final CTA → Community.
 *
 * ASSET TODOs (drop files in /public, set the constants below):
 *  - DEMO_VIDEO_ID : YouTube id for the 1-minute demo (empty → shows the CSS mock)
 *  - WHATSAPP      : support number e.g. '919999999999' (empty → links /contact)
 *  - Screenshots   : /guide-shots/*.png (hero-dashboard, voucher, trial-balance,
 *                    balance-sheet, member-register, certificate) — auto-hide if absent
 *  - TESTIMONIALS  : add real, consented quotes to activate the section
 *  - Sample report : /sample-balance-sheet.pdf
 */
import React from 'react';
import { Link } from '@/components/LocalLink';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PublicLayout from '@/components/PublicLayout';
import Testimonials from '@/components/Testimonials';
import EmailCapture from '@/components/EmailCapture';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizePost } from '@/content/blog/en';
import { SOCIAL_CHANNELS, SocialIcon, WHATSAPP_NUMBER } from '@/lib/socials';
import { trackEvent } from '@/lib/analytics';
import { publishedOrder, readingMinutes } from '@/content/blog';
import { formatDate } from '@/components/blog/blogTheme';
import {
  BookOpen, Shield, Users, BarChart3, FileText, Globe,
  CheckCircle2, XCircle, ArrowRight, Building2, Milk, Home, Factory,
  ShoppingCart, Hammer, Wheat, Landmark, Play, Lock, Database, RefreshCw,
  Download, GraduationCap, Quote, MessageCircle, Heart, Gift, Sparkles,
} from 'lucide-react';

/* ─── Config (set these as assets become available) ─── */
const DEMO_VIDEO_ID = 'jiY7i8JaV0M';      // "1-Minute Demo" (1:15) — youtube.com/watch?v=jiY7i8JaV0M
const WHATSAPP = WHATSAPP_NUMBER;          // central number from socials.tsx
const SHOW_COMMUNITY = false;              // temporarily hide the homepage community/social section (user request 2026-08-20) — flip to true to re-enable
// Sample report is generated on-demand from a fictional demo society — no static asset.
const handleSampleReport = async () => {
  trackEvent('sample_report_generated', { location: 'landing' });
  const { generateSampleReportPDF } = await import('@/lib/sampleReport');
  generateSampleReportPDF();
};

type Lang = 'hi' | 'en';
/** Text that is the same in both languages, or a { hi, en } pair. */
type Txt = string | { hi: string; en: string };
const tx = (t: Txt, lang: Lang) => (typeof t === 'string' ? t : t[lang]);

const FEATURES = [
  { icon: BookOpen, title: 'Double-Entry Accounting', titleHi: 'दोहरी एंट्री लेखा', desc: 'Voucher, Cash Book, Bank Book, Day Book, Ledger — complete accounting system', descHi: 'वाउचर, कैश बुक, बैंक बुक, डे बुक, लेजर — पूरी लेखा प्रणाली' },
  { icon: BarChart3, title: 'Financial Reports', titleHi: 'वित्तीय रिपोर्ट', desc: 'Trial Balance, Balance Sheet, I&E, R&P, Trading Account — one-click PDF', descHi: 'ट्रायल बैलेंस, बैलेंस शीट, आय-व्यय, प्राप्ति-भुगतान, ट्रेडिंग खाता — एक क्लिक में PDF' },
  { icon: FileText, title: 'TDS + GST', titleHi: 'TDS + GST', desc: 'TDS Register + quarterly TDS data export, GSTR-1/3B figures, e-Way Bill JSON — filing is done by you on the government portals', descHi: 'TDS रजिस्टर + तिमाही TDS डेटा export, GSTR-1/3B के आँकड़े, e-Way Bill JSON — रिटर्न आप सरकारी पोर्टल पर खुद भरते हैं' },
  { icon: Shield, title: 'Audit Compliance', titleHi: 'ऑडिट अनुपालन', desc: 'Reserve Fund appropriation, loan-exposure check, FY Lock, Audit Certificate', descHi: 'आरक्षित निधि विनियोजन, ऋण-सीमा जाँच, FY लॉक, ऑडिट प्रमाणपत्र' },
  { icon: Users, title: 'Member Management', titleHi: 'सदस्य प्रबंधन', desc: 'Share Register, Loan Register, Member Ledger, Profit Distribution', descHi: 'शेयर रजिस्टर, ऋण रजिस्टर, सदस्य खाता, लाभ का बँटवारा' },
  { icon: Globe, title: 'Hindi + English', titleHi: 'हिंदी + अंग्रेजी', desc: 'Fully bilingual interface — switch anytime. PDF reports in English.', descHi: 'पूरा इंटरफ़ेस हिंदी और अंग्रेज़ी दोनों में — जब चाहें बदलें। PDF रिपोर्ट अंग्रेज़ी में।' },
];

const SOCIETY_TYPES = [
  { icon: Wheat, name: 'Marketing Society', nameHi: 'विपणन समिति', desc: 'MSP procurement, agency commission', descHi: 'MSP खरीद, एजेंसी कमीशन' },
  { icon: Landmark, name: 'PACS', nameHi: 'प्राथमिक कृषि ऋण समिति', desc: 'Member loans, DCCB/NABARD', descHi: 'सदस्य ऋण, DCCB/NABARD' },
  { icon: ShoppingCart, name: 'Consumer Store', nameHi: 'उपभोक्ता भंडार', desc: 'Retail operations, inventory', descHi: 'खुदरा बिक्री, स्टॉक' },
  { icon: Milk, name: 'Dairy Cooperative', nameHi: 'दुग्ध सहकारी', desc: 'Milk collection, BMC, cattle feed', descHi: 'दूध संग्रह, BMC, पशु आहार' },
  { icon: Home, name: 'Housing Society', nameHi: 'आवास समिति', desc: 'Maintenance, sinking fund', descHi: 'रखरखाव, सिंकिंग फंड' },
  { icon: Factory, name: 'Sugar Factory', nameHi: 'चीनी सहकारी', desc: 'Cane procurement, sugar/molasses', descHi: 'गन्ना खरीद, चीनी/शीरा' },
  { icon: Hammer, name: 'Labour Society', nameHi: 'श्रमिक समिति', desc: 'Contract work, wages', descHi: 'ठेका काम, मज़दूरी' },
  { icon: Building2, name: 'Other', nameHi: 'अन्य समिति', desc: 'Fisheries, weavers, multipurpose', descHi: 'मत्स्य, बुनकर, बहुउद्देशीय' },
];

const STATS = [
  { value: '8', label: 'Society Types', labelHi: 'समिति प्रकार' },
  { value: '36', label: 'States & UTs', labelHi: 'राज्य/केंद्रशासित' },
  { value: '150+', label: 'Account Heads', labelHi: 'लेजर हेड' },
  { value: '₹2,999', label: 'Starter / year + GST', labelHi: 'से शुरू (+ GST)' },
];

const TRUST = [
  { e: '🏛️', hi: 'सहकारी-विशेष', en: 'Cooperative-specific', enSub: 'Built for cooperatives' },
  { e: '💳', hi: '₹2,999/year + GST से', en: 'From ₹2,999/year + GST', enSub: 'Transparent pricing' },
  { e: '🔒', hi: 'आपका डेटा सुरक्षित', en: 'Your data is safe', enSub: 'Your data, exportable' },
  { e: '🇮🇳', hi: 'हिंदी + English', en: 'Hindi + English', enSub: '36 states' },
];

const TOUR = [
  { shot: 'voucher.png', title: 'आसान वाउचर एंट्री', titleEn: 'Easy voucher entry', desc: 'रसीद, भुगतान, जर्नल, कोंट्रा — एक-क्लिक टेम्पलेट; Dr=Cr अपने-आप जाँच।', descEn: 'Receipt, payment, journal, contra — one-click templates; Dr = Cr checked automatically.' },
  { shot: 'trial-balance.png', title: 'एक-क्लिक ट्रायल बैलेंस व रिपोर्ट', titleEn: 'One-click Trial Balance & reports', desc: 'ट्रायल बैलेंस, बैलेंस शीट, आमदनी-खर्च — RCS दो-खंड प्रारूप में, सीधे PDF।', descEn: 'Trial Balance, Balance Sheet, Income & Expenditure — in the RCS two-section format, straight to PDF.' },
  { shot: 'member-register.png', title: 'सदस्य, शेयर व ऋण रजिस्टर', titleEn: 'Member, share & loan registers', desc: 'शेयर रजिस्टर, ऋण रजिस्टर, लाभ का बँटवारा — सहकारी नियमानुसार।', descEn: 'Share register, loan register, profit distribution — as per cooperative rules.' },
  { shot: 'certificate.png', title: 'ऑडिट प्रमाणपत्र व अनुपालन', titleEn: 'Audit certificate & compliance', desc: 'रिज़र्व फंड विनियोजन (आपके राज्य अधिनियम/उपनियम अनुसार %), FY-लॉक, ऑडिट प्रमाणपत्र — ऑडिट की तैयारी।', descEn: 'Reserve Fund appropriation (% as per your state Act / bye-laws), FY lock, audit certificate — ready for audit.' },
];

/* Competitor cells carry ONLY what the vendor's own site states (checked on COMPARE_DATE,
   sources in COMPARE_SOURCES). NV = not verified from vendor docs — it does NOT mean
   "not available". Re-verify every cell before changing it; never use blanket negatives. */
const NV = 'nv' as const;
const COMPARE_DATE = { hi: '2 अक्टूबर 2026', en: '2 Oct 2026' };
type CompareCell = boolean | typeof NV | Txt;
const TALLY_ROWS: { f: Txt; tally: CompareCell; zoho: CompareCell; sl: CompareCell }[] = [
  {
    f: { hi: 'मूल्य', en: 'Price' },
    tally: { hi: 'Silver: ₹22,500 + GST (lifetime) या ₹8,100 + GST/वर्ष (rental)', en: 'Silver: ₹22,500 + GST (lifetime) or ₹8,100 + GST/year (rental)' },
    zoho: { hi: 'Free plan (revenue ≤ ₹25 लाख); paid ₹749/माह से (annual)', en: 'Free plan (revenue ≤ ₹25 lakh); paid from ₹749/month (annual)' },
    sl: { hi: '₹2,999/year + GST से', en: 'From ₹2,999/year + GST' },
  },
  { f: 'GST e-Invoice (IRN)', tally: true, zoho: { hi: 'Standard plan से', en: 'From Standard plan' }, sl: { hi: 'नहीं', en: 'Not supported' } },
  { f: 'e-Way Bill', tally: true, zoho: NV, sl: { hi: 'JSON बनता है (NIC portal पर upload)', en: 'Generates JSON (you upload on the NIC portal)' } },
  { f: { hi: 'RCS दो-खंड ट्रायल बैलेंस / बैलेंस शीट', en: 'RCS two-section Trial Balance / Balance Sheet' }, tally: NV, zoho: NV, sl: true },
  { f: { hi: 'सदस्य शेयर/ऋण रजिस्टर, आरक्षित निधि विनियोजन', en: 'Member share/loan register, reserve-fund appropriation' }, tally: NV, zoho: NV, sl: true },
  { f: { hi: 'हिंदी इंटरफ़ेस', en: 'Hindi interface' }, tally: NV, zoho: NV, sl: true },
  { f: { hi: 'मुफ़्त कोर्स + प्रमाणपत्र', en: 'Free learning course + certificate' }, tally: NV, zoho: NV, sl: true },
];
const COMPARE_SOURCES = [
  { label: 'TallyPrime — Buy Silver & Gold', href: 'https://tallysolutions.com/buy-tally/' },
  { label: 'Zoho Books India — Pricing', href: 'https://www.zoho.com/in/books/pricing/' },
];

const SECURITY = [
  { icon: Lock, title: 'सुरक्षित व अलग डेटा', titleEn: 'Encrypted & isolated', desc: 'हर समिति का डेटा Row-Level Security (RLS) से अलग; Supabase के अनुसार डेटा AES-256 (at rest) व TLS (in transit) से एन्क्रिप्ट।', descEn: 'Each society\'s data is kept separate with Row-Level Security (RLS); per Supabase, data is encrypted with AES-256 (at rest) and TLS (in transit).' },
  { icon: Database, title: 'स्वतः बैकअप', titleEn: 'Automatic backups', desc: 'हर हफ़्ते अपने-आप बैकअप; जब चाहें PDF/Excel में पूरा डेटा निर्यात करें।', descEn: 'Automatic weekly backups; export all your data to PDF/Excel whenever you want.' },
  { icon: RefreshCw, title: 'आपका डेटा, आपका अधिकार', titleEn: 'Your data, your control', desc: 'कभी भी सब कुछ डाउनलोड करें — कोई लॉक-इन नहीं, डेटा कभी बेचा नहीं जाता।', descEn: 'Download everything at any time — no lock-in, and your data is never sold.' },
  { icon: Shield, title: 'पूरा ऑडिट-ट्रेल', titleEn: 'Full audit trail', desc: 'हर एंट्री किसने/कब बनाई-बदली; रद्द भी कारण सहित — ऑडिट में पारदर्शी।', descEn: 'Who created or changed each entry, and when; cancellations carry a reason — transparent for audit.' },
];

/* Add real, consented quotes here to activate the testimonials section.
   Shape: { quoteHi, quoteEn, name, role, place } */
const TESTIMONIALS: { quoteHi: string; quoteEn: string; name: string; role: string; place: string }[] = [];

/* ─── Screenshot with graceful fallback: shows the real /guide-shots image when
   present, otherwise renders the supplied fallback (mock UI / placeholder). ─── */
const Figure: React.FC<{ file: string; alt: string; fallback: React.ReactNode; priority?: boolean }> = ({ file, alt, fallback, priority }) => {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={`/guide-shots/${file}`}
      alt={alt}
      // GOS-21: the hero screenshot is the LCP element — load it eagerly at high
      // priority; every other shot stays lazy. NOTE: React 18 only passes the
      // lowercase `fetchpriority` attribute through (camelCase lands in React 19).
      loading={priority ? 'eager' : 'lazy'}
      {...(priority ? ({ fetchpriority: 'high' } as React.ImgHTMLAttributes<HTMLImageElement>) : {})}
      onError={() => setFailed(true)}
      className="rounded-xl border shadow-md w-full max-w-full h-auto ring-1 ring-black/5"
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
const MockDashboard: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  return (
    <div className="rounded-xl border bg-white shadow-2xl overflow-hidden ring-1 ring-black/5">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b bg-muted/40">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-[11px] text-muted-foreground">sahakarlekha.com · {L('डैशबोर्ड', 'Dashboard')}</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        {[[L('नकद', 'Cash'), '₹ 4,09,000'], [L('सदस्य', 'Members'), '112'], [L('लाभ', 'Surplus'), '₹ 11,000']].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-primary/5 p-3">
            <p className="text-[10px] text-muted-foreground">{k}</p>
            <p className="text-sm font-bold text-primary mt-1">{v}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <div className="rounded-lg border p-3">
          <p className="text-[11px] font-semibold text-foreground mb-2">{L('मासिक बिक्री', 'Monthly Sales')}</p>
          <div className="flex items-end gap-1.5 h-20">
            {[40, 62, 48, 80, 55, 92, 70].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Yes: React.FC<{ lang: Lang }> = ({ lang }) => (
  <>
    <CheckCircle2 className="h-5 w-5 text-success mx-auto" aria-hidden="true" />
    <span className="sr-only">{lang === 'hi' ? 'समर्थित' : 'Supported'}</span>
  </>
);
const No: React.FC<{ lang: Lang }> = ({ lang }) => (
  <>
    <XCircle className="h-5 w-5 text-muted-foreground/50 mx-auto" aria-hidden="true" />
    <span className="sr-only">{lang === 'hi' ? 'समर्थित नहीं' : 'Not supported'}</span>
  </>
);
const cell = (v: CompareCell, lang: Lang) =>
  v === true ? <Yes lang={lang} /> : v === false ? <No lang={lang} /> : v === 'nv'
    ? <span className="text-xs text-muted-foreground italic">{lang === 'hi' ? 'सत्यापित नहीं' : 'not verified'}</span>
    : <span className="text-xs text-muted-foreground">{tx(v, lang)}</span>;

const LandingPage: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  return (
    <PublicLayout>
      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left min-w-0">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Sparkles className="h-3.5 w-3.5" /> {L('सहकारी समितियों के लिए बना लेखा प्लेटफ़ॉर्म', 'Cooperative-first Accounting Platform')}
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
              {language === 'hi' ? (
                <>सहकारी समिति का <span className="text-primary">Accounting, Compliance और Control</span> — एक ही जगह।</>
              ) : (
                <>Your cooperative society&apos;s <span className="text-primary">accounting, compliance and control</span> — all in one place.</>
              )}
            </h1>
            <p className="mt-4 text-base lg:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              {L(
                'PACS, dairy, marketing, consumer और अन्य cooperative societies के लिए बनाया गया — जहाँ vouchers से लेकर financial statements, GST/TDS और audit-ready reports तक एक connected system में रहते हैं।',
                'Built for PACS, dairy, marketing, consumer and other cooperative societies — vouchers, financial statements, GST/TDS and audit-ready reports, all in one connected system.',
              )}
            </p>
            <p className="mt-3 text-sm text-foreground/80 max-w-xl mx-auto lg:mx-0">
              {L(
                'Professional cooperative accounting ₹2,999/year + GST से। Team व operations बढ़ें तो Plus या Pro के साथ आगे बढ़ें।',
                'Professional cooperative accounting from ₹2,999/year + GST. As your team and operations grow, move up to Plus or Pro.',
              )}
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link to="/register">
                <Button size="lg" className="gap-2 text-base px-8 w-full sm:w-auto">
                  {L('शुरू करें', 'Get Started')} <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#demo">
                <Button size="lg" variant="outline" className="gap-2 text-base px-6 w-full sm:w-auto">
                  <Play className="h-4 w-4" /> {L('देखें कैसे काम करता है', 'See how it works')}
                </Button>
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground text-center lg:text-left">
              {L(
                '✓ Unlimited Vouchers · ✓ Unlimited Members · ✓ Data Export Anytime · ✓ ₹2,999/year + GST से',
                '✓ Unlimited Vouchers · ✓ Unlimited Members · ✓ Data Export Anytime · ✓ From ₹2,999/year + GST',
              )}
            </p>
            {/* Ask entry — grounded answers from help/cookbook/guide, no signup needed */}
            <Link to="/ask" className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors max-w-xl mx-auto lg:mx-0">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{L('कोई सवाल? पूछें — "member kaise jode", "GST जमा की एंट्री"…', 'Have a question? Ask — "how to add a member", "entry for GST payment"…')}</span>
            </Link>
          </div>

          <div className="relative min-w-0">
            <Figure file="hero-dashboard.webp" alt={L('सहकार लेखा डैशबोर्ड', 'SahakarLekha dashboard')} fallback={<MockDashboard />} priority />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-3xl mx-auto px-4">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground">{L(s.labelHi, s.label)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── TRUST BAR ───────── */}
      <section className="py-6 bg-white border-y">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
          {TRUST.map(t => (
            <div key={t.e} className="flex flex-col items-center">
              <span className="text-xl">{t.e}</span>
              <span className="font-semibold text-foreground mt-1">{L(t.hi, t.en)}</span>
              {language === 'en' && <span className="text-xs text-muted-foreground">{t.enSub}</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ───────── FEATURES ───────── */}
      <section className="py-16 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">{L('सम्पूर्ण लेखा प्रणाली', 'Complete Accounting System')}</h2>
          <p className="mt-2 text-center text-muted-foreground">{L('Accounting → Compliance → Control — एक connected system', 'Accounting → Compliance → Control — one connected system')}</p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <Card key={f.title} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <f.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{L(f.titleHi, f.title)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{L(f.descHi, f.desc)}</p>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">{L('8 प्रकार की समितियों के लिए', 'For All Cooperative Types')}</h2>
          <p className="mt-2 text-center text-muted-foreground">{L('समिति का प्रकार चुनें → खाता-चार्ट ऑटो-लोड → तुरंत शुरू करें', 'Pick your society type → chart of accounts loads automatically → start right away')}</p>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            {SOCIETY_TYPES.map(s => (
              <Card key={s.name} className="hover:shadow-md transition-shadow text-center">
                <CardContent className="pt-6 pb-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <s.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{L(s.nameHi, s.name)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{L(s.descHi, s.desc)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── DEMO ───────── */}
      <section className="py-16 bg-white" id="demo">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{L('1 मिनट में देखें यह कैसे काम करता है', 'See how it works in a minute')}</h2>
          <p className="mt-2 text-muted-foreground">{L('एक मिनट के डेमो में देखें, सहकार लेखा में रोज़ का हिसाब कैसे चलता है।', 'A one-minute demo of how day-to-day accounting runs in SahakarLekha.')}</p>
          <div className="mt-8 rounded-xl overflow-hidden border shadow-lg bg-muted/30">
            {DEMO_VIDEO_ID ? (
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  // privacy-enhanced embed: no YouTube cookies until the visitor plays it
                  src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0`}
                  loading="lazy"
                  // YouTube needs the embedding origin (error 153 without it) — set it explicitly
                  referrerPolicy="strict-origin-when-cross-origin"
                  title={L('सहकार लेखा डेमो', 'SahakarLekha demo')}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="p-6"><MockDashboard /></div>
            )}
          </div>
          <div className="mt-6">
            <Button variant="outline" className="gap-2" onClick={handleSampleReport}>
              <Download className="h-4 w-4" /> {L('नमूना रिपोर्ट PDF डाउनलोड करें', 'Download sample report PDF')}
            </Button>
          </div>
        </div>
      </section>

      {/* ───────── PRODUCT TOUR ───────── */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">{L('अंदर एक नज़र', 'A look inside')}</h2>
          {TOUR.map((t, i) => (
            <div key={t.shot} className={`grid md:grid-cols-2 gap-8 items-center ${i % 2 ? 'md:[direction:rtl]' : ''}`}>
              <div className="[direction:ltr]">
                <h3 className="text-xl font-bold text-foreground">{L(t.title, t.titleEn)}</h3>
                <p className="mt-2 text-muted-foreground">{L(t.desc, t.descEn)}</p>
              </div>
              <div className="[direction:ltr]">
                <Figure file={t.shot} alt={L(t.title, t.titleEn)} fallback={<ShotPlaceholder label={L(t.title, t.titleEn)} />} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── TESTIMONIALS (renders when real quotes are added) ───────── */}
      {TESTIMONIALS.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">{L('समितियाँ क्या कहती हैं', 'What societies say')}</h2>
            <div className="mt-10 grid md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <Card key={t.name}><CardContent className="pt-6">
                  <Quote className="h-7 w-7 text-primary/30" />
                  <p className="mt-2 text-sm text-foreground">{L(t.quoteHi, t.quoteEn)}</p>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">{L('Tally / Zoho बनाम SahakarLekha', 'Tally / Zoho vs SahakarLekha')}</h2>
          <p className="mt-2 text-center text-muted-foreground">{L('सहकारी समिति के लिए जो ज़रूरी है, वही यहाँ बना-बनाया है।', 'What a cooperative society needs comes built in here.')}</p>
          <div className="mt-8 overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {L(
                  `TallyPrime Silver, Zoho Books (India) और SahakarLekha की तुलना — ${COMPARE_DATE.hi}`,
                  `Comparison of TallyPrime Silver, Zoho Books (India) and SahakarLekha — ${COMPARE_DATE.en}`,
                )}
              </caption>
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="text-left p-3 font-semibold">{L('सुविधा', 'Feature')}</th>
                  <th scope="col" className="p-3 font-semibold text-center w-28">TallyPrime (Silver)</th>
                  <th scope="col" className="p-3 font-semibold text-center w-28">Zoho Books (India)</th>
                  <th scope="col" className="p-3 font-semibold text-center w-28 text-primary">SahakarLekha</th>
                </tr>
              </thead>
              <tbody>
                {TALLY_ROWS.map((r) => (
                  <tr key={tx(r.f, 'en')} className="border-t even:bg-muted/20">
                    <td className="p-3">{tx(r.f, language)}</td>
                    <td className="p-3 text-center">{cell(r.tally, language)}</td>
                    <td className="p-3 text-center">{cell(r.zoho, language)}</td>
                    <td className="p-3 text-center bg-primary/5 font-medium">{cell(r.sl, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {language === 'hi'
              ? <>तुलना {COMPARE_DATE.hi} को vendors की official websites से — "सत्यापित नहीं" का मतलब है कि vendor के दस्तावेज़ में हमें इसकी पुष्टि नहीं मिली, यह नहीं कि सुविधा उपलब्ध नहीं है। मूल्य बदल सकते हैं। स्रोत:{' '}</>
              : <>Compared on {COMPARE_DATE.en} using vendors&apos; official websites; &quot;not verified&quot; means we could not confirm it in vendor documentation, not that it is unavailable. Prices may change. Sources:{' '}</>}
            {COMPARE_SOURCES.map((s, i) => (
              <React.Fragment key={s.href}>
                {i > 0 && ' · '}
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{s.label}</a>
              </React.Fragment>
            ))}
          </p>
        </div>
      </section>

      {/* ───────── SECURITY ───────── */}
      <section className="py-16 bg-muted/30" id="security">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">{L('आपका डेटा, पूरी तरह सुरक्षित', 'Your data, fully secure')}</h2>
          <p className="mt-2 text-center text-muted-foreground">{L('सदस्य-डेटा व खातों की सुरक्षा हमारी पहली प्राथमिकता है।', 'Keeping member data and accounts safe is our first priority.')}</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SECURITY.map(s => (
              <Card key={s.titleEn}><CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{L(s.title, s.titleEn)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{L(s.desc, s.descEn)}</p>
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
                  <GraduationCap className="h-4 w-4" /> {L('मुफ्त लर्निंग एकेडमी', 'Free Learning Academy')}
                </span>
                <h2 className="mt-2 text-2xl font-bold text-foreground">{L('सहकारी लेखांकन — 35 अध्याय का मुफ्त कोर्स + प्रमाणपत्र', 'Cooperative accounting — free 35-chapter course + certificate')}</h2>
                <p className="mt-2 text-muted-foreground">
                  {L(
                    'नींव से ऑडिट तक — सरल हिंदी व English में। क्विज़ हल करें, सत्यापन-योग्य प्रमाणपत्र पाएँ। बिना लॉगिन, बिल्कुल मुफ्त।',
                    'From the basics to audit — in simple Hindi and English. Solve the quizzes and earn a verifiable certificate. No login, completely free.',
                  )}
                </p>
              </div>
              <Link to="/guide" className="shrink-0">
                <Button size="lg" className="gap-2 w-full">{L('कोर्स शुरू करें', 'Start the course')} <ArrowRight className="h-5 w-5" /></Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ───────── AUDIT / COMPLIANCE ───────── */}
      <section className="py-16 bg-muted/30" id="compliance">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">{L('अनुपालन की तैयारी', 'Compliance support')}</h2>
          <p className="mt-2 text-center text-muted-foreground">
            {L(
              'पूरे वर्ष books व्यवस्थित रखें — ताकि audit के समय हफ़्तों का काम दिनों में सिमट सके। धाराएँ व प्रारूप राज्य अनुसार अलग होते हैं — अपने ऑडिटर/RCS से मिलाएँ।',
              'Keep your books in order all year — so weeks of audit work can shrink to days. Sections and formats differ by state — check with your auditor / RCS.',
            )}
          </p>
          <div className="mt-8 space-y-3">
            {[
              { hi: 'राज्य-वार ऑडिट अनुसूचियाँ — हरियाणा, महाराष्ट्र, गुजरात, कर्नाटक, केरल, UP और अन्य (धाराएँ राज्य अधिनियम अनुसार अलग होती हैं)', en: 'State-wise audit schedules — Haryana, Maharashtra, Gujarat, Karnataka, Kerala, UP and more (sections differ by state Act)' },
              { hi: 'TDS रजिस्टर + तिमाही TDS डेटा export (पुराना Form 26Q layout) — रिटर्न आप Income Tax e-Filing पोर्टल पर भरते हैं', en: 'TDS register + quarterly TDS data export (legacy Form 26Q layout) — you file on the Income Tax e-Filing portal' },
              { hi: 'GST — GSTR-1 / GSTR-3B के आँकड़े और e-Way Bill JSON — रिटर्न आप GST / e-Way Bill पोर्टल पर भरते हैं', en: 'GST — GSTR-1 / GSTR-3B figures and e-Way Bill JSON — you file on the GST / e-Way Bill portals' },
              { hi: 'NABARD / DCCB-शैली MIS रिपोर्ट · RCS दो-खंड ट्रायल बैलेंस व बैलेंस शीट', en: 'NABARD / DCCB-style MIS report · RCS two-section Trial Balance & Balance Sheet' },
              { hi: 'वैधानिक आरक्षित निधि विनियोजन — % आपके राज्य अधिनियम / उपनियम के अनुसार तय', en: 'Statutory Reserve Fund appropriation — % set as per your state Act / bye-laws' },
            ].map(c => (
              <div key={c.en} className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm font-medium">{L(c.hi, c.en)}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <button onClick={handleSampleReport} className="text-primary text-sm font-medium inline-flex items-center gap-1.5 hover:underline">
              <Download className="h-4 w-4" /> {L('असली RCS-प्रारूप बैलेंस शीट देखें (नमूना PDF)', 'See a real RCS-format Balance Sheet (sample PDF)')}
            </button>
          </div>
        </div>
      </section>

      {/* ───────── WHY FREE / WHO WE ARE ───────── */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Heart className="h-9 w-9 text-primary mx-auto mb-3" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{L('यह किसके लिए बना है?', 'Who is it built for?')}</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            {language === 'hi' ? (
              <>
                भारत की 8 लाख से ज़्यादा सहकारी समितियाँ ग्रामीण भारत की रीढ़ हैं — पर इनके लिए कभी कोई सॉफ्टवेयर नहीं बना; सब Tally जैसे सामान्य औज़ार को ज़बरदस्ती सहकारी प्रारूप में ढालते रहे।
                <strong className="text-foreground"> SahakarLekha इसी को बदलने के लिए बना है</strong> — और इसे सहकारी समितियों के लिए किफायती रखा गया है, professional accounting ₹2,999/year + GST से।
              </>
            ) : (
              <>
                India&apos;s more than 8 lakh cooperative societies are the backbone of rural India — yet no software was ever built for them; everyone kept forcing general tools like Tally into the cooperative format.
                <strong className="text-foreground"> SahakarLekha is built to change that</strong> — purpose-built for cooperative societies and priced to be affordable: professional accounting from ₹2,999/year + GST, with Plus and Pro as you grow.
              </>
            )}
          </p>
        </div>
      </section>

      {/* ───────── PRICING TEASER ───────── */}
      <section className="py-12 bg-white border-t">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{L('आपकी ज़रूरत के हिसाब से plan', 'A plan for every need')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {L('Starter = लेखा · Plus = टीम · Pro = विस्तार · Enterprise = नेटवर्क', 'Starter = Accounting · Plus = Team · Pro = Scale · Enterprise = Network')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {L(
              'Professional accounting ₹2,999/year + GST से — team, automation या scale बढ़े तो upgrade करें।',
              'Professional accounting from ₹2,999/year + GST — upgrade as your team, automation or scale grows.',
            )}
          </p>
          <div className="mt-5">
            <Link to="/pricing">
              <Button variant="outline" className="gap-2">{L('मूल्य देखें', 'See pricing')} <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── REFERRAL ───────── */}
      <section className="py-12 bg-primary/5 border-y">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Gift className="h-8 w-8 text-primary mx-auto mb-2" />
          <h3 className="text-xl font-bold text-foreground">{L('किसी और समिति को बताएँ', 'Tell another society')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {L(
              'अपनी जान-पहचान की समिति, लेखाकार या ऑडिटर को SahakarLekha के बारे में बताएँ — मिलकर सहकारिता को डिजिटल बनाएँ।',
              'Tell a society, accountant or auditor you know about SahakarLekha — let us take cooperatives digital together.',
            )}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(L(
                'SahakarLekha — सहकारी समितियों के लिए बना accounting platform। देखें: https://sahakarlekha.com',
                'SahakarLekha — an accounting platform built for cooperative societies. Take a look: https://sahakarlekha.com',
              ))}`}
              target="_blank" rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2"><MessageCircle className="h-4 w-4" /> {L('WhatsApp पर शेयर करें', 'Share on WhatsApp')}</Button>
            </a>
          </div>
        </div>
      </section>

      {/* ───────── LEAD MAGNET ───────── */}
      <section className="py-14 bg-background">
        <div className="max-w-2xl mx-auto px-4">
          <EmailCapture />
        </div>
      </section>

      {/* ───────── TESTIMONIALS / REVIEWS ───────── */}
      <Testimonials />

      {/* ───────── LATEST FROM BLOG ───────── */}
      <section className="py-16 bg-muted/30 border-t" id="blog">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{L('ब्लॉग से नवीनतम', 'Latest from the blog')}</h2>
              <p className="mt-1 text-muted-foreground">{L('सहकारी लेखांकन, ऑडिट व अनुपालन पर आसान हिन्दी लेख।', 'Easy articles in Hindi on cooperative accounting, audit and compliance.')}</p>
            </div>
            <Link to="/blog" className="hidden sm:inline-flex items-center gap-1 text-primary font-medium hover:gap-2 transition-all whitespace-nowrap">
              {L('सभी लेख देखें', 'See all articles')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {publishedOrder().slice(0, 3).map((p) => localizePost(p, language)).map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group block h-full">
                <Card className="h-full flex flex-col transition-all hover:shadow-md hover:border-primary/40">
                  <CardContent className="p-5 flex flex-col flex-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">{post.category}</span>
                    <h3 className="font-bold text-foreground leading-snug group-hover:text-primary transition-colors">{post.shortTitle}</h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex-1">{post.excerpt}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(post.date)}</span>
                      <span>·</span>
                      <span>{readingMinutes(post.slug)} {L('मिनट पढ़ें', 'min read')}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link to="/blog" className="inline-flex items-center gap-1 text-primary font-medium">
              {L('सभी लेख देखें', 'See all articles')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── FINAL CTA ───────── */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">{L('आज ही शुरू करें', 'Get started today')}</h2>
          <p className="mt-3 text-lg text-primary-foreground/80">
            {L(
              'Professional accounting ₹2,999/year + GST से, कोई छिपा शुल्क नहीं। आपका डेटा कभी भी निर्यात करें; कोई लॉक-इन नहीं।',
              'Professional accounting from ₹2,999/year + GST, no hidden charges. Export your data any time; no lock-in.',
            )}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="gap-2 text-base px-8">
                {L('पंजीकरण', 'Register')} <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            {WHATSAPP ? (
              <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 bg-transparent text-white border-white/40 hover:bg-white/10">
                  <MessageCircle className="h-4 w-4" /> {L('WhatsApp सहायता', 'WhatsApp support')}
                </Button>
              </a>
            ) : (
              <Link to="/contact">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 bg-transparent text-white border-white/40 hover:bg-white/10">
                  <MessageCircle className="h-4 w-4" /> {L('सहायता', 'Support')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ───────── COMMUNITY ───────── (temporarily hidden per user request 2026-08-20 — flip SHOW_COMMUNITY to re-enable) */}
      {SHOW_COMMUNITY && (
      <section className="py-12 bg-muted/30 border-t">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-xl font-bold text-foreground">{L('हमारे समुदाय से जुड़ें', 'Join our community')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{L('हर नया फ़ीचर, टिप और वीडियो सबसे पहले पाएँ।', 'Updates, tips & tutorials.')}</p>
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
      )}
    </PublicLayout>
  );
};

export default LandingPage;
