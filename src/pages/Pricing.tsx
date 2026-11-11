/**
 * SahakarLekha Pricing Page — Bilingual Hindi+English
 * Public page, no auth required.
 *
 * 3-tier structure: Starter ₹2,999 / Plus ₹6,999 / Pro ₹14,999 per society, for 12 months
 * from the payment date, GST EXTRA (src/lib/plans.ts is the value source; create-order adds
 * the GST), plus a compact Enterprise/Federation section.
 *
 * EVERY CLAIM HERE MUST MATCH THE CODE (audited 2026-11-11). What the plan really changes:
 *   • login users — 1 / 6 / unlimited (subscriptions.seats_limit, any roles);
 *   • the features in src/lib/plans.ts PLAN_FEATURES — Payroll and Member Portal on Plus / Pro;
 *     Multi-Branch and multi-society consolidation on Pro (founder 2026-11-11; CapabilityGuard shows
 *     an upgrade notice, DataContext refuses the save, migration 161 guards the payroll engine).
 * Everything else — reports, export, chart of accounts, weekly backup — is open on every plan.
 * Do not list a feature as Plus/Pro-only unless PLAN_FEATURES gates it, and do not list one that is
 * not built (customer API, custom-branded reports, seat add-ons).
 * A new society gets a 30-day trial (migration 057); plans are bought in the app
 * (User Management → Razorpay), upgrades are prorated, there is no self-serve downgrade.
 *
 * SERVICES (founder 2026-11-11 — promises the founder fulfils by hand, not app features):
 *   • data-migration help — ₹4,999 + GST once; INCLUDED in Pro;
 *   • priority WhatsApp support — Pro only;
 *   • support for everyone — support@sahakarlekha.com / the contact form.
 * These are what set Pro apart from Plus besides unlimited users. Change them only with the founder.
 *
 * Layout follows the common SaaS pricing pattern: equal-height cards, tinted header
 * band, CTA aligned above the feature list, trust row, comparison table with the
 * featured column highlighted, and an FAQ.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { pricingJsonLd } from '@/lib/seo';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  X,
  ArrowRight,
  Info,
  Users,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  FileText,
  Infinity as InfinityIcon,
} from 'lucide-react';

/* ────────────────────────── Data ────────────────────────── */

type FeatureIcon = 'check' | 'info';
interface Feature {
  text: string;
  icon?: FeatureIcon; // default 'check'
}

interface Plan {
  id: string;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  period: string;
  inheritNote?: string; // "Starter का सब कुछ, और—"
  features: Feature[];
  highlight?: boolean;
  badge?: string;
  cta: { label: string; to: string };
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter / स्टार्टर',
    tagline: 'छोटी समिति, जहाँ एक व्यक्ति हिसाब रखता है / For a small society run by one person',
    price: '₹2,999',
    priceNote: '+ GST · ≈ ₹250/माह · प्रति समिति',
    period: '/ साल',
    features: [
      { text: 'पूरा Double-Entry Accounting (दोहरी एंट्री)' },
      { text: 'Ledger · Trial Balance · Balance Sheet · लाभ-हानि · प्राप्ति-भुगतान' },
      { text: 'GST + TDS सारांश · सदस्य / Share / Loan Register' },
      { text: 'अपनी ज़रूरत के खाते बनाएँ (Custom Chart of Accounts)' },
      { text: 'PDF/Excel/CSV Export · साप्ताहिक Cloud Backup' },
      { text: '1 समिति · 1 user · असीमित vouchers व सदस्य', icon: 'info' },
      { text: 'Payroll, Member Portal और शाखाएँ शामिल नहीं', icon: 'info' },
    ],
    cta: { label: '30 दिन मुफ़्त आज़माएँ / Start Free Trial', to: '/register' },
  },
  {
    id: 'plus',
    name: 'Plus / प्लस',
    tagline: 'staff के साथ चलने वाली समिति / A society with staff',
    price: '₹6,999',
    priceNote: '+ GST · ≈ ₹583/माह · प्रति समिति',
    period: '/ साल',
    highlight: true,
    badge: 'सुझाया गया / Recommended',
    inheritNote: 'Starter का सब कुछ, और— / Everything in Starter, plus:',
    features: [
      { text: '6 users — जैसे 5 staff + 1 Auditor/CA' },
      { text: 'हर user की अलग भूमिका (Role-Based Access)' },
      { text: 'Payroll — कर्मचारी, वेतन पर्ची और वेतन की entry' },
      { text: 'Member Portal — सदस्य अपना खाता खुद देखें' },
    ],
    cta: { label: '30 दिन मुफ़्त आज़माएँ / Start Free Trial', to: '/register' },
  },
  {
    id: 'pro',
    name: 'Pro / प्रो',
    tagline: 'बड़ी team वाली समिति के लिए / For a society with a large team',
    price: '₹14,999',
    priceNote: '+ GST · ≈ ₹1,250/माह · प्रति समिति',
    period: '/ साल',
    inheritNote: 'Plus का सब कुछ, और— / Everything in Plus, plus:',
    features: [
      { text: 'असीमित users — हर शाखा व विभाग के staff के लिए' },
      { text: 'Multi-Branch — शाखा-वार हिसाब और रिपोर्ट' },
      { text: 'कई समितियों की संयुक्त रिपोर्ट (Consolidation)' },
      { text: 'डेटा-migration सहायता शामिल — पुराना हिसाब हम डालेंगे (₹4,999 + GST की बचत)' },
      { text: 'Priority WhatsApp support — आपके सवाल का जवाब सबसे पहले' },
    ],
    cta: { label: '30 दिन मुफ़्त आज़माएँ / Start Free Trial', to: '/register' },
  },
];

interface ComparisonRow {
  feature: string;
  starter: boolean | string;
  plus: boolean | string;
  pro: boolean | string;
}

// Rows from Payroll down differ by plan: the app gates them (PLAN_FEATURES, seats); migration help and
// support are the founder's services (see the header). The rows above are the same on every plan.
const COMPARISON: ComparisonRow[] = [
  { feature: 'Double-Entry Accounting + सभी रिपोर्ट', starter: true, plus: true, pro: true },
  { feature: 'GST · TDS · Audit Certificate', starter: true, plus: true, pro: true },
  { feature: 'असीमित Vouchers व सदस्य', starter: true, plus: true, pro: true },
  { feature: 'Export (PDF/Excel/CSV) + साप्ताहिक Cloud Backup', starter: true, plus: true, pro: true },
  { feature: 'Custom Chart of Accounts', starter: true, plus: true, pro: true },
  { feature: 'Users (login)', starter: '1', plus: '6 (जैसे 5 staff + 1 CA)', pro: 'असीमित' },
  { feature: 'Payroll — कर्मचारी व वेतन', starter: false, plus: true, pro: true },
  { feature: 'Member Portal — सदस्य अपना खाता खुद देखें', starter: false, plus: true, pro: true },
  { feature: 'Multi-Branch — शाखा-वार हिसाब व रिपोर्ट', starter: false, plus: false, pro: true },
  { feature: 'कई समितियों की संयुक्त रिपोर्ट', starter: false, plus: false, pro: true },
  { feature: 'डेटा-migration सहायता (पुराना हिसाब हम डालें)', starter: '₹4,999 + GST', plus: '₹4,999 + GST', pro: 'शामिल' },
  { feature: 'Support', starter: 'ईमेल', plus: 'ईमेल', pro: 'Priority WhatsApp' },
];

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'क्या कोई permanent free plan है? / Is there a permanent free plan?',
    a: 'कोई स्थायी free plan नहीं है. रजिस्टर करने पर 30 दिन का मुफ़्त trial मिलता है (1 user); उसके बाद professional accounting Starter ₹2,999/साल + GST (≈ ₹250/माह) से. असीमित vouchers/सदस्य, सभी statutory रिपोर्ट (GST/TDS/audit) और export हर plan में शामिल. / There is no permanent free plan. Registering gives a 30-day free trial (1 user); after that, professional accounting starts at Starter ₹2,999/year plus GST (about ₹250/month), with unlimited vouchers/members, statutory reports and export included in every plan.',
  },
  {
    q: 'कब upgrade करूँ? / When should I upgrade?',
    a: 'हिसाब-किताब और सभी रिपोर्ट हर plan में एक जैसी हैं. एक से ज़्यादा user (staff, auditor/CA), Payroll या Member Portal चाहिए → Plus. शाखाएँ (Multi-Branch), कई समितियों की संयुक्त रिपोर्ट, 6 से ज़्यादा users, या पुराना हिसाब हमसे डलवाना और priority WhatsApp support चाहिए → Pro. / Books and all reports are the same on every plan. Need more than one user, Payroll or the Member Portal → Plus. Need branches, multi-society consolidation, more than 6 users, or want us to bring in your old books with priority WhatsApp support → Pro.',
  },
  {
    q: 'डेटा-migration सहायता क्या है? / What is data-migration help?',
    a: 'आपका पुराना हिसाब — खाते और उनके opening balance, सदस्य व उनकी share/loan बाक़ी — हमारी team app में डालकर देती है, ताकि आप पहले दिन से काम शुरू कर सकें. यह एक बार की सेवा है: Starter व Plus में ₹4,999 + GST, Pro में शामिल. इसके लिए हमसे संपर्क करें. / Our team enters your old books — accounts with their opening balances, members with their share and loan balances — so you can start on day one. It is a one-time service: ₹4,999 + GST on Starter and Plus, included in Pro. Contact us to arrange it.',
  },
  {
    q: 'भुगतान कैसे और कब होता है? / How and when do I pay?',
    a: 'हर plan एक समिति के लिए है और भुगतान की तारीख़ से 12 महीने चलता है — कोई monthly billing नहीं (per-month राशि सिर्फ़ दिखाने के लिए). Plan app के अंदर User Management से online (Razorpay) ख़रीदें; लिखे दाम पर GST अलग से जुड़ता है (भुगतान से पहले कुल रकम दिखती है) और GST Tax Invoice मिलती है. बीच में ऊँचे plan पर जाएँ तो सिर्फ़ बचे समय का अंतर लगता है. / Each plan covers one society for 12 months from the payment date; there is no monthly billing (the per-month figure is display-only). Buy online inside the app (User Management); GST is added to the listed price (the total is shown before you pay) and you get a GST tax invoice. Upgrading mid-term costs only the difference for the remaining time.',
  },
  {
    q: 'क्या मेरा डेटा सुरक्षित और मेरा रहता है? / Is my data safe and mine?',
    a: 'हाँ. हर plan में साप्ताहिक cloud backup और पूरा export (PDF/Excel/CSV) — आपका डेटा हमेशा आपका है. / Yes. Every plan includes a weekly cloud backup and full export. Your data is always yours.',
  },
  {
    q: 'Trial और paid plan की रिपोर्ट में क्या फ़र्क है? / How do trial and paid reports differ?',
    a: 'Trial में बनी PDF रिपोर्ट के नीचे "Generated free with SahakarLekha" की एक line छपती है. किसी भी paid plan (Starter, Plus, Pro) पर यह line नहीं छपती. / PDF reports made during the trial carry a "Generated free with SahakarLekha" footer line. No paid plan (Starter, Plus, Pro) prints it.',
  },
];

/* ────────────────────────── Helpers ────────────────────────── */

const Cell: React.FC<{ value: boolean | string }> = ({ value }) => {
  if (typeof value === 'string') {
    return <span className="text-xs sm:text-sm font-medium">{value}</span>;
  }
  return value ? (
    <CheckCircle2 className="h-5 w-5 text-green-600 inline-block" />
  ) : (
    <X className="h-5 w-5 text-muted-foreground/60 inline-block" />
  );
};

/* ────────────────────────── Component ────────────────────────── */

// Built once: the three public plans and their prices, the same object the prerender writes.
const PRICING_JSON_LD = pricingJsonLd();

const Pricing: React.FC = () => {
  useDocumentMeta({
    title: 'SahakarLekha Pricing — Starter, Plus & Pro Plans',
    description:
      'SahakarLekha cooperative accounting ₹2,999/साल + GST से — 30 दिन मुफ़्त trial। सभी रिपोर्ट हर plan में; staff, Payroll और Member Portal के लिए Plus; शाखाएँ, असीमित users व डेटा-migration के लिए Pro।',
    canonicalPath: '/pricing',
    jsonLd: PRICING_JSON_LD,
  });
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-primary/10 text-primary rounded-full px-4 py-1 text-sm font-medium mb-4">
            30 दिन मुफ़्त trial · सालाना billing
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            मूल्य निर्धारण — Pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            सरल शुरुआत। साफ़ क़ीमत। ज़रूरत बढ़े तो plan बढ़ाएँ।
          </p>
          <p className="mt-3 text-base text-foreground/80 max-w-2xl mx-auto">
            सहकारी समितियों के लिए professional accounting ₹2,999/साल + GST से। पहले 30 दिन मुफ़्त
            आज़माएँ, फिर users की संख्या के अनुसार Starter, Plus या Pro चुनें।
          </p>
        </div>
      </section>

      {/* Section 1: Pricing Cards */}
      <section className="pb-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch -mt-8 relative z-10">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`flex flex-col overflow-hidden ${
                  plan.highlight
                    ? 'border-primary border-2 shadow-xl lg:-translate-y-2'
                    : 'border-2 border-border shadow-sm'
                }`}
              >
                {/* Tinted header band: badge row + name + tagline + price */}
                <div
                  className={`px-6 pt-6 pb-6 text-center ${
                    plan.highlight ? 'bg-primary/10' : 'bg-muted/40'
                  }`}
                >
                  <div className="h-6 mb-2 flex items-center justify-center">
                    {plan.badge && (
                      <span className="inline-block bg-primary text-primary-foreground rounded-full px-3 py-0.5 text-xs font-medium whitespace-nowrap">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[2rem]">
                    {plan.tagline}
                  </p>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span
                      className={`text-4xl font-extrabold ${
                        plan.highlight ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                    {plan.priceNote}
                  </p>
                </div>

                {/* White body: CTA aligned first, then feature list */}
                <div className="flex flex-1 flex-col p-6">
                  <Link to={plan.cta.to} className="w-full">
                    <Button
                      className="w-full gap-2 h-auto min-h-11 whitespace-normal text-sm leading-tight py-2.5"
                      size="lg"
                      variant={plan.highlight ? 'default' : 'outline'}
                    >
                      {plan.cta.label} <ArrowRight className="h-4 w-4 shrink-0" />
                    </Button>
                  </Link>

                  {plan.inheritNote && (
                    <p className="text-xs text-muted-foreground mt-5 font-medium">
                      {plan.inheritNote}
                    </p>
                  )}
                  <ul className="space-y-3 mt-4 flex-1">
                    {plan.features.map((feat) => (
                      <li key={feat.text} className="flex items-start gap-2 text-sm">
                        {feat.icon === 'info' ? (
                          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        )}
                        <span className={feat.icon === 'info' ? 'text-muted-foreground' : ''}>
                          {feat.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-10 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> पारदर्शी कीमत · कोई छिपा शुल्क नहीं
            </span>
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" /> कभी भी upgrade — सिर्फ़ बचे समय का अंतर
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> डेटा हमेशा आपका — पूरा export
            </span>
          </div>

          {/* Enterprise / Federation — compact, NOT a fourth card */}
          <div className="mt-10 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-bold">Enterprise / Federation</h3>
                  <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                    Network
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Federations, unions, clusters व बड़े deployments के लिए — कई समितियों का
                  एक साथ setup, bulk डेटा-migration व dedicated onboarding/support. दायरा और दाम
                  बातचीत से तय होते हैं.
                </p>
                <p className="mt-2 text-sm font-medium">₹49,000/साल + GST से शुरू / From ₹49,000/year + GST</p>
              </div>
              <Link to="/contact" className="shrink-0">
                <Button size="lg" className="gap-2">
                  हमसे बात करें / Talk to SahakarLekha <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            सभी दाम प्रति समिति, भुगतान की तारीख़ से 12 महीने के लिए, GST अलग से · Plan app के अंदर
            online ख़रीदें · डेटा-migration सहायता ₹4,999 + GST एक बार (Pro में शामिल) — <Link to="/contact" className="underline">संपर्क करें</Link>
          </p>
        </div>
      </section>

      {/* Section 2: Trust — Starter is not a demo */}
      <section className="py-14 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">
            ₹2,999/साल + GST में पूरा professional accounting
          </h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-8">
            Starter कोई demo नहीं — छोटी समिति अपने पूरे साल का हिसाब इसी पर रख सकती है। Upgrade तब
            करें, जब staff, Payroll, Member Portal या शाखाओं की ज़रूरत हो।
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: FileText, t: 'असली accounting', d: 'पूरा double-entry, रिपोर्ट व audit — Starter पर' },
              { icon: InfinityIcon, t: 'कोई data सीमा नहीं', d: 'असीमित vouchers, सदस्य व FY' },
              { icon: ShieldCheck, t: 'डेटा आपका', d: 'कभी भी PDF/Excel/CSV export' },
              { icon: Users, t: 'Upgrade तब', d: 'जब staff, Payroll, Member Portal या शाखाएँ चाहिए' },
            ].map((it) => (
              <div key={it.t} className="rounded-lg bg-white border border-muted p-5">
                <it.icon className="h-6 w-6 text-primary mb-3" />
                <p className="font-medium text-sm mb-1">{it.t}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{it.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Feature Comparison Table */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            फीचर तुलना — Feature Comparison
          </h2>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[240px]">Feature</TableHead>
                      <TableHead className="text-center w-24">Starter</TableHead>
                      <TableHead className="text-center w-28 bg-primary/5 text-primary font-semibold">
                        Plus
                      </TableHead>
                      <TableHead className="text-center w-24">Pro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPARISON.map((row) => (
                      <TableRow key={row.feature}>
                        <TableCell className="font-medium text-sm">{row.feature}</TableCell>
                        <TableCell className="text-center">
                          <Cell value={row.starter} />
                        </TableCell>
                        <TableCell className="text-center bg-primary/5">
                          <Cell value={row.plus} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Cell value={row.pro} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Starter ₹2,999/साल + GST: 1 समिति · 1 user · असीमित vouchers व सदस्य · सभी रिपोर्ट व export
          </p>
        </div>
      </section>

      {/* Section 4: FAQ */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            सामान्य प्रश्न — Frequently Asked
          </h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <Card key={faq.q} className="border-muted">
                <CardContent className="p-5">
                  <p className="font-medium text-sm mb-2">{faq.q}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: CTA */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            आज ही शुरू करें / Get Started Today
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            30 दिन मुफ़्त आज़माएँ, फिर ₹2,999/साल + GST से — कोई छिपा शुल्क नहीं. staff, Payroll,
            Member Portal या शाखाएँ चाहिए तो Plus या Pro. / Try it free for 30 days, then from ₹2,999/year plus GST —
            no hidden charges. Choose Plus or Pro for staff, Payroll, the Member Portal or branches.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="gap-2">
                30 दिन मुफ़्त आज़माएँ / Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                सवाल है? संपर्क करें / Talk to us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Pricing;
