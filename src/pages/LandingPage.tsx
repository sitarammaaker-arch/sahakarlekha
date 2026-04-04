/**
 * SahakarLekha Public Landing Page — SEO optimized, no auth required
 * Bilingual Hindi+English marketing page for cooperative societies
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  BookOpen, Shield, Users, BarChart3, FileText, Globe,
  CheckCircle2, ArrowRight, Building2, Milk, Home, Factory,
  ShoppingCart, Hammer, Wheat, Landmark,
} from 'lucide-react';

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
  { value: '36', label: 'States & UTs', labelHi: 'राज्य एवं केंद्रशासित' },
  { value: '150+', label: 'Account Heads', labelHi: 'खाता शीर्ष' },
  { value: '100%', label: 'Free', labelHi: 'मुफ्त' },
];

const COMPLIANCE = [
  'Haryana Co-op Societies Act 1984',
  'Maharashtra Co-op Societies Act 1960',
  'Multi-State Co-op Societies Act 2002',
  'Income Tax Act — TDS Sec 192/194A/194C/194H/194J/194Q',
  'GST Act — GSTR-1, GSTR-3B, e-Invoice, e-Way Bill',
  'NABARD / DCCB Reporting Compliance',
  'RCS Audit Format (State-wise)',
  'ICAI Guidance Note on Cooperative Societies',
];

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">स</div>
            <div>
              <h1 className="font-bold text-lg text-foreground leading-tight">SahakarLekha</h1>
              <p className="text-xs text-muted-foreground">सहकारलेखा</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="outline" size="sm">Login</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="gap-1">
                <span className="hidden lg:inline">Free Registration</span>
                <span className="lg:hidden">Register</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            भारत की सहकारी समितियों का<br />
            <span className="text-primary">अपना एकाउंटिंग सॉफ्टवेयर</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base lg:text-xl text-muted-foreground max-w-2xl lg:max-w-3xl mx-auto px-4">
            India's ONLY cooperative-specific accounting platform.
            8 society types, 36 states, Hindi+English, TDS/GST/Audit — सब मुफ्त।
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="gap-2 text-base px-8">
                मुफ्त में शुरू करें / Start Free <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-base px-8">
                Login करें
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-2xl lg:max-w-3xl mx-auto">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-extrabold text-primary">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.labelHi}<br />{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">
            सम्पूर्ण लेखा प्रणाली — Complete Accounting System
          </h2>
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

      {/* Society Types */}
      <section className="py-16 bg-muted/30" id="types">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">
            8 प्रकार की समितियों के लिए — For All Cooperative Types
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            समिति का प्रकार चुनें → COA टेम्पलेट ऑटो-लोड → तुरंत शुरू करें
          </p>

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

      {/* Compliance */}
      <section className="py-16 bg-white" id="compliance">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground">
            कानूनी अनुपालन — Legal Compliance Built-in
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            Tally aur Zoho mein yeh features nahi milte
          </p>

          <div className="mt-10 max-w-2xl mx-auto space-y-3">
            {COMPLIANCE.map(c => (
              <div key={c} className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm font-medium">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">
            आज ही मुफ्त में शुरू करें
          </h2>
          <p className="mt-3 text-lg text-primary-foreground/80">
            Start Free Today — No credit card, no hidden charges. 100% free for Indian cooperative societies.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="gap-2 text-base px-8">
                मुफ्त पंजीकरण / Free Registration <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-muted/50 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-white font-bold">स</div>
                <span className="font-bold">SahakarLekha</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                भारत की सहकारी समितियों के लिए मुफ्त एकाउंटिंग सॉफ्टवेयर।
                Free cooperative society accounting software for India.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Features</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Double-Entry Vouchers</li>
                <li>Trial Balance & Balance Sheet</li>
                <li>TDS Register & 26Q Export</li>
                <li>GST Summary (GSTR-1/3B)</li>
                <li>Member Share & Loan Register</li>
                <li>Audit Certificate & Compliance</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Society Types</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Marketing & Processing (CMS)</li>
                <li>Primary Agricultural Credit (PACS)</li>
                <li>Dairy Cooperative</li>
                <li>Consumer Cooperative</li>
                <li>Housing Cooperative</li>
                <li>Sugar Factory Cooperative</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} SahakarLekha (सहकारलेखा) — Bharat ki Cooperative Societies ka Accounting Platform</p>
            <p className="mt-1">सहकारी समिति लेखा सॉफ्टवेयर | Cooperative Society Accounting Software | sahkari samiti software</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
