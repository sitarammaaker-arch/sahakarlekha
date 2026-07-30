/**
 * SahakarLekha Pricing Page — Bilingual Hindi+English
 * Public page, no auth required.
 *
 * 3-tier structure (locked): Free ₹0 / Plus ₹3,999 / Pro ₹6,999 per society/year,
 * plus a Federation tier (societies' union / auditors) and one-time add-ons.
 * Free stays genuinely usable — statutory reports & export are NEVER gated; the
 * Free limit is on SIZE (1 society · 1 user · 200 members) + convenience, not on
 * the core accounting job. Billing is not yet wired, so paid CTAs route to /contact
 * (offline/manual activation) rather than a checkout that does not exist.
 *
 * Layout follows the common SaaS pricing pattern: equal-height cards, tinted header
 * band, CTA aligned above the feature list, reassurance row, comparison table with
 * the featured column highlighted, and an FAQ.
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
  Plus,
  ShieldCheck,
  CreditCard,
  RefreshCw,
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
    id: 'free',
    name: 'Free / मुफ्त',
    tagline: 'छोटी समिति के लिए / For small societies',
    price: '₹0',
    priceNote: 'हमेशा मुफ़्त / Forever free',
    period: '',
    features: [
      { text: 'Double-Entry Accounting (दोहरी एंट्री)' },
      { text: 'सभी वित्तीय रिपोर्ट (TB · BS · P&L · R&P)' },
      { text: 'GST Summary + TDS Register (26Q)' },
      { text: 'Member, Share & Loan Register' },
      { text: 'PDF / Excel / CSV Export + Cloud Backup' },
      { text: '1 समिति · 1 user · असीमित सदस्य', icon: 'info' },
      { text: 'Report watermark · Community support', icon: 'info' },
    ],
    cta: { label: 'मुफ्त में शुरू करें / Start Free', to: '/register' },
  },
  {
    id: 'plus',
    name: 'Plus / प्लस',
    tagline: 'staff वाली सक्रिय समिति / Active society with staff',
    price: '₹3,999',
    priceNote: '≈ ₹333/माह · प्रति समिति / साल',
    period: '/ साल',
    highlight: true,
    badge: 'सबसे लोकप्रिय / Most popular',
    inheritNote: 'Free का सब कुछ, और— / Everything in Free, plus:',
    features: [
      { text: 'असीमित सदस्य · 5 users (+ऑडिटर मुफ़्त)' },
      { text: 'पूरा 17-role RBAC · MFA' },
      { text: 'Auto-Backup Schedule · Payroll Automation' },
      { text: 'Watermark हटता · Priority Support' },
    ],
    cta: { label: 'अपग्रेड — संपर्क करें / Contact to upgrade', to: '/contact' },
  },
  {
    id: 'pro',
    name: 'Pro / प्रो',
    tagline: 'बड़ी / multi-branch समिति / Large or multi-branch',
    price: '₹6,999',
    priceNote: '≈ ₹583/माह · प्रति समिति / साल',
    period: '/ साल',
    inheritNote: 'Plus का सब कुछ, और— / Everything in Plus, plus:',
    features: [
      { text: 'Multi-Branch Accounting · असीमित users' },
      { text: 'Multi-Society Consolidation' },
      { text: 'White-Label Reports · API Access' },
      { text: 'Custom COA · डेटा-migration सहायता' },
    ],
    cta: { label: 'अपग्रेड — संपर्क करें / Contact to upgrade', to: '/contact' },
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
  { feature: 'Export (PDF/Excel/CSV) + Backup', free: true, plus: true, pro: true },
  { feature: 'सदस्य सीमा / Member limit', free: 'असीमित', plus: 'असीमित', pro: 'असीमित' },
  { feature: 'Users', free: '1', plus: '5 +ऑडिटर', pro: 'असीमित' },
  { feature: 'समिति / Societies', free: '1', plus: '1', pro: 'Multi' },
  { feature: 'Watermark हटता / Removed', free: false, plus: true, pro: true },
  { feature: '17-role RBAC · MFA', free: false, plus: true, pro: true },
  { feature: 'Payroll Automation', free: false, plus: true, pro: true },
  { feature: 'Auto-Backup Schedule', free: false, plus: true, pro: true },
  { feature: 'Priority Support', free: false, plus: true, pro: true },
  { feature: 'Multi-Branch Accounting', free: false, plus: false, pro: true },
  { feature: 'Multi-Society Consolidation', free: false, plus: false, pro: true },
  { feature: 'White-Label Reports · API', free: false, plus: false, pro: true },
];

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'क्या Free सच में हमेशा मुफ़्त है? / Is Free really forever?',
    a: 'हाँ. छोटी समिति (1 समिति · 1 user · असीमित सदस्य) के लिए Free हमेशा मुफ़्त है — बिना क्रेडिट कार्ड. सभी statutory रिपोर्ट (GST/TDS/audit) और export कभी बंद नहीं होते. / Yes — free forever for small societies, no credit card. Statutory reports and export are never locked.',
  },
  {
    q: 'भुगतान कैसे और कब होता है? / How and when do I pay?',
    a: 'Plus व Pro सालाना (अप्रैल FY renewal) प्रति समिति हैं. अभी upgrade के लिए हमसे संपर्क करें — हम activation कर देते हैं. / Plus and Pro are billed annually per society, aligned to the April financial year. Contact us to upgrade for now.',
  },
  {
    q: 'क्या मेरा डेटा सुरक्षित रहता है? / Is my data safe?',
    a: 'हाँ. हर plan में cloud backup और पूरा data export (PDF/Excel/CSV) मिलता है — आपका डेटा हमेशा आपका है. / Yes. Every plan includes cloud backup and full data export. Your data is always yours.',
  },
  {
    q: 'क्या मैं बाद में upgrade/downgrade कर सकता/सकती हूँ? / Can I change plans later?',
    a: 'हाँ, कभी भी. समिति बढ़ने पर Plus या Pro लें; ज़रूरत बदले तो घटा भी सकते हैं. / Yes, anytime. Move up as your society grows, or down if needs change.',
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
    title: 'मूल्य — Free, Plus, Pro | सहकार लेखा Pricing',
    description:
      'सहकार लेखा: छोटी समितियों के लिए हमेशा मुफ़्त. Plus ₹3,999 और Pro ₹6,999/साल में advanced सुविधाएँ (RBAC, multi-branch, consolidation). Free forever for small cooperative societies; affordable Plus & Pro for growing ones.',
    canonicalPath: '/pricing',
  });
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-primary/10 text-primary rounded-full px-4 py-1 text-sm font-medium mb-4">
            सालाना billing · अप्रैल FY renewal
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            मूल्य निर्धारण — Pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            छोटी समिति के लिए हमेशा मुफ़्त — बढ़ती समिति के लिए किफायती Plus व Pro /
            Free forever for small societies; affordable Plus &amp; Pro as you grow
          </p>
        </div>
      </section>

      {/* Section 1: Pricing Cards */}
      <section className="pb-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch -mt-8 relative z-10">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`flex flex-col overflow-hidden ${
                  plan.highlight
                    ? 'border-primary border-2 shadow-xl md:-translate-y-2'
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
                      className="w-full gap-2"
                      size="lg"
                      variant={plan.highlight ? 'default' : 'outline'}
                    >
                      {plan.cta.label} <ArrowRight className="h-4 w-4" />
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

          {/* Reassurance row */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-10 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Free के लिए बिना क्रेडिट कार्ड
            </span>
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" /> कभी भी upgrade / downgrade
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> डेटा हमेशा आपका — पूरा export
            </span>
          </div>

          {/* Federation + Add-ons strip */}
          <div className="grid sm:grid-cols-2 gap-4 mt-10">
            <div className="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-4">
              <Users className="h-6 w-6 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Federation — संघ / ऑडिटर</p>
                <p className="text-xs text-muted-foreground">
                  ₹25,000+/साल या ₹999/समिति · कई समितियाँ एक dashboard से
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-4">
              <Plus className="h-6 w-6 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Add-ons</p>
                <p className="text-xs text-muted-foreground">
                  अतिरिक्त user ₹500/साल · Onboarding / डेटा-migration ₹1,999
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Feature Comparison Table */}
      <section className="py-16 bg-muted/30">
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
                      <TableHead className="min-w-[220px]">Feature</TableHead>
                      <TableHead className="text-center w-24">Free</TableHead>
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
            सभी दाम प्रति समिति, सालाना (अप्रैल FY renewal) · Free हमेशा मुफ़्त — 1 समिति · 1 user · असीमित सदस्य
          </p>
        </div>
      </section>

      {/* Section 3: FAQ */}
      <section className="py-16 bg-white">
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

      {/* Section 4: CTA */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            आज ही मुफ्त में शुरू करें / Start Free Today
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            छोटी समिति के लिए बिना क्रेडिट कार्ड, हमेशा मुफ़्त. बड़ी ज़रूरत पर Plus व Pro. /
            No credit card for small societies — free forever. Upgrade to Plus or Pro as you grow.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="gap-2">
                मुफ्त में शुरू करें / Start Free <ArrowRight className="h-4 w-4" />
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
