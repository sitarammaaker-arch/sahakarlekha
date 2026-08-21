/**
 * SahakarLekha Pricing Page — Bilingual Hindi+English
 * Public page, no auth required.
 *
 * 3-tier structure: Starter ₹1,499 / Plus ₹3,999 / Pro ₹9,999 per society / FY,
 * plus a compact Enterprise/Federation section and one-time add-ons.
 * Positioning: Starter = Accounting · Plus = Team · Pro = Scale · Enterprise = Network.
 * No permanent public free plan. Starter is full professional accounting — statutory
 * reports & export are NEVER gated, unlimited vouchers/members; its limit is team size
 * (1 society · 1 user). Billing is not yet wired, so paid CTAs route to /contact
 * (manual activation); annual FY billing only, no proration is claimed.
 *
 * Layout follows the common SaaS pricing pattern: equal-height cards, tinted header
 * band, CTA aligned above the feature list, trust row, comparison table with the
 * featured column highlighted, and an FAQ.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
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
  inheritNote?: string; // "Free का सब कुछ, और—"
  features: Feature[];
  highlight?: boolean;
  badge?: string;
  cta: { label: string; to: string };
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter / स्टार्टर',
    tagline: 'छोटी · single-user समिति के लिए / For a small, single-user society',
    price: '₹1,499',
    priceNote: '≈ ₹125/माह · प्रति समिति / FY',
    period: '/ साल',
    features: [
      { text: '1 Society · 1 User · Unlimited Vouchers & Members' },
      { text: 'Double-Entry Accounting · Ledger' },
      { text: 'Trial Balance, P&L & Balance Sheet · Receipts & Payments' },
      { text: 'GST/TDS Summaries · Member, Share & Loan Registers' },
      { text: 'PDF / Excel / CSV Export' },
      { text: 'Cloud Backup & Basic Audit Trail · self-service support', icon: 'info' },
    ],
    cta: { label: 'Starter से शुरू करें', to: '/register' },
  },
  {
    id: 'plus',
    name: 'Plus / प्लस',
    tagline: 'staff के साथ चलने वाली सक्रिय समिति / Active society with staff',
    price: '₹3,999',
    priceNote: '≈ ₹333/माह · प्रति समिति / FY',
    period: '/ साल',
    highlight: true,
    badge: 'सबसे लोकप्रिय / Most Popular',
    inheritNote: 'Starter का सब कुछ, और— / Everything in Starter, plus:',
    features: [
      { text: '5 Staff Users + 1 Auditor/CA — शामिल' },
      { text: 'Role-Based Access · staff activity controls' },
      { text: 'Payroll automation · Scheduled backup/export' },
      { text: 'Reports से basic branding हटाएँ · Priority Support' },
    ],
    cta: { label: 'Plus चुनें / Choose Plus', to: '/contact' },
  },
  {
    id: 'pro',
    name: 'Pro / प्रो',
    tagline: 'Multi-branch व advanced संचालन के लिए / For multi-branch & advanced ops',
    price: '₹9,999',
    priceNote: '≈ ₹833/माह · प्रति समिति / FY',
    period: '/ साल',
    inheritNote: 'Plus का सब कुछ, और— / Everything in Plus, plus:',
    features: [
      { text: 'Unlimited Users · Multi-Branch Accounting' },
      { text: 'Branch-wise + Consolidated (Multi-Society) reporting' },
      { text: 'Custom Chart of Accounts · API Access' },
      { text: 'Data Migration सहायता · Custom-Branded Reports · Advanced Support' },
    ],
    cta: { label: 'Pro चुनें / Choose Pro', to: '/contact' },
  },
];

interface ComparisonRow {
  feature: string;
  free: boolean | string;
  plus: boolean | string;
  pro: boolean | string;
}

const COMPARISON: ComparisonRow[] = [
  { feature: 'Double-Entry Accounting + सभी रिपोर्ट', free: true, plus: true, pro: true },
  { feature: 'GST · TDS · Audit Certificate', free: true, plus: true, pro: true },
  { feature: 'असीमित Vouchers व सदस्य', free: true, plus: true, pro: true },
  { feature: 'Export (PDF/Excel/CSV) + Cloud Backup', free: true, plus: true, pro: true },
  { feature: 'Users', free: '1', plus: '5 + 1 CA', pro: 'असीमित' },
  { feature: 'समिति / Societies', free: '1', plus: '1', pro: 'Multi' },
  { feature: 'Report branding हटता / Removed', free: false, plus: true, pro: true },
  { feature: 'Role-Based Access + staff controls', free: false, plus: true, pro: true },
  { feature: 'Payroll Automation', free: false, plus: true, pro: true },
  { feature: 'Scheduled Backup / Export', free: false, plus: true, pro: true },
  { feature: 'Priority Support', free: false, plus: true, pro: true },
  { feature: 'Multi-Branch Accounting + branch-wise reporting', free: false, plus: false, pro: true },
  { feature: 'Multi-Society Consolidation', free: false, plus: false, pro: true },
  { feature: 'Custom Chart of Accounts · API · Custom branding', free: false, plus: false, pro: true },
];

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'क्या कोई permanent free plan है? / Is there a permanent free plan?',
    a: 'कोई स्थायी सार्वजनिक free plan नहीं है — professional accounting Starter ₹1,499/वित्त वर्ष (≈ ₹125/माह) से शुरू होता है. असीमित vouchers/सदस्य, सभी statutory रिपोर्ट (GST/TDS/audit) और export हर plan में शामिल. / There is no permanent public free plan — professional accounting starts at Starter ₹1,499/FY (about ₹125/month), with unlimited vouchers/members, statutory reports and export included in every plan.',
  },
  {
    q: 'कब upgrade करूँ? / When should I upgrade?',
    a: 'जब staff के लिए कई users व role-based access चाहिए, payroll/scheduled-backup automation चाहिए → Plus. जब multi-branch, consolidation या API चाहिए → Pro. / Move to Plus when you need staff users, roles and automation; Pro when you need multi-branch, consolidation or API.',
  },
  {
    q: 'भुगतान कैसे और कब होता है? / How and when do I pay?',
    a: 'सभी plan प्रति समिति, प्रति वित्त वर्ष (अप्रैल renewal) पर हैं — कोई monthly billing नहीं (per-month राशि सिर्फ़ दिखाने के लिए). अभी plan चुनने के लिए हमसे संपर्क करें. / All plans are billed per society, per financial year (April renewal); there is no monthly billing (the per-month figure is display-only). Contact us to choose a plan.',
  },
  {
    q: 'क्या मेरा डेटा सुरक्षित और मेरा रहता है? / Is my data safe and mine?',
    a: 'हाँ. हर plan में secure cloud backup और पूरा export (PDF/Excel/CSV) — आपका डेटा हमेशा आपका है. / Yes. Every plan includes secure cloud backup and full export. Your data is always yours.',
  },
];

/* ────────────────────────── Helpers ────────────────────────── */

const Cell: React.FC<{ value: boolean | string }> = ({ value }) => {
  if (typeof value === 'string') {
    return <span className="text-sm font-medium">{value}</span>;
  }
  return value ? (
    <CheckCircle2 className="h-5 w-5 text-green-600 inline-block" />
  ) : (
    <X className="h-5 w-5 text-muted-foreground/60 inline-block" />
  );
};

/* ────────────────────────── Component ────────────────────────── */

const Pricing: React.FC = () => {
  useDocumentMeta({
    title: 'SahakarLekha Pricing — Starter, Plus & Pro Cooperative Accounting Plans',
    description:
      'SahakarLekha cooperative accounting ₹1,499/FY से शुरू करें। Staff, role-based access, payroll, multi-branch accounting और advanced operations के लिए Plus या Pro चुनें।',
    canonicalPath: '/pricing',
  });
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-primary/10 text-primary rounded-full px-4 py-1 text-sm font-medium mb-4">
            सालाना billing · अप्रैल FY renewal
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            मूल्य निर्धारण — Pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            सरल शुरुआत। साफ कीमत। जरूरत के साथ Scale करें।
          </p>
          <p className="mt-3 text-base text-foreground/80 max-w-2xl mx-auto">
            सहकारी समितियों के लिए professional accounting ₹1,499/FY से। अपनी जरूरत के अनुसार
            Starter, Plus या Pro चुनें।
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
              <RefreshCw className="h-4 w-4 text-primary" /> कभी भी upgrade / downgrade
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
                  Federations, unions, clusters व बड़े deployments के लिए — bulk society
                  deployment, central administration, organisation-wide reporting,
                  integrations/API, bulk migration, custom branding व dedicated onboarding/support.
                </p>
                <p className="mt-2 text-sm font-medium">₹49,000/साल से शुरू / Starting at ₹49,000/year</p>
              </div>
              <Link to="/contact" className="shrink-0">
                <Button size="lg" className="gap-2">
                  हमसे बात करें / Talk to SahakarLekha <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Add-ons: अतिरिक्त staff user ₹500/साल · Onboarding / डेटा-migration ₹1,999 ·
            Starter, Plus और Pro मूल्य प्रति समिति, प्रति वित्त वर्ष हैं (अप्रैल renewal)। Enterprise pricing deployment requirements के अनुसार है।
          </p>
        </div>
      </section>

      {/* Section 2: Trust — Free is not a demo */}
      <section className="py-14 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">
            ₹1,499/FY में पूरा professional accounting
          </h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-8">
            Starter एक demo नहीं — छोटी समिति अपना पूरे साल का हिसाब इसी पर रख सकती है। Upgrade तब —
            जब staff, automation या multi-branch की ज़रूरत बढ़े।
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: FileText, t: 'असली accounting', d: 'पूरा double-entry, रिपोर्ट व audit — Starter पर' },
              { icon: InfinityIcon, t: 'कोई data सीमा नहीं', d: 'असीमित vouchers, सदस्य व FY' },
              { icon: ShieldCheck, t: 'डेटा आपका', d: 'कभी भी PDF/Excel/CSV export' },
              { icon: Users, t: 'Upgrade तब', d: 'जब team, automation या branch चाहिए' },
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
                          <Cell value={row.free} />
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
            Starter ₹1,499/FY: 1 समिति · 1 user · असीमित vouchers व सदस्य · सभी रिपोर्ट व export
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
            Professional cooperative accounting ₹1,499/FY से — कोई छिपा शुल्क नहीं. Staff, automation
            या multi-branch चाहिए तो Plus या Pro. / Professional cooperative accounting from ₹1,499/FY —
            no hidden charges. Choose Plus or Pro for staff, automation or multi-branch.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="gap-2">
                शुरू करें / Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                Plus / Pro के लिए संपर्क करें / Talk to us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Pricing;
