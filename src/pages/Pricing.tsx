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
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
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
import { CheckCircle2, X, ArrowRight, Star, Info, Users, Plus } from 'lucide-react';

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
    priceNote: '',
    period: 'हमेशा मुफ़्त / Forever free',
    features: [
      { text: 'Double-Entry Accounting (दोहरी एंट्री)' },
      { text: 'सभी वित्तीय रिपोर्ट (TB · BS · P&L · R&P)' },
      { text: 'GST Summary + TDS Register (26Q)' },
      { text: 'Member, Share & Loan Register' },
      { text: 'PDF / Excel / CSV Export + Cloud Backup' },
      { text: '1 समिति · 1 user · 200 सदस्य तक', icon: 'info' },
      { text: 'Report watermark · Community support', icon: 'info' },
    ],
    cta: { label: 'मुफ्त में शुरू करें / Start Free', to: '/register' },
  },
  {
    id: 'plus',
    name: 'Plus / प्लस',
    tagline: 'staff वाली सक्रिय समिति / Active society with staff',
    price: '₹3,999',
    priceNote: '≈ ₹333/माह · प्रति समिति',
    period: '/ साल (per society / year)',
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
    priceNote: '≈ ₹583/माह · प्रति समिति',
    period: '/ साल (per society / year)',
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
  { feature: 'सदस्य सीमा / Member limit', free: '200', plus: 'असीमित', pro: 'असीमित' },
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

/* ────────────────────────── Helpers ────────────────────────── */

const Cell: React.FC<{ value: boolean | string }> = ({ value }) => {
  if (typeof value === 'string') {
    return <span className="text-sm font-medium">{value}</span>;
  }
  return value ? (
    <CheckCircle2 className="h-5 w-5 text-green-600 inline-block" />
  ) : (
    <X className="h-5 w-5 text-muted-foreground inline-block" />
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
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`flex flex-col relative ${
                  plan.highlight
                    ? 'border-primary border-2 shadow-lg'
                    : 'border-2 border-border shadow-sm'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap">
                    {plan.badge}
                  </span>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{plan.tagline}</p>
                  <div className="mt-4">
                    <span
                      className={`text-4xl font-extrabold ${
                        plan.highlight ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-muted-foreground text-sm ml-1">{plan.period}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                    {plan.priceNote}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  {plan.inheritNote && (
                    <p className="text-xs text-muted-foreground mb-3 font-medium">
                      {plan.inheritNote}
                    </p>
                  )}
                  <ul className="space-y-3">
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
                </CardContent>
                <CardFooter>
                  <Link to={plan.cta.to} className="w-full">
                    <Button
                      className="w-full gap-2"
                      size="lg"
                      variant={plan.highlight ? 'default' : 'outline'}
                    >
                      {plan.cta.label} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Federation + Add-ons strip */}
          <div className="grid sm:grid-cols-2 gap-4 mt-8">
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

          <p className="text-xs text-muted-foreground text-center mt-6">
            सभी दाम प्रति समिति, सालाना (अप्रैल FY renewal) · Free हमेशा मुफ़्त — 1 समिति · 1 user · 200 सदस्य तक
          </p>
        </div>
      </section>

      {/* Section 2: Feature Comparison Table */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            फीचर तुलना — Feature Comparison
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Feature</TableHead>
                      <TableHead className="text-center w-24">Free</TableHead>
                      <TableHead className="text-center w-28">Plus</TableHead>
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
                        <TableCell className="text-center">
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
        </div>
      </section>

      {/* Section 3: CTA */}
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
