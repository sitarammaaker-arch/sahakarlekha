/**
 * SahakarLekha — Complete How-To / Help Guide Page
 * Bilingual (Hindi primary + English terms), beginner-friendly,
 * step-by-step guide for cooperative society clerks, accountants,
 * managers, and government auditors.
 *
 * Public page — no auth required.
 */
import React from 'react';
import { Link } from '@/components/LocalLink';
import { TRIAL_CTA } from '@/lib/cta';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { PAGE_META_EN } from '@/content/pageMetaEn';
import { useLanguage } from '@/contexts/LanguageContext';
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
  Keyboard, HelpCircle, ArrowRight, CheckCircle2,
  XCircle, Info, Workflow, ListChecks,
} from 'lucide-react';

/* ──────────────── Helper Components ──────────────── */

// Renders a real screenshot from /public/guide/<file>. If the file is not present
// yet, it hides itself gracefully (no broken image, no "[SCREENSHOT]" placeholder).
// Drop the named PNGs into public/guide/ and they appear automatically.
const Screenshot: React.FC<{ caption: string; file?: string }> = ({ caption, file }) => {
  const [failed, setFailed] = React.useState(false);
  if (!file || failed) return null;
  return (
    <figure className="my-4 not-prose">
      <img
        src={`/guide/${file}`}
        alt={caption}
        onError={() => setFailed(true)}
        className="rounded-lg border shadow-sm w-full"
      />
      <figcaption className="mt-2 text-xs text-muted-foreground text-center">{caption}</figcaption>
    </figure>
  );
};

const Step: React.FC<{ n: number; title: string; children?: React.ReactNode }> = ({ n, title, children }) => (
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
  { id: 'intro',    label: '1. परिचय (Introduction)',          labelEn: '1. Introduction' },
  { id: 'start',    label: '2. शुरुआत (Getting Started)',      labelEn: '2. Getting Started' },
  { id: 'master',   label: '3. मास्टर सेटअप (Master Setup)',   labelEn: '3. Master Setup' },
  { id: 'entries',  label: '4. दैनिक एंट्रियाँ (Daily Entries)', labelEn: '4. Daily Entries' },
  { id: 'stock',    label: '5. स्टॉक प्रबंधन (Stock)',          labelEn: '5. Stock' },
  { id: 'reports',  label: '6. रिपोर्ट्स (Reports)',            labelEn: '6. Reports' },
  { id: 'audit',    label: '7. ऑडिट (Audit)',                  labelEn: '7. Audit' },
  { id: 'mistakes', label: '8. आम गलतियाँ (Mistakes)',          labelEn: '8. Common Mistakes' },
  { id: 'best',     label: '9. बेस्ट प्रैक्टिस',                 labelEn: '9. Best Practices' },
  { id: 'shortcut', label: '10. शॉर्टकट',                      labelEn: '10. Shortcuts' },
  { id: 'faq',      label: '11. FAQ',                          labelEn: '11. FAQ' },
];

/* Common mistakes — Hindi (p/r/s) with English twins (pEn/rEn/sEn). */
const MISTAKES = [
  { p: 'गलत खाता चुन लिया (Wrong Account)', r: 'जल्दबाजी में drop-down से गलत option select कर दिया', s: 'Voucher को Edit करें → सही खाता चुनें → Save करें। System re-post कर देगा।',
    pEn: 'Wrong account selected', rEn: 'The wrong option was picked from the drop-down in a hurry', sEn: 'Edit the voucher → choose the correct account → Save. The system re-posts it.' },
  { p: 'Duplicate Entry हो गई', r: 'एक ही transaction दो बार enter हो गई', s: 'Day Book से duplicate ढूंढें → Delete करें (deletion audit log में रहेगी)।',
    pEn: 'Duplicate entry made', rEn: 'The same transaction was entered twice', sEn: 'Find the duplicate in the Day Book → Delete it (the deletion stays in the audit log).' },
  { p: 'Stock Mismatch', r: 'Physical stock और system stock में अंतर', s: 'Inventory → Stock Adjustment से Damage/Moisture entry डालें।',
    pEn: 'Stock mismatch', rEn: 'Physical stock and system stock differ', sEn: 'Enter a Damage/Moisture entry via Inventory → Stock Adjustment.' },
  { p: 'Trial Balance Dr ≠ Cr', r: 'कोई voucher incomplete है', s: 'Deleted Vouchers check करें, फिर Voucher Approval में pending देखें।',
    pEn: 'Trial Balance Dr ≠ Cr', rEn: 'Some voucher is incomplete', sEn: 'Check Deleted Vouchers, then look for pending ones in Voucher Approval.' },
  { p: 'Bank Balance Mismatch', r: 'Cheque issued but not cleared', s: 'Bank Reconciliation module use करें।',
    pEn: 'Bank balance mismatch', rEn: 'Cheque issued but not cleared', sEn: 'Use the Bank Reconciliation module.' },
  { p: 'Member दिख नहीं रहा Reports में', r: 'Member अभी Pending/Rejected है', s: 'Admin से Approve करवाएँ → सभी reports में आ जाएगा।',
    pEn: 'Member not showing in reports', rEn: 'The member is still Pending/Rejected', sEn: 'Get the admin to Approve → the member then appears in all reports.' },
];

/* FAQ — [Hindi question, Hindi answer, English question, English answer]. */
const FAQ_ITEMS: [string, string, string, string][] = [
  ['Entry delete कैसे करें?', 'Vouchers → उस voucher पर Delete button क्लिक करें। Deletion audit log में रहेगी — Deleted Vouchers page से recover भी कर सकते हैं।',
    'How do I delete an entry?', 'Vouchers → click the Delete button on that voucher. The deletion stays in the audit log — you can also recover it from the Deleted Vouchers page.'],
  ['Entry edit कैसे करें?', 'Vouchers list में Edit (pencil) icon दबाएँ → फ़ील्ड बदलें → Save। Ledger अपने आप re-post हो जाएगा।',
    'How do I edit an entry?', 'Press the Edit (pencil) icon in the Vouchers list → change the fields → Save. The ledger re-posts automatically.'],
  ['Report में amount mismatch क्यों हो रहा है?', 'कारण: (1) कोई voucher pending approval में है, (2) Opening Balance नहीं मिला, (3) Deleted voucher count नहीं हो रहा। Trial Balance से शुरू करें।',
    'Why is an amount not matching in a report?', 'Reasons: (1) a voucher is pending approval, (2) the Opening Balance does not match, (3) a deleted voucher is not counted. Start with the Trial Balance.'],
  ['सदस्य दिख नहीं रहा Share Register में?', 'वह अभी Pending/Rejected है। Members → Pending Applications → Approve दबाएँ।',
    'Member not showing in the Share Register?', 'The member is still Pending/Rejected. Members → Pending Applications → press Approve.'],
  ['Voucher number अपने आप आता है?', 'हाँ, हर Type (Receipt/Payment/Journal) का अलग series है — साल अनुसार auto-generate होता है।',
    'Does the voucher number come automatically?', 'Yes, each type (Receipt/Payment/Journal) has its own series — generated automatically year-wise.'],
  ['Financial Year कैसे बदलें?', 'Society Setup → Financial Year dropdown से नया साल चुनें।',
    'How do I change the Financial Year?', 'Society Setup → choose the new year from the Financial Year dropdown.'],
  ['Backup कैसे लें?', 'Sidebar → Backup/Restore → Download JSON button।',
    'How do I take a backup?', 'Sidebar → Backup/Restore → Download JSON button.'],
  ['2 Society एक ही login में चला सकते हैं?', 'हाँ, Multi-Society Consolidation support है।',
    'Can I run 2 societies with one login?', 'Yes, Multi-Society Consolidation is supported.'],
  ['PDF हिंदी में क्यों नहीं आ रहा?', 'Policy: PDF हमेशा English में होते हैं (Govt compliance)। Screen पर हिंदी दिखेगी।',
    'Why is the PDF not in Hindi?', 'Policy: PDFs are always in English (Govt compliance). The screen can show Hindi.'],
  ['GST voucher कैसे बनाएँ?', 'Purchase/Sales entry में GST checkbox enable करें → HSN/SAC master से item चुनें।',
    'How do I make a GST voucher?', 'Enable the GST checkbox in the Purchase/Sales entry → choose the item from the HSN/SAC master.'],
  ['Loan Interest auto calculate होता है?', 'हाँ, Loan Interest module से monthly/quarterly accrual post होती है।',
    'Is loan interest calculated automatically?', 'Yes, the Loan Interest module posts the monthly/quarterly accrual.'],
  ['Depreciation कैसे पोस्ट करें?', 'Depreciation Schedule → वार्षिक Post Depreciation दबाएँ।',
    'How do I post depreciation?', 'Depreciation Schedule → press the yearly Post Depreciation.'],
  ['User permissions कैसे सेट करें?', 'User Management page से Admin/Accountant/Viewer roles assign करें।',
    'How do I set user permissions?', 'Assign Admin/Accountant/Viewer roles from the User Management page.'],
  ['आरक्षित फंड (Reserve Fund) का कितना % रखना है?', 'अब यह पूरी तरह आपके हाथ में है (optional) — कोई जबरन 25%/1% नहीं। आप जो % या राशि तय करें, रिपोर्ट उसी पोस्ट की गई राशि के अनुसार दिखेगी।',
    'What % should go to the Reserve Fund?', 'It is now fully your choice (optional) — no forced 25%/1%. Whatever % or amount you decide, the report shows the amount actually posted.'],
  ['क्या यह मोबाइल पर भी चलता है?', 'हाँ — फ़ोन, टैबलेट या कंप्यूटर, किसी भी ब्राउज़र से। फ़ॉर्म व रिपोर्ट मोबाइल पर भी साफ़ दिखते हैं; कुछ भी इंस्टॉल करने की ज़रूरत नहीं।',
    'Does it work on mobile too?', 'Yes — on phone, tablet or computer, in any browser. Forms and reports show clearly on mobile too; nothing to install.'],
  ['Password भूल गया?', 'Login page → Forgot Password link → Email reset link।',
    'Forgot your password?', 'Login page → Forgot Password link → reset link by email.'],
  ['Technical support के लिए कहाँ संपर्क करें?', 'Contact Us page से message भेजें या support@sahakarlekha.com पर email करें।',
    'Where do I contact technical support?', 'Send a message from the Contact Us page or email support@sahakarlekha.com.'],
];

/* ──────────────── Main Component ──────────────── */

const UserGuide: React.FC = () => {
  const { language } = useLanguage();
  const isHi = language === 'hi';
  // Picks the Hindi or English version (strings or small JSX fragments).
  const L = <T extends React.ReactNode>(hi: T, en: T): T => (isHi ? hi : en);
  // L2: this page had no meta of its own, so it kept the homepage's title and canonical "/" (same as its prerender).
  useDocumentMeta({
    title: L('SahakarLekha कैसे चलाएँ? — पूर्ण उपयोग गाइड | सहकार लेखा', PAGE_META_EN.quickStart.title),
    description: L('सहकारी समिति के क्लर्क, लेखाकार, प्रबंधक और ऑडिटर के लिए STEP-BY-STEP सरल हिंदी गाइड — बिना किसी ट्रेनिंग के सहकार लेखा सॉफ्टवेयर चलाएँ।', PAGE_META_EN.quickStart.description),
    canonicalPath: '/guide/quick-start',
  });
  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-10 md:py-16 max-w-7xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <BookOpen className="h-4 w-4" />
            {L('पूर्ण उपयोग गाइड · Complete User Guide', 'Complete User Guide')}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
            {L('SahakarLekha कैसे चलाएँ?', 'How to use SahakarLekha?')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {L(<>सहकारी समिति के क्लर्क, लेखाकार, प्रबंधक और सरकारी ऑडिटर के लिए
            <br className="hidden md:inline" /> <span className="font-semibold text-foreground">STEP-BY-STEP सरल हिंदी गाइड</span> — बिना किसी ट्रेनिंग के सॉफ्टवेयर चलाएँ।</>,
            <>For cooperative society clerks, accountants, managers and government auditors
            <br className="hidden md:inline" /> <span className="font-semibold text-foreground">a simple STEP-BY-STEP guide</span> — run the software without any training.</>)}
          </p>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-8">
          {/* TOC Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">{L('विषय सूची · Contents', 'Contents')}</p>
                <nav className="space-y-1 text-sm">
                  {TOC_ITEMS.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                    >
                      {isHi ? item.label : item.labelEn}
                    </a>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="min-w-0">

            {/* ─── 1. INTRODUCTION ─── */}
            <Section id="intro" icon={BookOpen} title={L('1. परिचय', '1. Introduction')} subtitle="What is sahakarlekha.com?">
              {L(<p><strong>sahakarlekha.com</strong> भारत की पहली विशेष रूप से सहकारी समितियों (Cooperative Societies) के लिए बनी ऑनलाइन अकाउंटिंग सॉफ्टवेयर है। यह हरियाणा सहकारी अधिनियम 1984 तथा मॉडल को-ऑपरेटिव सोसाइटी एक्ट के अनुसार डिज़ाइन की गई है।</p>,
                 <p><strong>sahakarlekha.com</strong> is India's first online accounting software built specially for Cooperative Societies. It is designed in line with the Haryana Cooperative Societies Act 1984 and the Model Cooperative Societies Act.</p>)}

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('किसके लिए है? · Who should use it?', 'Who should use it?')}</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>{L(<><strong>सहकारी समिति क्लर्क</strong> (Society Clerk / सचिव)</>, <><strong>Society Clerk</strong> / Secretary</>)}</li>
                <li>{L(<><strong>लेखाकार</strong> (Accountant)</>, <><strong>Accountant</strong></>)}</li>
                <li>{L(<><strong>प्रबंधक</strong> (Manager)</>, <><strong>Manager</strong></>)}</li>
                <li>{L(<><strong>सरकारी ऑडिटर</strong> (Government Auditor / निरीक्षक)</>, <><strong>Government Auditor</strong> / Inspector</>)}</li>
                <li>{L('PACS, मंडी समिति, Marketing Society, Milk Society, Credit Society', 'PACS, Mandi Samiti, Marketing Society, Milk Society, Credit Society')}</li>
              </ul>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('मुख्य लाभ · Benefits', 'Benefits')}</h3>
              <div className="grid md:grid-cols-3 gap-3 not-prose">
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">{L('⏱ समय की बचत', '⏱ Saves time')}</p><p className="text-xs text-muted-foreground">{L('Manual bahi-khata के मुकाबले 80% समय कम लगता है।', 'Takes 80% less time than a manual bahi-khata.')}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">✅ Audit Ready</p><p className="text-xs text-muted-foreground">{L('Trial Balance, Form 1, Balance Sheet — एक क्लिक में तैयार।', 'Trial Balance, Form 1, Balance Sheet — ready in one click.')}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">🎯 Error Reduction</p><p className="text-xs text-muted-foreground">{L('Double-entry automatic — Dr = Cr mismatch कभी नहीं होगा।', 'Double-entry is automatic — Dr = Cr will never mismatch.')}</p></CardContent></Card>
              </div>
            </Section>

            {/* ─── 2. GETTING STARTED ─── */}
            <Section id="start" icon={LogIn} title={L('2. शुरुआत कैसे करें?', '2. How to get started?')} subtitle="Login, Dashboard & Menu">

              <Note type="info">{L(<>📱 <strong>मोबाइल पर भी:</strong> फ़ोन, टैबलेट या कंप्यूटर — किसी भी ब्राउज़र से चलाएँ। कुछ इंस्टॉल करने की ज़रूरत नहीं।</>, <>📱 <strong>On mobile too:</strong> phone, tablet or computer — run it in any browser. Nothing to install.</>)}</Note>

              <h3 className="text-lg font-semibold mb-2">{L('Login प्रक्रिया · Login Process', 'Login Process')}</h3>
              <Step n={1} title={L('Browser खोलें', 'Open a browser')}>{L(<>Chrome, Edge या कोई भी browser में <code>sahakarlekha.com</code> टाइप करें।</>, <>Type <code>sahakarlekha.com</code> in Chrome, Edge or any browser.</>)}</Step>
              <Step n={2} title={L('Login बटन दबाएँ', 'Press the Login button')}>{L(<>ऊपर दाएँ कोने में <strong>Login</strong> button पर क्लिक करें।</>, <>Click the <strong>Login</strong> button in the top-right corner.</>)}</Step>
              <Step n={3} title={L('Email व Password भरें', 'Enter email and password')}>{L(<>Registered email ID और password डालें। पहली बार है तो <strong>Register</strong> पर क्लिक करें।</>, <>Enter your registered email ID and password. First time? Click <strong>Register</strong>.</>)}</Step>
              <Step n={4} title={L('Dashboard खुलेगा', 'The Dashboard opens')}>{L('Login सफल होने पर Dashboard screen दिखाई देगी।', 'After a successful login you will see the Dashboard screen.')}</Step>

              <Screenshot file="login.png" caption={L('Login Page — Email & Password fields के साथ', 'Login Page — with Email & Password fields')} />

              <h3 className="text-lg font-semibold mt-4 mb-2">Dashboard Overview</h3>
              <p>{L('Dashboard पर 4 मुख्य कार्ड दिखते हैं:', 'The Dashboard shows 4 main cards:')}</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Total Cash</strong> — {L('नकद शेष (Cash in hand)', 'Cash in hand')}</li>
                <li><strong>Total Bank</strong> — {L('बैंक बैलेंस सभी खातों का', 'bank balance of all accounts')}</li>
                <li><strong>Total Members</strong> — {L('स्वीकृत सदस्यों की संख्या', 'number of approved members')}</li>
                <li><strong>Net Profit</strong> — {L('कुल आय − कुल व्यय', 'total income − total expenditure')}</li>
              </ul>

              <Screenshot file="dashboard.png" caption="Dashboard with Cash, Bank, Members & Profit cards" />

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('मेन्यू (Sidebar) की जानकारी', 'About the menu (Sidebar)')}</h3>
              <div className="overflow-x-auto not-prose">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted"><tr><th className="text-left p-2">{L('मेन्यू', 'Menu')}</th><th className="text-left p-2">{L('कार्य', 'Purpose')}</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2 font-medium">Dashboard</td><td className="p-2">{L('समग्र स्थिति देखना', 'See the overall position')}</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Cash Book / Bank Book</td><td className="p-2">{L('कैश बुक व बैंक बुक', 'Cash book and bank book')}</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Vouchers</td><td className="p-2">{L('रसीद, भुगतान, जर्नल, कॉन्ट्रा entries', 'Receipt, payment, journal, contra entries')}</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Ledger Heads</td><td className="p-2">{L('खाता शीर्षक मास्टर', 'Account heads master')}</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Members</td><td className="p-2">{L('सदस्य मास्टर व अनुमोदन', 'Member master and approval')}</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Reports</td><td className="p-2">Trial Balance, Balance Sheet, P&amp;L</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Inventory / Suppliers</td><td className="p-2">{L('स्टॉक व पार्टी मास्टर', 'Stock and party master')}</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Sales / Purchases</td><td className="p-2">{L('बिक्री व खरीद की एंट्री (स्टॉक अपने-आप अपडेट)', 'Sales and purchase entries (stock updates automatically)')}</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ─── 3. MASTER SETUP ─── */}
            <Section id="master" icon={Database} title={L('3. मास्टर सेटअप', '3. Master Setup')} subtitle="Society Profile, Accounts, Members, Parties, Godowns">
              <Note type="warning">{L(<><strong>यह सबसे महत्वपूर्ण भाग है!</strong> मास्टर सेटअप ठीक से करेंगे तो आगे सब काम आसान हो जाएगा।</>, <><strong>This is the most important part!</strong> Do the master setup properly and all later work becomes easy.</>)}</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">3.1 Society Profile Setup</h3>
              <Step n={1} title={L('Settings में जाएँ', 'Go to Settings')}>{L(<>Sidebar से <strong>Society Setup</strong> या <strong>Settings</strong> पर क्लिक करें।</>, <>From the Sidebar click <strong>Society Setup</strong> or <strong>Settings</strong>.</>)}</Step>
              <Step n={2} title={L('समिति का विवरण भरें', 'Fill in the society details')}>{L('नाम, रजिस्ट्रेशन नंबर, पंजीकरण तिथि, पता, फोन, email', 'Name, registration number, registration date, address, phone, email')}</Step>
              <Step n={3} title={L('Financial Year चुनें', 'Choose the Financial Year')}>{L(<>उदाहरण: <code>2025-26</code> (1 अप्रैल 2025 − 31 मार्च 2026)</>, <>Example: <code>2025-26</code> (1 April 2025 − 31 March 2026)</>)}</Step>
              <Step n={4} title={L('Signatories जोड़ें', 'Add signatories')}>{L('Chairman, Secretary, Treasurer के नाम व पदनाम', 'Names and designations of the Chairman, Secretary, Treasurer')}</Step>
              <Step n={5} title={L('Save करें', 'Save')}>{L(<>नीचे <strong>Save</strong> button दबाएँ।</>, <>Press the <strong>Save</strong> button at the bottom.</>)}</Step>
              <Screenshot caption="Society Profile Setup form" />

              <h3 className="text-lg font-semibold mt-6 mb-2">{L('3.2 Account Heads (खाता शीर्षक) बनाना', '3.2 Creating Account Heads')}</h3>
              <p>{L('Chart of Accounts में 5 मुख्य category होती हैं:', 'The Chart of Accounts has 5 main categories:')}</p>
              <div className="overflow-x-auto not-prose">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-left">{L('उदाहरण', 'Examples')}</th><th className="p-2 text-left">{L('प्रकृति', 'Nature')}</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">{L('Assets (संपत्ति)', 'Assets')}</td><td className="p-2">Cash, Bank, Stock, Fixed Assets</td><td className="p-2">Debit</td></tr>
                    <tr className="border-t"><td className="p-2">{L('Liabilities (देनदारी)', 'Liabilities')}</td><td className="p-2">Loans, Sundry Creditors</td><td className="p-2">Credit</td></tr>
                    <tr className="border-t"><td className="p-2">{L('Equity (कैपिटल)', 'Equity (Capital)')}</td><td className="p-2">Share Capital, Reserve Fund</td><td className="p-2">Credit</td></tr>
                    <tr className="border-t"><td className="p-2">{L('Income (आय)', 'Income')}</td><td className="p-2">Sales, Interest Received</td><td className="p-2">Credit</td></tr>
                    <tr className="border-t"><td className="p-2">{L('Expense (खर्च)', 'Expense')}</td><td className="p-2">Salary, Rent, Electricity</td><td className="p-2">Debit</td></tr>
                  </tbody>
                </table>
              </div>

              <Step n={1} title={L('Ledger Heads खोलें', 'Open Ledger Heads')}>Sidebar → <strong>Ledger Heads</strong></Step>
              <Step n={2} title={L('+ New Account दबाएँ', 'Press + New Account')}>{L(<>ऊपर दाएँ <strong>+ New Account</strong> button पर क्लिक।</>, <>Click the <strong>+ New Account</strong> button at the top right.</>)}</Step>
              <Step n={3} title={L('विवरण भरें', 'Fill in the details')}>{L('नाम (हिंदी/English दोनों), Category चुनें, Opening Balance डालें।', 'Name (both Hindi/English), choose the Category, enter the Opening Balance.')}</Step>
              <Step n={4} title="Save">{L(<>नीचे <strong>Save</strong> दबाएँ।</>, <>Press <strong>Save</strong> at the bottom.</>)}</Step>
              <Screenshot caption="Create New Account Head dialog" />

              <h3 className="text-lg font-semibold mt-6 mb-2">{L('3.3 Member Master (सदस्य मास्टर)', '3.3 Member Master')}</h3>
              <Note type="info">{L(<>नया सदस्य <strong>Application Form</strong> से भरें — यह <em>Pending</em> सूची में आएगा। Admin के <strong>Approve</strong> करने पर ही Share Capital व Admission Fee की voucher entry बनती है।</>, <>Fill a new member through the <strong>Application Form</strong> — it goes into the <em>Pending</em> list. The Share Capital and Admission Fee voucher entry is made only when the admin presses <strong>Approve</strong>.</>)}</Note>
              <Step n={1} title={L('Member Application खोलें', 'Open Member Application')}>Sidebar → <strong>Member Application</strong></Step>
              <Step n={2} title={L('4 Sections भरें', 'Fill the 4 sections')}>Personal, Address, Share & Fee, Nominee details</Step>
              <Step n={3} title={L('Submit करें', 'Submit')}>{L('Submit करते ही PDF बनकर download हो जाएगी — print करके फाइल में रखें।', 'On Submit a PDF is made and downloaded — print it and keep it on file.')}</Step>
              <Step n={4} title={L('Admin से Approve करवाएँ', 'Get the admin to approve')}>Members → Pending Applications tab → Approve button</Step>
              <Screenshot caption="Member Application Form (4 sections)" />

              <h3 className="text-lg font-semibold mt-6 mb-2">3.4 Party / Aarthiya Master</h3>
              <p>{L(<><strong>Supplier</strong> (आढ़ती / विक्रेता) और <strong>Customer</strong> (खरीदार / HAFED / FCI) के अलग मास्टर हैं।</>, <><strong>Supplier</strong> (aarthiya / seller) and <strong>Customer</strong> (buyer / HAFED / FCI) have separate masters.</>)}</p>
              <Step n={1} title={L('Suppliers खोलें', 'Open Suppliers')}>{L('Sidebar → Suppliers या Customers', 'Sidebar → Suppliers or Customers')}</Step>
              <Step n={2} title={L('+ New दबाएँ', 'Press + New')}>{L('नाम, PAN/GSTIN, पता, फोन भरें।', 'Fill in the name, PAN/GSTIN, address, phone.')}</Step>
              <Step n={3} title={L('Opening Balance डालें', 'Enter the Opening Balance')}>{L('यदि पुराना लेन-देन बाकी है।', 'If an old balance is outstanding.')}</Step>

              <h3 className="text-lg font-semibold mt-6 mb-2">{L('3.5 Stock Items (माल / वस्तु) सेटअप', '3.5 Stock Items setup')}</h3>
              <Note type="warning">{L(<><strong>अनिवार्य:</strong> हर वस्तु को एक <strong>बिक्री खाता (Sales A/c)</strong> और एक <strong>खरीद खाता (Purchase A/c)</strong> देना ज़रूरी है। बिना खाता दिए वस्तु की बिक्री/खरीद <strong>पोस्ट नहीं होगी</strong>। इसी से रिपोर्ट में हर श्रेणी अलग दिखती है (जैसे "उर्वरक बिक्री", "उपभोक्ता वस्तु बिक्री")।</>, <><strong>Mandatory:</strong> every item must be given a <strong>Sales A/c</strong> and a <strong>Purchase A/c</strong>. Without these accounts, the item's sale/purchase <strong>will not post</strong>. This is what makes each category show separately in reports (e.g. "Fertilizer Sales", "Consumer Goods Sales").</>)}</Note>
              <Step n={1} title={L('Inventory खोलें', 'Open Inventory')}>{L(<>Sidebar → <strong>Inventory (माल भंडार)</strong></>, <>Sidebar → <strong>Inventory</strong></>)}</Step>
              <Step n={2} title={L('+ नई वस्तु जोड़ें', '+ Add new item')}>{L('नाम, इकाई (क्विंटल/किलो/नग), प्रारंभिक स्टॉक, खरीद दर, बिक्री दर भरें।', 'Fill in the name, unit (quintal/kg/piece), opening stock, purchase rate, sale rate.')}</Step>
              <Step n={3} title={L('बिक्री खाता व खरीद खाता चुनें', 'Choose the Sales A/c and Purchase A/c')}>{L('drop-down से चुनें — चाहें तो वहीं नया खाता/ग्रुप भी बना सकते हैं।', 'Choose from the drop-down — you can also create a new account/group right there.')}</Step>
              <Step n={4} title={L('Save करें', 'Save')}/>
              <Screenshot file="inventory.png" caption={L('Inventory — नई वस्तु में बिक्री व खरीद खाता अनिवार्य', 'Inventory — Sales and Purchase A/c are mandatory for a new item')} />
            </Section>

            {/* ─── 4. DAILY ENTRIES ─── */}
            <Section id="entries" icon={FileText} title={L('4. दैनिक लेखा एंट्रियाँ', '4. Daily Accounting Entries')} subtitle="Receipt, Payment, Journal, Contra, Purchase, Sales, Stock">

              <h3 className="text-lg font-semibold mb-2">{L('लेखा चक्र (Accounting Cycle)', 'Accounting Cycle')}</h3>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto not-prose">{L(`
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  Transaction │ ──> │   Voucher    │ ──> │   Ledger     │
   │    होती है   │     │    Entry     │     │   Posting    │
   └─────────────┘     └─────────────┘     └──────┬──────┘
                                                   │
   ┌─────────────┐     ┌─────────────┐             ▼
   │  Balance    │ <── │   Trial      │ <── ┌─────────────┐
   │  Sheet/P&L  │     │   Balance    │     │  Day Book    │
   └─────────────┘     └─────────────┘     └─────────────┘
`, `
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  Transaction │ ──> │   Voucher    │ ──> │   Ledger     │
   │   happens    │     │    Entry     │     │   Posting    │
   └─────────────┘     └─────────────┘     └──────┬──────┘
                                                   │
   ┌─────────────┐     ┌─────────────┐             ▼
   │  Balance    │ <── │   Trial      │ <── ┌─────────────┐
   │  Sheet/P&L  │     │   Balance    │     │  Day Book    │
   └─────────────┘     └─────────────┘     └─────────────┘
`)}</pre>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('4.1 Receipt Entry (रसीद)', '4.1 Receipt Entry')}</h3>
              <p>{L(<><strong>कब करें?</strong> जब कोई पैसा आए — जैसे सदस्य से Share Capital, Loan किस्त वापसी, ब्याज रसीद।</>, <><strong>When?</strong> When money comes in — e.g. Share Capital from a member, loan instalment repayment, interest received.</>)}</p>
              <Step n={1} title="Vouchers → + New Voucher"/>
              <Step n={2} title={L('Type: Receipt चुनें', 'Choose Type: Receipt')}/>
              <Step n={3} title={L('Date डालें', 'Enter the date')}/>
              <Step n={4} title={L('Debit: Cash/Bank (जहाँ पैसा आया)', 'Debit: Cash/Bank (where the money came in)')}/>
              <Step n={5} title={L('Credit: जिस खाते से आया (e.g. Share Capital)', 'Credit: the account it came from (e.g. Share Capital)')}/>
              <Step n={6} title={L('Amount व Narration लिखें', 'Write the amount and narration')}/>
              <Step n={7} title="Save"/>
              <Note type="success">{L(<><strong>उदाहरण:</strong> राम सिंह ने ₹100 Share Capital दिया → Debit: Cash ₹100, Credit: Share Capital ₹100</>, <><strong>Example:</strong> Ram Singh paid ₹100 Share Capital → Debit: Cash ₹100, Credit: Share Capital ₹100</>)}</Note>
              <Screenshot caption="Receipt Voucher Entry form" />

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('4.2 Payment Entry (भुगतान)', '4.2 Payment Entry')}</h3>
              <p>{L(<><strong>कब?</strong> पैसा जाने पर — किराया, बिजली बिल, वेतन, आढ़ती भुगतान।</>, <><strong>When?</strong> When money goes out — rent, electricity bill, salary, aarthiya payment.</>)}</p>
              <Note type="success">{L(<><strong>उदाहरण:</strong> बिजली बिल ₹1,500 नकद → Debit: Electricity ₹1,500, Credit: Cash ₹1,500</>, <><strong>Example:</strong> Electricity bill ₹1,500 in cash → Debit: Electricity ₹1,500, Credit: Cash ₹1,500</>)}</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('4.3 Journal Entry (समायोजन)', '4.3 Journal Entry (Adjustment)')}</h3>
              <p>{L(<><strong>कब?</strong> जब Cash/Bank involved नहीं — जैसे Depreciation, ब्याज accrue, सुधार entry।</>, <><strong>When?</strong> When Cash/Bank is not involved — e.g. depreciation, interest accrual, correction entries.</>)}</p>
              <Note type="success">{L(<><strong>उदाहरण:</strong> वार्षिक Depreciation → Debit: Depreciation ₹5,000, Credit: Furniture ₹5,000</>, <><strong>Example:</strong> Yearly depreciation → Debit: Depreciation ₹5,000, Credit: Furniture ₹5,000</>)}</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">4.4 Contra Entry</h3>
              <p>{L(<><strong>कब?</strong> Cash ↔ Bank के बीच transfer में।</>, <><strong>When?</strong> For a transfer between Cash ↔ Bank.</>)}</p>
              <Note type="success">{L(<><strong>उदाहरण:</strong> ₹10,000 नकद Bank में जमा → Debit: SBI Bank ₹10,000, Credit: Cash ₹10,000</>, <><strong>Example:</strong> ₹10,000 cash deposited in the bank → Debit: SBI Bank ₹10,000, Credit: Cash ₹10,000</>)}</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('4.5 Purchase Entry (खरीद)', '4.5 Purchase Entry')}</h3>
              <Note type="info">{L(<><strong>मंडी Scenario:</strong> आज समिति ने 100 क्विंटल गेहूं @ ₹2,275 = ₹2,27,500 की खरीद आढ़ती "मेहरचंद ट्रेडर्स" से की।</>, <><strong>Mandi scenario:</strong> Today the society bought 100 quintals of wheat @ ₹2,275 = ₹2,27,500 from the aarthiya "Meharchand Traders".</>)}</Note>
              <Step n={1} title={L('Purchases खोलें', 'Open Purchases')}>{L(<>Sidebar (Operations) → <strong>Purchases (खरीद)</strong> → नई खरीद</>, <>Sidebar (Operations) → <strong>Purchases</strong> → New Purchase</>)}</Step>
              <Step n={2} title={L('Supplier चुनें', 'Choose the Supplier')}>{L('मेहरचंद ट्रेडर्स', 'Meharchand Traders')}</Step>
              <Step n={3} title={L('Item, Quantity, Rate भरें', 'Fill Item, Quantity, Rate')}>{L('गेहूं, 100, 2275 — (वस्तु में Purchase A/c पहले से होना चाहिए)', 'Wheat, 100, 2275 — (the item must already have a Purchase A/c)')}</Step>
              <Step n={4} title={L('Save → Stock अपने-आप बढ़ेगा', 'Save → stock goes up automatically')}>{L('खरीद की वाउचर व स्टॉक एंट्री अपने-आप बन जाती है।', 'The purchase voucher and stock entry are made automatically.')}</Step>
              <Screenshot file="purchase.png" caption={L('Purchase Entry — गेहूं खरीद (मंडी उदाहरण)', 'Purchase Entry — wheat purchase (mandi example)')} />

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('4.6 Sales Entry (बिक्री)', '4.6 Sales Entry')}</h3>
              <Note type="info">{L(<><strong>उदाहरण:</strong> 100 क्विंटल गेहूं HAFED को @ ₹2,400 बेचा = ₹2,40,000</>, <><strong>Example:</strong> Sold 100 quintals of wheat to HAFED @ ₹2,400 = ₹2,40,000</>)}</Note>
              <Step n={1} title={L('Sales खोलें', 'Open Sales')}>{L(<>Sidebar (Operations) → <strong>Sales (बिक्री)</strong> → नई बिक्री</>, <>Sidebar (Operations) → <strong>Sales</strong> → New Sale</>)}</Step>
              <Step n={2} title={L('Customer चुनें', 'Choose the Customer')}>HAFED</Step>
              <Step n={3} title={L('Item, Qty, Rate भरें', 'Fill Item, Qty, Rate')}>{L('साथ में उपलब्ध स्टॉक भी दिखता है — (वस्तु में Sales A/c होना चाहिए)', 'The available stock is shown alongside — (the item must have a Sales A/c)')}</Step>
              <Step n={4} title={L('Save → Stock अपने-आप घटेगा', 'Save → stock goes down automatically')}/>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('4.7 Stock Adjustment (स्टॉक समायोजन)', '4.7 Stock Adjustment')}</h3>
              <p>{L('Damage, नमी (Moisture) हानि, या भौतिक गिनती के अंतर को ठीक करने के लिए।', 'To correct damage, moisture loss, or a difference found in the physical count.')}</p>
              <Step n={1} title={L('Inventory → Adjustment खोलें', 'Open Inventory → Adjustment')}/>
              <Step n={2} title={L('वस्तु व कारण चुनें (Damage/Moisture)', 'Choose the item and reason (Damage/Moisture)')}/>
              <Step n={3} title={L('मात्रा (+/-) डालें', 'Enter the quantity (+/-)')}/>
              <Step n={4} title={L('Save — स्टॉक अपने-आप अपडेट', 'Save — stock updates automatically')}/>
            </Section>

            {/* ─── 5. STOCK MANAGEMENT ─── */}
            <Section id="stock" icon={Package} title={L('5. स्टॉक प्रबंधन', '5. Stock Management')} subtitle="Item-wise Stock, Auto Closing Stock, Damage Tracking">
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto not-prose">{L(`
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
`, `
                    STOCK FLOW DIAGRAM

    ┌──────────────┐  Purchase   ┌──────────────┐
    │   Supplier   │ ──────────> │    Godown     │
    │ (Aarthiya)   │             │ (Warehouse)  │
    └──────────────┘             └──────┬───────┘
                                        │
                ┌───────────────────────┼────────────────┐
                │                       │                │
                ▼                       ▼                ▼
          ┌──────────┐           ┌──────────┐     ┌──────────┐
          │  Sales   │           │ Damage   │     │ Transfer │
          │ (HAFED)  │           │ Moisture │     │ Godown→G │
          └──────────┘           └──────────┘     └──────────┘
`)}</pre>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('5.1 स्टॉक कैसे घटता-बढ़ता है', '5.1 How stock goes up and down')}</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>{L(<><strong>खरीद (Purchase):</strong> स्टॉक अपने-आप बढ़ता है</>, <><strong>Purchase:</strong> stock goes up automatically</>)}</li>
                <li>{L(<><strong>बिक्री (Sales):</strong> स्टॉक अपने-आप घटता है</>, <><strong>Sales:</strong> stock goes down automatically</>)}</li>
                <li>{L(<><strong>समायोजन (Adjustment):</strong> Damage / नमी / गिनती-अंतर के लिए (+/−)</>, <><strong>Adjustment:</strong> for damage / moisture / count difference (+/−)</>)}</li>
              </ul>
              <Note type="info">{L(<><strong>स्टॉक की गणना हमेशा movements (खरीद − बिक्री ± समायोजन) से होती है</strong> — इसलिए जो स्टॉक रिपोर्ट में दिखता है, ठीक वही बिक्री स्क्रीन पर "उपलब्ध" भी दिखता है।</>, <><strong>Stock is always calculated from movements (purchase − sales ± adjustment)</strong> — so the stock shown in reports is exactly what the sales screen shows as "available".</>)}</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('5.2 स्टॉक रिपोर्ट व समापन स्टॉक', '5.2 Stock reports and closing stock')}</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Inventory:</strong> {L('हर वस्तु का वर्तमान स्टॉक, दर व मूल्य', 'current stock, rate and value of every item')}</li>
                <li><strong>Stock Valuation / Closing Stock Report:</strong> {L('श्रेणी-वार स्टॉक वैल्यूएशन', 'category-wise stock valuation')}</li>
              </ul>
              <Note type="success">{L(<><strong>समापन स्टॉक अब अपने-आप (Tally की तरह):</strong> जब भी बैलेंस शीट या व्यापार खाता देखें, समापन स्टॉक इन्वेंट्री से अपने-आप गणना होकर आ जाता है — कोई "Post Closing Stock" बटन दबाने की ज़रूरत नहीं।</>, <><strong>Closing stock is now automatic (like Tally):</strong> whenever you view the Balance Sheet or Trading Account, closing stock is calculated from inventory automatically — no need to press any "Post Closing Stock" button.</>)}</Note>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('5.3 Damage / नमी ट्रैकिंग', '5.3 Damage / moisture tracking')}</h3>
              <Note type="warning">{L(<><strong>ज़रूरी:</strong> हर सप्ताह भौतिक सत्यापन (Physical verification) करें और अंतर को Stock Adjustment से दर्ज करें — वरना ऑडिट में mismatch आएगा।</>, <><strong>Important:</strong> do a physical verification every week and record any difference through Stock Adjustment — otherwise the audit will show a mismatch.</>)}</Note>
              <Screenshot file="stock-adjustment.png" caption={L('Stock Adjustment — Damage/नमी एंट्री', 'Stock Adjustment — damage/moisture entry')} />
            </Section>

            {/* ─── 6. REPORTS ─── */}
            <Section id="reports" icon={BarChart3} title={L('6. रिपोर्ट्स', '6. Reports')} subtitle={L('Audit के लिए सबसे जरूरी', 'Most important for the audit')}>

              <div className="overflow-x-auto not-prose">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted"><tr><th className="p-2 text-left">Report</th><th className="p-2 text-left">{L('क्या दिखाता है', 'What it shows')}</th><th className="p-2 text-left">{L('क्यों जरूरी', 'Why it matters')}</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2 font-medium">Ledger</td><td className="p-2">{L('किसी एक खाते का पूरा विवरण', 'Full detail of one account')}</td><td className="p-2">Party reconciliation</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Cash Book</td><td className="p-2">{L('दिन-प्रतिदिन नकद आय-व्यय', 'Day-to-day cash receipts and payments')}</td><td className="p-2">Cash tally</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Trial Balance</td><td className="p-2">{L('सभी खातों का Dr/Cr summary', 'Dr/Cr summary of all accounts')}</td><td className="p-2">Error detection</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Income &amp; Exp.</td><td className="p-2">{L('आय-व्यय statement', 'Income and expenditure statement')}</td><td className="p-2">Profit/Loss</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Balance Sheet</td><td className="p-2">{L('संपत्ति-देनदारी position', 'Assets and liabilities position')}</td><td className="p-2">Year-end</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Member-wise</td><td className="p-2">{L('हर सदस्य का share, loan, dividend', 'Share, loan, dividend of every member')}</td><td className="p-2">AGM</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">Stock Report</td><td className="p-2">Item-wise closing stock</td><td className="p-2">Godown audit</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('Report कैसे निकालें?', 'How to get a report?')}</h3>
              <Step n={1} title={L('Sidebar → Reports पर जाएँ', 'Go to Sidebar → Reports')}/>
              <Step n={2} title={L('Report Type चुनें (Trial Balance आदि)', 'Choose the report type (Trial Balance etc.)')}/>
              <Step n={3} title={L('Date Range डालें (From − To)', 'Enter the date range (From − To)')}/>
              <Step n={4} title={L('Generate दबाएँ', 'Press Generate')}/>
              <Step n={5} title={L('PDF / Excel में Export करें', 'Export to PDF / Excel')}/>
              <Screenshot file="trial-balance.png" caption="Trial Balance Report" />
              <Screenshot file="balance-sheet.png" caption="Balance Sheet Report" />
            </Section>

            {/* ─── 7. AUDIT ─── */}
            <Section id="audit" icon={ShieldCheck} title={L('7. ऑडिट व अनुपालन', '7. Audit and Compliance')} subtitle="Indian Cooperative Audit Requirements">
              <h3 className="text-lg font-semibold mb-2">{L('सहकारी ऑडिट के लिए जरूरी रिपोर्ट्स', 'Reports needed for the cooperative audit')}</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Form 1</strong> — {L('सदस्य सूची (Member List)', 'Member List')}</li>
                <li><strong>Form 7</strong> — Audit Objections Register</li>
                <li><strong>Share Register</strong> — {L('सभी सदस्यों के share holdings', 'share holdings of all members')}</li>
                <li><strong>Nomination Register</strong> — Nominee details</li>
                <li><strong>Loan Register</strong> — {L('बकाया ऋण विवरण', 'outstanding loan details')}</li>
                <li><strong>Trial Balance, P&amp;L, Balance Sheet</strong></li>
                <li><strong>NABARD Report</strong> — {L('यदि NABARD से वित्तपोषण है', 'if the society has NABARD financing')}</li>
                <li><strong>Federation Annual Return</strong> — {L('Registrar को भेजने के लिए', 'to send to the Registrar')}</li>
              </ul>
              <Note type="info">{L(<><strong>Export Options:</strong> हर report के ऊपर PDF व Excel button है — ऑडिटर को फाइल directly मेल कर सकते हैं।</>, <><strong>Export Options:</strong> every report has PDF and Excel buttons at the top — you can email the file directly to the auditor.</>)}</Note>
              <h3 className="text-lg font-semibold mt-4 mb-2">Data Verification Tips</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>{L('हर महीने Bank Reconciliation जरूर करें', 'Do the Bank Reconciliation every month')}</li>
                <li>{L('Cash Book के Closing balance को Physical Cash से मिलान करें', 'Match the Cash Book closing balance with the physical cash')}</li>
                <li>{L('Trial Balance में Dr = Cr होना चाहिए', 'The Trial Balance must have Dr = Cr')}</li>
                <li>{L('Opening Balance पिछले साल के Closing से match करें', "The Opening Balance must match last year's closing")}</li>
              </ul>
            </Section>

            {/* ─── 8. COMMON MISTAKES ─── */}
            <Section id="mistakes" icon={AlertTriangle} title={L('8. आम गलतियाँ व समाधान', '8. Common Mistakes and Solutions')} subtitle="Common Mistakes & Solutions">
              <div className="space-y-4 not-prose">
                {MISTAKES.map((m, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <p className="flex gap-2 text-sm"><XCircle className="h-5 w-5 text-destructive flex-shrink-0"/><strong>{L('समस्या:', 'Problem:')}</strong> {isHi ? m.p : m.pEn}</p>
                      <p className="flex gap-2 text-sm"><Info className="h-5 w-5 text-amber-600 flex-shrink-0"/><strong>{L('कारण:', 'Cause:')}</strong> {isHi ? m.r : m.rEn}</p>
                      <p className="flex gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0"/><strong>{L('समाधान:', 'Solution:')}</strong> {isHi ? m.s : m.sEn}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>

            {/* ─── 9. BEST PRACTICES ─── */}
            <Section id="best" icon={Lightbulb} title={L('9. बेस्ट प्रैक्टिस', '9. Best Practices')} subtitle={L('रोज़ाना की अच्छी आदतें', 'Good daily habits')}>
              <div className="grid md:grid-cols-2 gap-3 not-prose">
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">{L('📝 रोज़ाना entry', '📝 Daily entry')}</p><p className="text-xs text-muted-foreground">{L('हर transaction उसी दिन enter करें — अगले दिन तक टालें नहीं।', 'Enter every transaction the same day — do not put it off to the next day.')}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">{L('💾 Backup रणनीति', '💾 Backup plan')}</p><p className="text-xs text-muted-foreground">{L('हर week Backup/Restore से JSON download करके Pen-drive में रखें।', 'Every week download the JSON from Backup/Restore and keep it on a pen-drive.')}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">{L('🔄 मासिक Reconciliation', '🔄 Monthly reconciliation')}</p><p className="text-xs text-muted-foreground">{L('महीने के अंत में Bank Reconciliation व Physical Cash verification करें।', 'At month-end do the Bank Reconciliation and physical cash verification.')}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="font-semibold mb-1">📋 Audit Readiness Checklist</p><p className="text-xs text-muted-foreground">{L('Trial Balance ✓, Stock ✓, Member List ✓, Loan Register ✓ — सालाना।', 'Trial Balance ✓, Stock ✓, Member List ✓, Loan Register ✓ — yearly.')}</p></CardContent></Card>
              </div>

              <h3 className="text-lg font-semibold mt-4 mb-2 flex items-center gap-2"><ListChecks className="h-5 w-5"/> {L('वार्षिक Checklist', 'Yearly checklist')}</h3>
              <ol className="list-decimal pl-6 space-y-1">
                <li>{L('सभी Vouchers Approve हैं', 'All vouchers are approved')}</li>
                <li>{L('Bank Reconciliation पूरा है', 'Bank Reconciliation is complete')}</li>
                <li>{L('Physical Stock मिलता है', 'Physical stock matches')}</li>
                <li>{L('Depreciation पोस्ट हुई', 'Depreciation is posted')}</li>
                <li>{L('Profit Distribution resolution पास हुआ', 'Profit distribution resolution is passed')}</li>
                <li>{L('Form 1 (Member list) updated है', 'Form 1 (Member list) is updated')}</li>
                <li>{L('Nomination Register पूरा है', 'Nomination Register is complete')}</li>
                <li>{L('Backup download कर लिया', 'Backup is downloaded')}</li>
              </ol>
            </Section>

            {/* ─── 10. SHORTCUTS ─── */}
            <Section id="shortcut" icon={Keyboard} title={L('10. कीबोर्ड शॉर्टकट', '10. Keyboard Shortcuts')} subtitle="Fast Entry Tips">
              <div className="overflow-x-auto not-prose">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted"><tr><th className="p-2 text-left">Shortcut</th><th className="p-2 text-left">{L('कार्य', 'Action')}</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Ctrl + K</kbd></td><td className="p-2">{L('Global Search खोलें', 'Open Global Search')}</td></tr>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Tab</kbd></td><td className="p-2">{L('अगले field पर जाएँ', 'Go to the next field')}</td></tr>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Enter</kbd></td><td className="p-2">{L('Form submit करें', 'Submit the form')}</td></tr>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Esc</kbd></td><td className="p-2">{L('Dialog बंद करें', 'Close the dialog')}</td></tr>
                    <tr className="border-t"><td className="p-2"><kbd className="px-2 py-0.5 bg-muted rounded text-xs">Ctrl + P</kbd></td><td className="p-2">Current page print / PDF</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold mt-4 mb-2">{L('तेज़ Entry Tips', 'Fast entry tips')}</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>{L('Account drop-down में पहले 2-3 अक्षर type करें — filter हो जाएगा', 'Type the first 2-3 letters in the account drop-down — the list filters')}</li>
                <li>{L(<>Date field में <code>+</code>/<code>-</code> से एक दिन आगे/पीछे</>, <>In a date field, <code>+</code>/<code>-</code> moves one day forward/back</>)}</li>
                <li>{L('Universal Importer से Excel bulk upload करें', 'Bulk upload from Excel with the Universal Importer')}</li>
              </ul>
            </Section>

            {/* ─── 11. FAQ ─── */}
            <Section id="faq" icon={HelpCircle} title={L('11. अक्सर पूछे जाने वाले प्रश्न', '11. Frequently Asked Questions')} subtitle="Frequently Asked Questions">
              <Accordion type="single" collapsible className="w-full not-prose">
                {FAQ_ITEMS.map(([q, a, qEn, aEn], i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-left">{isHi ? q : qEn}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{isHi ? a : aEn}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Section>

            {/* ─── SUMMARY / CTA ─── */}
            <section className="mt-10 py-8 border-t">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6 md:p-8 text-center">
                  <Workflow className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h2 className="text-2xl font-bold mb-2">{L('सारांश · Summary', 'Summary')}</h2>
                  <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
                    {L(<>Master Setup सही करें → रोज़ voucher entry करें → हर महीने reconciliation करें → साल के अंत में Audit reports एक क्लिक में।
                    बस इतना ही — SahakarLekha आपकी सहकारी समिति को paperless और audit-ready बना देगा।</>,
                    <>Get the Master Setup right → enter vouchers daily → reconcile every month → audit reports in one click at year-end.
                    That's all — SahakarLekha makes your cooperative society paperless and audit-ready.</>)}
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Link to="/register"><Button className="gap-2">{L(TRIAL_CTA.hi, TRIAL_CTA.en)} <ArrowRight className="h-4 w-4"/></Button></Link>
                    <Link to="/contact"><Button variant="outline">{L('Support संपर्क करें', 'Contact Support')}</Button></Link>
                    <Link to="/faq"><Button variant="ghost">{L('FAQ देखें', 'View FAQ')}</Button></Link>
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
