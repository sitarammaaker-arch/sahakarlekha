/**
 * SahakarLekha Pricing Page — Bilingual Hindi+English
 * Public page, no auth required
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
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
import { CheckCircle2, X, ArrowRight, Star } from 'lucide-react';

/* ────────────────────────── Data ────────────────────────── */

const FREE_FEATURES = [
  'Double-Entry Accounting (दोहरी प्रविष्टि)',
  'All Financial Reports (सभी वित्तीय रिपोर्ट)',
  'TDS Register & 26Q Export',
  'GST Summary (GSTR-1/3B)',
  'Member, Share & Loan Register',
  '8 Society Type Templates',
  'Hindi + English Interface',
  'PDF / Excel / CSV Export',
  'Audit Certificate & Schedules',
  'Unlimited Vouchers & Members',
  'Cloud Storage (Supabase)',
  'Bank Reconciliation',
];

const PRO_EXTRAS = [
  'Multi-Society Consolidation',
  'Priority Support (प्राथमिकता सहायता)',
  'Advanced Analytics Dashboard',
  'API Access',
  'White-Label Reports',
  'Custom COA Templates',
];

interface ComparisonRow {
  feature: string;
  free: boolean;
  pro: boolean;
}

const COMPARISON: ComparisonRow[] = [
  { feature: 'Double-Entry Accounting', free: true, pro: true },
  { feature: 'Trial Balance, BS, P&L, R&P', free: true, pro: true },
  { feature: 'Cash Book & Bank Book', free: true, pro: true },
  { feature: 'TDS Register & 26Q Export', free: true, pro: true },
  { feature: 'GST Summary', free: true, pro: true },
  { feature: 'Member & Loan Management', free: true, pro: true },
  { feature: 'PDF / Excel / CSV Export', free: true, pro: true },
  { feature: 'Audit Certificate & Schedules', free: true, pro: true },
  { feature: 'Hindi + English', free: true, pro: true },
  { feature: '8 Society Templates', free: true, pro: true },
  { feature: 'Unlimited Vouchers', free: true, pro: true },
  { feature: 'Cloud Backup', free: true, pro: true },
  { feature: 'Multi-Society Consolidation', free: false, pro: true },
  { feature: 'Priority Support', free: false, pro: true },
  { feature: 'Advanced Analytics', free: false, pro: true },
  { feature: 'API Access', free: false, pro: true },
];

/* ────────────────────────── Component ────────────────────────── */

const Pricing: React.FC = () => {
  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            मूल्य निर्धारण — Pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            सहकारी समितियों के लिए सबसे किफायती विकल्प /
            The most affordable option for cooperative societies
          </p>
        </div>
      </section>

      {/* Section 1: Pricing Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <Card className="border-primary border-2 flex flex-col">
              <CardHeader className="text-center">
                <Star className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle className="text-xl">Free Plan / मुफ्त योजना</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-extrabold text-primary">&#8377;0</span>
                  <span className="text-muted-foreground ml-1">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  हमेशा मुफ्त / Forever Free
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {FREE_FEATURES.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link to="/register" className="w-full">
                  <Button className="w-full gap-2" size="lg">
                    मुफ्त में शुरू करें / Start Free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Pro Plan */}
            <Card className="border-muted flex flex-col">
              <CardHeader className="text-center">
                <span className="inline-block bg-accent/20 text-accent rounded-full px-3 py-1 text-xs font-medium mx-auto mb-2">
                  Coming Soon / जल्द आ रहा है
                </span>
                <CardTitle className="text-xl">Pro Plan / प्रो योजना</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-extrabold text-muted-foreground">TBD</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  मूल्य जल्द घोषित होगा / Price to be announced
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                  All Free features, plus:
                </p>
                <ul className="space-y-3">
                  {FREE_FEATURES.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                  {PRO_EXTRAS.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm font-medium">
                      <Star className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" size="lg" disabled>
                  Coming Soon / जल्द आ रहा है
                </Button>
              </CardFooter>
            </Card>
          </div>
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
                      <TableHead className="min-w-[200px]">Feature</TableHead>
                      <TableHead className="text-center w-24">Free</TableHead>
                      <TableHead className="text-center w-24">Pro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPARISON.map((row) => (
                      <TableRow key={row.feature}>
                        <TableCell className="font-medium text-sm">{row.feature}</TableCell>
                        <TableCell className="text-center">
                          {row.free ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 inline-block" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground inline-block" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.pro ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 inline-block" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground inline-block" />
                          )}
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
            No credit card required. No trial period. 100% free for Indian cooperative societies.
          </p>
          <Link to="/register">
            <Button size="lg" variant="secondary" className="gap-2">
              मुफ्त में शुरू करें / Start Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Pricing;
