/**
 * SahakarLekha — Complete How-To / Help Guide Page
 * Bilingual (Hindi primary + English terms), beginner-friendly,
 * step-by-step guide for cooperative society clerks, accountants,
 * managers, and government auditors.
 *
 * Public page — no auth required.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  BookOpen, LogIn, LayoutDashboard, Database, FileText,
  Package, BarChart3, ShieldCheck, AlertTriangle, Lightbulb,
  Keyboard, HelpCircle, ArrowRight, Camera, CheckCircle2,
  XCircle, Info, Workflow, ListChecks,
} from 'lucide-react';

/* ──────────────── Helper Components ──────────────── */

const Screenshot: React.FC<{ caption: string }> = ({ caption }) => (
  <div className="my-4 border-2 border-dashed border-primary/40 bg-primary/5 rounded-lg p-6 flex flex-col items-center justify-center min-h-[140px]">
    <Camera className="h-8 w-8 text-primary/60 mb-2" />
    <p className="text-xs text-muted-foreground text-center">
      <span className="font-semibold text-primary">[SCREENSHOT]</span> {caption}
    </p>
  </div>
);

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-4 my-3">
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm">
      {n}
    </div>
    <div className="flex-1 pt-1">
      <p className="font-semibold text-foreground mb-1">{title}</p>
      <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
    </div>
  </div>
);

const Note: React.FC<{ type?: 'info' | 'warning' | 'success'; children: React.ReactNode }> = ({ type = 'info', children }) => {
  const styles = {
    info:    'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200',
    warning: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200',
    success: 'bg-green-50 border-green-300 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200',
  };
  const Icon = type === 'warning' ? AlertTriangle : type === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`border-l-4 rounded-r-lg p-3 my-3 flex gap-2 ${styles[type]}`}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="text-sm">{children}</div>
    </div>
  );
};

const Section: React.FC<{ id: string; icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }> = ({
  id, icon: Icon, title, subtitle, children,
}) => (
  <section id={id} className="scroll-mt-24 py-8 border-t">
    <div className="flex items-start gap-3 mb-4">
      <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
    <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert space-y-3">
      {children}
    </div>
  </section>
);

/* ──────────────── TOC ──────────────── */

const TOC_ITEMS = [
  { id: 'intro',    label: '1. परिचय (Introduction)' },
  { id: 'start',    label: '2. शुरुआत (Getting Started)' },
  { id: 'master',   label: '3. मास्टर सेटअप (Master Setup)' },
  { id: 'entries',  label: '4. दैनिक प्रविष्टियाँ (Daily Entries)' },
  { id: 'stock',    label: '5. स्टॉक प्रबंधन (Stock)' },
  { id: 'reports',  label: '6. रिपोर्ट्स (Reports)' },
  { id: 'audit',    label: '7. ऑडिट (Audit)' },
  { id: 'mistakes', label: '8. आम गलतियाँ (Mistakes)' },
  { id: 'best',     label: '9. बेस्ट प्रैक्टिस' },
  { id: 'shortcut', label: '10. शॉर्टकट' },
  { id: 'faq',      label: '11. FAQ' },
];

/* ──────────────── Main Component ──────────────── */

const UserGuide: React.FC = () => {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 md:py-16 max-w-7xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <BookOpen className="h-4 w-4" />
            पूर्ण उपयोग गाइड · Complete User Guide
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
            SahakarLekha कैसे चलाएँ?
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            सहकारी समिति के क्लर्क, लेखाकार, प्रबंधक और सरकारी ऑडिटर के लिए
            <br className="hidden md:inline" /> <span className="font-semibold text-foreground">STEP-BY-STEP सरल हिंदी गाइड</span> — बिना किसी ट्रेनिंग के सॉफ्टवेयर चलाएँ।
          </p>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-8">
          {/* TOC Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">विषय सूची · Contents</p>
                <nav className="space-y-1 text-sm">
                  {TOC_ITEMS.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="min-w-0">

            {/* ─── 1. INTRODUCTION ─── */}
            <Section id="intro" icon={BookOpen} title="1. परिचय" subtitle="What is sahakarlekha.com?">
              <p><strong>sahakarlekha.com</strong> भारत की पहली विशेष रूप से सहकारी समितियों (Cooperative Societies) के लिए बनी ऑनलाइन अकाउंटिंग सॉफ्टवेयर है। यह हरियाणा सहकारी अधिनियम 1984 तथा मॉडल को-ऑपरेटिव सोसाइटी एक्ट के अनुसार डिज़ाइन की गई है।</p>

              <h3 className="text-lg font-semibold mt-4 mb-2">किसके लिए है? · Who should use it?</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>सहकारी समिति क्लर्क</strong> (Society Clerk / सचिव)</li>
                <li><strong>लेखाकार</strong> (Accountant)</li>
                <li><strong>प्रबंधक</strong> (Manager)</li>
                <li><strong>सरकारी ऑडिटर</strong> (Government Auditor / निरीक्षक)</li>
                <li>PACS, मंडी समिति, Marketing Society, Milk Society, Credit Society</li>
              </ul>

              <h3 className="text-lg font-semibold mt-4 mb-2">मुख्य लाभ · Benefits</h3>
              <div className="grid md:grid-cols-3 gap-3 not-prose">
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">⏱ समय की बचत</p><p className="text-xs text-muted-foreground">Manual bahi-khata के मुकाबले 80% समय कम लगता है।</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">✅ Audit Ready</p><p className="text-xs text-muted-foreground">Trial Balance, Form 1, Balance Sheet — एक क्लिक में तैयार।</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">🎯 Error Reduction</p><p className="text-xs text-muted-foreground">Double-entry automatic — Dr = Cr mismatch कभी नहीं होगा।</p></CardContent></Card>
              </div>
            </Section>

            {/* ─── 2. GETTING STARTED ─── */}
            <Section id="start" icon={LogIn} title="2. शुरुआत कैसे करें?" subtitle="Login, Dashboard & Menu">

              <h3 className="text-lg font-semibold mb-2">Login प्रक्रिया · Login Process</h3>
              <Step n={1} title="Browser खोलें">Chrome, Edge या कोई भी browser में <code>sahakarlekha.com</code> टाइप करें।</Step>
              <Step n={2} title="Login बटन दबाएँ">ऊपर दाएँ कोने में <strong>Login</strong> button पर क्लिक करें।</Step>
              <Step n={3} title="Email व Password भरें">Registered email ID और password डालें। पहली बार है तो <strong>Register</strong> पर क्लिक करें।</Step>
              <Step n={4} title="Dashboard खुलेगा">Login सफल होने पर Dashboard screen दिखाई देगी।</Step>

              <Screenshot caption="Login Page — Email & Password fields के साथ" />

              <h3 className="text-lg font-semibold mt-4 mb-2">Dashboard Overview</h3>
              <p>Dashboard पर 4 मुख्य कार्ड दिखते हैं:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Total Cash</strong> — नकद शेष (Cash in hand)</li>
                <li><strong>Total Bank</strong> — बैंक बैलेंस सभी खातों का</li>
                <li><strong>Total Members</strong> — स्वीकृत सदस्यों की संख्या</li>
                <li><strong>Net Profit</strong> — कुल आय − कुल व्यय</li>
              </ul>

              <Screenshot caption="Dashboard with Cash, Bank, Members & Profit cards" />

              <h3 className="text-lg font-semibold mt-4 mb-2">मेन्यू (Sidebar) की जानकारी</h3>
              <div className="overflow-x-auto not-prose">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted"><tr><th className="text-left p-2">मेन्यू</th><th className="text-left p-2">कार्य</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2 font-medium">Dashboard</td><td className="p-2">समग्र स्थिति देखना</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Cash Book / Bank Book</td><td className="p-2">रोकड़ बही व बैंक बही</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Vouchers</td><td className="p-2">रसीद, भुगतान, जर्नल, कॉन्ट्रा entries</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Ledger Heads</td><td className="p-2">खाता शीर्षक मास्टर</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Members</td><td className="p-2">सदस्य मास्टर व अनुमोदन</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Reports</td><td className="p-2">Trial Balance, Balance Sheet, P&amp;L</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Inventory / Suppliers</td><td className="p-2">स्टॉक व पार्टी मास्टर</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ─── 3. MASTER SETUP ─── */}
            <Section id="master" icon={Database} title="3. मास्टर सेटअप" subtitle="Society Profile, Accounts, Members, Parties, Godowns">
              <Note type="warning"><strong>यह सबसे महत्वपूर्ण भाग है!</strong> मास्टर सेटअप ठीक से करेंगे तो आगे सब काम आसान हो जाएगा।</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">3.1 Society Profile Setup</h3>
              <Step n={1} title="Settings में जाएँ">Sidebar से <strong>Society Setup</strong> या <strong>Settings</strong> पर क्लिक करें।</Step>
              <Step n={2} title="समिति का विवरण भरें">नाम, रजिस्ट्रेशन नंबर, पंजीकरण तिथि, पता, फोन, email</Step>
              <Step n={3} title="Financial Year चुनें">उदाहरण: <code>2025-26</code> (1 अप्रैल 2025 − 31 मार्च 2026)</Step>
              <Step n={4} title="Signatories जोड़ें">Chairman, Secretary, Treasurer के नाम व पदनाम</Step>
              <Step n={5} title="Save करें">नीचे <strong>Save</strong> button दबाएँ।</Step>
              <Screenshot caption="Society Profile Setup form" />

              <h3 className="text-lg font-semibold mt-6 mb-2">3.2 Account Heads (खाता शीर्षक) बनाना</h3>
              <p>Chart of Accounts में 5 मुख्य category होती हैं:</p>
              <div className="overflow-x-auto not-prose">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-left">उदाहरण</th><th className="p-2 text-left">प्रकृति</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">Assets (संपत्ति)</td><td className="p-2">Cash, Bank, Stock, Fixed Assets</td><td className="p-2">Debit</td></tr>
                    <tr className="border-t"><td className="p-2">Liabilities (देनदारी)</td><td className="p-2">Loans, Sundry Creditors</td><td className="p-2">Credit</td></tr>
                    <tr className="border-t"><td className="p-2">Equity (पूंजी)</td><td className="p-2">Share Capital, Reserve Fund</td><td className="p-2">Credit</td></tr>
                    <tr className="border-t"><td className="p-2">Income (आय)</td><td className="p-2">Sales, Interest Received</td><td className="p-2">Credit</td></tr>
                    <tr className="border-t"><td className="p-2">Expense (खर्च)</td><td className="p-2">Salary, Rent, Electricity</td><td className="p-2">Debit</td></tr>
                  </tbody>
                </table>
              </div>

              <Step n={1} title="Ledger Heads खोलें">Sidebar → <strong>Ledger Heads</strong></Step>
              <Step n={2} title="+ New Account दबाएँ">ऊपर दाएँ <strong>+ New Account</strong> button पर क्लिक।</Step>
              <Step n={3} title="विवरण भरें">नाम (हिंदी/English दोनों), Category चुनें, Opening Balance डालें।</Step>
              <Step n={4} title="Save">नीचे <strong>Save</strong> दबाएँ।</Step>
              <Screenshot caption="Create New Account Head dialog" />

              <h3 className="text-lg font-semibold mt-6 mb-2">3.3 Member Master (सदस्य मास्टर)</h3>
              <Note type="info">नया सदस्य <strong>Application Form</strong> से भरें — यह <em>Pending</em> सूची में आएगा। Admin के <strong>Approve</strong> करने पर ही Share Capital व Admission Fee की voucher entry बनती है।</Note>
              <Step n={1} title="Member Application खोलें">Sidebar → <strong>Member Application</strong></Step>
              <Step n={2} title="4 Sections भरें">Personal, Address, Share & Fee, Nominee details</Step>
              <Step n={3} title="Submit करें">Submit करते ही PDF बनकर download हो जाएगी — print करके फाइल में रखें।</Step>
              <Step n={4} title="Admin से Approve करवाएँ">Members → Pending Applications tab → Approve button</Step>
              <Screenshot caption="Member Application Form (4 sections)" />

              <h3 className="text-lg font-semibold mt-6 mb-2">3.4 Party / Aarthiya Master</h3>
              <p><strong>Supplier</strong> (आढ़ती / विक्रेता) और <strong>Customer</strong> (खरीदार / HAFED / FCI) के अलग मास्टर हैं।</p>
              <Step n={1} title="Suppliers खोलें">Sidebar → Suppliers या Customers</Step>
              <Step n={2} title="+ New दबाएँ">नाम, PAN/GSTIN, पता, फोन भरें।</Step>
              <Step n={3} title="Opening Balance डालें">यदि पुराना लेन-देन बाकी है।</Step>

              <h3 className="text-lg font-semibold mt-6 mb-2">3.5 Godown / Storage Setup</h3>
              <Step n={1} title="Inventory → Godowns पर जाएँ"/>
              <Step n={2} title="Godown नाम, पता, capacity भरें"/>
              <Step n={3} title="Save करें"/>
              <Note type="success">उदाहरण: <em>"रानिया मुख्य गोदाम − Capacity 5000 क्विंटल"</em></Note>
            </Section>

            {/* ─── 4. DAILY ENTRIES ─── */}
            <Section id="entries" icon={FileText} title="4. दैनिक लेखा प्रविष्टियाँ" subtitle="Receipt, Payment, Journal, Contra, Purchase, Sales, Stock">

              <h3 className="text-lg font-semibold mb-2">लेखा चक्र (Accounting Cycle)</h3>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto not-prose">{`
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  Transaction │ ──> │   Voucher    │ ──> │   Ledger     │
   │    होती है   │     │    Entry     │     │   Posting    │
   └─────────────┘     └─────────────┘     └──────┬──────┘
                                                   │
   ┌─────────────┐     ┌─────────────┐             ▼
   │  Balance    │ <── │   Trial      │ <── ┌─────────────┐
   │  Sheet/P&L  │     │   Balance    │     │  Day Book    │
   └─────────────┘     └─────────────┘     └─────────────┘
`}</pre>

              <h3 className="text-lg font-semibold mt-4 mb-2">4.1 Receipt Entry (रसीद)</h3>
              <p><strong>कब करें?</strong> जब कोई पैसा आए — जैसे सदस्य से Share Capital, Loan किस्त वापसी, ब्याज प्राप्ति।</p>
              <Step n={1} title="Vouchers → + New Voucher"/>
              <Step n={2} title="Type: Receipt चुनें"/>
              <Step n={3} title="Date डालें"/>
              <Step n={4} title="Debit: Cash/Bank (जहाँ पैसा आया)"/>
              <Step n={5} title="Credit: जिस खाते से आया (e.g. Share Capital)"/>
              <Step n={6} title="Amount व Narration लिखें"/>
              <Step n={7} title="Save"/>
              <Note type="success"><strong>उदाहरण:</strong> राम सिंह ने ₹100 Share Capital दिया → Debit: Cash ₹100, Credit: Share Capital ₹100</Note>
              <Screenshot caption="Receipt Voucher Entry form" />

              <h3 className="text-lg font-semibold mt-4 mb-2">4.2 Payment Entry (भुगतान)</h3>
              <p><strong>कब?</strong> पैसा जाने पर — किराया, बिजली बिल, वेतन, आढ़ती भुगतान।</p>
              <Note type="success"><strong>उदाहरण:</strong> बिजली बिल ₹1,500 नकद → Debit: Electricity ₹1,500, Credit: Cash ₹1,500</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">4.3 Journal Entry (समायोजन)</h3>
              <p><strong>कब?</strong> जब Cash/Bank involved नहीं — जैसे Depreciation, ब्याज accrue, सुधार entry।</p>
              <Note type="success"><strong>उदाहरण:</strong> वार्षिक Depreciation → Debit: Depreciation ₹5,000, Credit: Furniture ₹5,000</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">4.4 Contra Entry</h3>
              <p><strong>कब?</strong> Cash ↔ Bank के बीच transfer में।</p>
              <Note type="success"><strong>उदाहरण:</strong> ₹10,000 नकद Bank में जमा → Debit: SBI Bank ₹10,000, Credit: Cash ₹10,000</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">4.5 Purchase Entry (गेहूं खरीद)</h3>
              <Note type="info"><strong>मंडी Scenario:</strong> आज समिति ने 100 क्विंटल गेहूं @ ₹2,275 = ₹2,27,500 कुल खरीद की आढ़ती "मेहरचंद ट्रेडर्स" से।</Note>
              <Step n={1} title="Vouchers → New → Type: Purchase"/>
              <Step n={2} title="Supplier: मेहरचंद ट्रेडर्स चुनें"/>
              <Step n={3} title="Item: गेहूं, Quantity: 100, Rate: 2275"/>
              <Step n={4} title="Godown चुनें"/>
              <Step n={5} title="Save → Stock अपने आप बढ़ेगा"/>
              <Screenshot caption="Purchase Entry — गेहूं खरीद मंडी उदाहरण" />

              <h3 className="text-lg font-semibold mt-4 mb-2">4.6 Sales Entry</h3>
              <Note type="info"><strong>उदाहरण:</strong> 100 क्विंटल गेहूं HAFED को @ ₹2,400 बेचा = ₹2,40,000</Note>
              <Step n={1} title="New → Type: Sales"/>
              <Step n={2} title="Customer: HAFED"/>
              <Step n={3} title="Item, Qty, Rate, Godown चुनें"/>
              <Step n={4} title="Save"/>

              <h3 className="text-lg font-semibold mt-4 mb-2">4.7 Stock Entry</h3>
              <p>Stock Adjustment — Damage, Moisture loss, Physical count mismatch ठीक करने के लिए।</p>
              <Step n={1} title="Inventory → Stock Adjustment"/>
              <Step n={2} title="Godown, Item, Reason चुनें (Damage/Moisture)"/>
              <Step n={3} title="Quantity (+/-) डालें"/>
              <Step n={4} title="Save"/>
            </Section>

            {/* ─── 5. STOCK MANAGEMENT ─── */}
            <Section id="stock" icon={Package} title="5. स्टॉक प्रबंधन" subtitle="Godown-wise Stock, Incoming/Outgoing, Damage Tracking">
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto not-prose">{`
                    STOCK FLOW DIAGRAM

    ┌──────────────┐  Purchase   ┌──────────────┐
    │   Supplier   │ ──────────> │    Godown     │
    │  (आढ़ती)    │             │  (गोदाम)     │
    └──────────────┘             └──────┬───────┘
                                        │
                ┌───────────────────────┼────────────────┐
                │                       │                │
                ▼                       ▼                ▼
          ┌──────────┐           ┌──────────┐     ┌──────────┐
          │  Sales   │           │ Damage   │     │ Transfer │
          │ (HAFED)  │           │ Moisture │     │ Godown→G │
          └──────────┘           └──────────┘     └──────────┘
`}</pre>

              <h3 className="text-lg font-semibold mt-4 mb-2">5.1 Godown-wise Stock</h3>
              <p>Inventory → Closing Stock Report — हर गोदाम का अलग stock summary देखें।</p>

              <h3 className="text-lg font-semibold mt-4 mb-2">5.2 Incoming / Outgoing Stock</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Incoming:</strong> Purchase entry → Godown में जुड़ता है</li>
                <li><strong>Outgoing:</strong> Sales entry → Godown से घटता है</li>
                <li><strong>Transfer:</strong> Inventory → Stock Transfer (एक godown से दूसरे में)</li>
              </ul>

              <h3 className="text-lg font-semibold mt-4 mb-2">5.3 Damage / Moisture Tracking</h3>
              <Note type="warning"><strong>जरूरी:</strong> हर week Physical verification करें व Stock Adjustment entry डालें। वरना Audit में mismatch होगा।</Note>
              <Screenshot caption="Stock Adjustment — Damage/Moisture entry" />
            </Section>

            {/* ─── 6. REPORTS ─── */}
            <Section id="reports" icon={BarChart3} title="6. रिपोर्ट्स" subtitle="Audit के लिए सबसे जरूरी">

              <div className="overflow-x-auto not-prose">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted"><tr><th className="p-2 text-left">Report</th><th className="p-2 text-left">क्या दिखाता है</th><th className="p-2 text-left">क्यों जरूरी</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2 font-medium">Ledger</td><td className="p-2">किसी एक खाते का पूरा विवरण</td><td className="p-2">Party reconciliation</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Cash Book</td><td className="p-2">दिन-प्रतिदिन नकद आय-व्यय</td><td className="p-2">Cash tally</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Trial Balance</td><td className="p-2">सभी खातों का Dr/Cr summary</td><td className="p-2">Error detection</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Income &amp; Exp.</td><td className="p-2">आय-व्यय statement</td><td className="p-2">Profit/Loss</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Balance Sheet</td><td className="p-2">संपत्ति-देनदारी position</td><td className="p-2">Year-end</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Member-wise</td><td className="p-2">हर सदस्य का share, loan, dividend</td><td className="p-2">AGM</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Stock Report</td><td className="p-2">Item-wise closing stock</td><td className="p-2">Godown audit</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold mt-4 mb-2">Report कैसे निकालें?</h3>
              <Step n={1} title="Sidebar → Reports पर जाएँ"/>
              <Step n={2} title="Report Type चुनें (Trial Balance आदि)"/>
              <Step n={3} title="Date Range डालें (From − To)"/>
              <Step n={4} title="Generate दबाएँ"/>
              <Step n={5} title="PDF / Excel में Export करें"/>
              <Screenshot caption="Trial Balance Report" />
              <Screenshot caption="Balance Sheet Report" />
            </Section>

            {/* ─── 7. AUDIT ─── */}
            <Section id="audit" icon={ShieldCheck} title="7. ऑडिट व अनुपालन" subtitle="Indian Cooperative Audit Requirements">
              <h3 className="text-lg font-semibold mb-2">सहकारी ऑडिट के लिए जरूरी रिपोर्ट्स</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Form 1</strong> — सदस्य सूची (Member List)</li>
                <li><strong>Form 7</strong> — Audit Objections Register</li>
                <li><strong>Share Register</strong> — सभी सदस्यों के share holdings</li>
                <li><strong>Nomination Register</strong> — Nominee details</li>
                <li><strong>Loan Register</strong> — बकाया ऋण विवरण</li>
                <li><strong>Trial Balance, P&amp;L, Balance Sheet</strong></li>
                <li><strong>NABARD Report</strong> — यदि NABARD से वित्तपोषण है</li>
                <li><strong>Federation Annual Return</strong> — Registrar को भेजने के लिए</li>
              </ul>
              <Note type="info"><strong>Export Options:</strong> हर report के ऊपर PDF व Excel button है — ऑडिटर को फाइल directly मेल कर सकते हैं।</Note>
              <h3 className="text-lg font-semibold mt-4 mb-2">Data Verification Tips</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>हर महीने Bank Reconciliation जरूर करें</li>
                <li>Cash Book के Closing balance को Physical Cash से मिलान करें</li>
                <li>Trial Balance में Dr = Cr होना चाहिए</li>
                <li>Opening Balance पिछले साल के Closing से match करें</li>
              </ul>
            </Section>

            {/* ─── 8. COMMON MISTAKES ─── */}
            <Section id="mistakes" icon={AlertTriangle} title="8. आम गलतियाँ व समाधान" subtitle="Common Mistakes & Solutions">
              <div className="space-y-4 not-prose">
                {[
                  { p: 'गलत खाता चुन लिया (Wrong Account)', r: 'जल्दबाजी में drop-down से गलत option select कर दिया', s: 'Voucher को Edit करें → सही खाता चुनें → Save करें। System re-post कर देगा।' },
                  { p: 'Duplicate Entry हो गई', r: 'एक ही transaction दो बार enter हो गई', s: 'Day Book से duplicate ढूंढें → Delete करें (deletion audit log में रहेगी)।' },
                  { p: 'Stock Mismatch', r: 'Physical stock और system stock में अंतर', s: 'Inventory → Stock Adjustment से Damage/Moisture entry डालें।' },
                  { p: 'Trial Balance Dr ≠ Cr', r: 'कोई voucher incomplete है', s: 'Deleted Vouchers check करें, फिर Voucher Approval में pending देखें।' },
                  { p: 'Bank Balance Mismatch', r: 'Cheque issued but not cleared', s: 'Bank Reconciliation module use करें।' },
                  { p: 'Member दिख नहीं रहा Reports में', r: 'Member अभी Pending/Rejected है', s: 'Admin से Approve करवाएँ → सभी reports में आ जाएगा।' },
                ].map((m, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <p className="flex gap-2 text-sm"><XCircle className="h-5 w-5 text-destructive flex-shrink-0"/><strong>समस्या:</strong> {m.p}</p>
                      <p className="flex gap-2 text-sm"><Info className="h-5 w-5 text-amber-600 flex-shrink-0"/><strong>कारण:</strong> {m.r}</p>
                      <p className="flex gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0"/><strong>समाधान:</strong> {m.s}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>

            {/* ─── 9. BEST PRACTICES ─── */}
            <Section id="best" icon={Lightbulb} title="9. बेस्ट प्रैक्टिस" subtitle="रोज़ाना की अच्छी आदतें">
              <div className="grid md:grid-cols-2 gap-3 not-prose">
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">📝 रोज़ाना entry</p><p className="text-xs text-muted-foreground">हर transaction उसी दिन enter करें — अगले दिन तक टालें नहीं।</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">💾 Backup रणनीति</p><p className="text-xs text-muted-foreground">हर week Backup/Restore से JSON download करके Pen-drive में रखें।</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">🔄 मासिक Reconciliation</p><p className="text-xs text-muted-foreground">महीने के अंत में Bank Reconciliation व Physical Cash verification करें।</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">📋 Audit Readiness Checklist</p><p className="text-xs text-muted-foreground">Trial Balance ✓, Stock ✓, Member List ✓, Loan Register ✓ — सालाना।</p></CardContent></Card>
              </div>

              <h3 className="text-lg font-semibold mt-4 mb-2 flex items-center gap-2"><ListChecks className="h-5 w-5"/> वार्षिक Checklist</h3>
              <ol className="list-decimal pl-6 space-y-1">
                <li>सभी Vouchers Approve हैं</li>
                <li>Bank Reconciliation पूरा है</li>
                <li>Physical Stock मिलता है</li>
                <li>Depreciation पोस्ट हुई</li>
                <li>Profit Distribution resolution पास हुआ</li>
                <li>Form 1 (Member list) updated है</li>
                <li>Nomination Register पूरा है</li>
                <li>Backup download कर लिया</li>
              </ol>
            </Section>

            {/* ─── 10. SHORTCUTS ─── */}
            <Section id="shortcut" icon={Keyboard} title="10. कीबोर्ड शॉर्टकट" subtitle="Fast Entry Tips">
              <div className="overflow-x-auto not-prose">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted"><tr><th className="p-2 text-left">Shortcut</th><th className="p-2 text-left">कार्य</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Ctrl + K</kbd></td><td className="p-2">Global Search खोलें</td></tr>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Tab</kbd></td><td className="p-2">अगले field पर जाएँ</td></tr>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Enter</kbd></td><td className="p-2">Form submit करें</td></tr>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Esc</kbd></td><td className="p-2">Dialog बंद करें</td></tr>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Ctrl + P</kbd></td><td className="p-2">Current page print / PDF</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold mt-4 mb-2">तेज़ Entry Tips</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account drop-down में पहले 2-3 अक्षर type करें — filter हो जाएगा</li>
                <li>Date field में <code>+</code>/<code>-</code> से एक दिन आगे/पीछे</li>
                <li>Universal Importer से Excel bulk upload करें</li>
              </ul>
            </Section>

            {/* ─── 11. FAQ ─── */}
            <Section id="faq" icon={HelpCircle} title="11. अक्सर पूछे जाने वाले प्रश्न" subtitle="Frequently Asked Questions">
              <Accordion type="single" collapsible className="w-full not-prose">
                {[
                  ['Entry delete कैसे करें?', 'Vouchers → उस voucher पर Delete button क्लिक करें। Deletion audit log में रहेगी — Deleted Vouchers page से recover भी कर सकते हैं।'],
                  ['Entry edit कैसे करें?', 'Vouchers list में Edit (pencil) icon दबाएँ → फ़ील्ड बदलें → Save। Ledger अपने आप re-post हो जाएगा।'],
                  ['Report में amount mismatch क्यों हो रहा है?', 'कारण: (1) कोई voucher pending approval में है, (2) Opening Balance नहीं मिला, (3) Deleted voucher count नहीं हो रहा। Trial Balance से शुरू करें।'],
                  ['सदस्य दिख नहीं रहा Share Register में?', 'वह अभी Pending/Rejected है। Members → Pending Applications → Approve दबाएँ।'],
                  ['Voucher number अपने आप आता है?', 'हाँ, हर Type (Receipt/Payment/Journal) का अलग series है — साल अनुसार auto-generate होता है।'],
                  ['Financial Year कैसे बदलें?', 'Society Setup → Financial Year dropdown से नया साल चुनें।'],
                  ['Backup कैसे लें?', 'Sidebar → Backup/Restore → Download JSON button।'],
                  ['2 Society एक ही login में चला सकते हैं?', 'हाँ, Multi-Society Consolidation support है।'],
                  ['PDF हिंदी में क्यों नहीं आ रहा?', 'Policy: PDF हमेशा English में होते हैं (Govt compliance)। Screen पर हिंदी दिखेगी।'],
                  ['GST voucher कैसे बनाएँ?', 'Purchase/Sales entry में GST checkbox enable करें → HSN/SAC master से item चुनें।'],
                  ['Loan Interest auto calculate होता है?', 'हाँ, Loan Interest module से monthly/quarterly accrual post होती है।'],
                  ['Depreciation कैसे पोस्ट करें?', 'Depreciation Schedule → वार्षिक Post Depreciation दबाएँ।'],
                  ['User permissions कैसे सेट करें?', 'User Management page से Admin/Accountant/Viewer roles assign करें।'],
                  ['Password भूल गया?', 'Login page → Forgot Password link → Email reset link।'],
                  ['Technical support के लिए कहाँ संपर्क करें?', 'Contact Us page से message भेजें या support@sahakarlekha.com पर email करें।'],
                ].map(([q, a], i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Section>

            {/* ─── SUMMARY / CTA ─── */}
            <section className="mt-10 py-8 border-t">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6 md:p-8 text-center">
                  <Workflow className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h2 className="text-2xl font-bold mb-2">सारांश · Summary</h2>
                  <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
                    Master Setup सही करें → रोज़ voucher entry करें → हर महीने reconciliation करें → साल के अंत में Audit reports एक क्लिक में।
                    बस इतना ही — SahakarLekha आपकी सहकारी समिति को paperless और audit-ready बना देगा।
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Link to="/register"><Button className="gap-2">अभी शुरू करें · Get Started <ArrowRight className="h-4 w-4"/></Button></Link>
                    <Link to="/contact"><Button variant="outline">Support संपर्क करें</Button></Link>
                    <Link to="/faq"><Button variant="ghost">FAQ देखें</Button></Link>
                  </div>
                </CardContent>
              </Card>
            </section>

          </main>
        </div>
      </div>
    </PublicLayout>
  );
};

export default UserGuide;
