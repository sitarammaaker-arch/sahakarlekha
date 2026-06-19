/**
 * Bilingual layer for the /guide course. The Hindi structure lives in the
 * auto-generated index.ts; this file adds:
 *  - GUIDE_UI: UI string dictionary (hi/en)
 *  - PARTS_EN / ENTRY_EN: English titles & summaries for the hub TOC
 *  - loadGuideContent(slug, lang): English markdown if present, else Hindi
 * English chapter bodies live in src/content/guide/en/<slug>.md and are added
 * progressively; until a chapter is translated it gracefully falls back to Hindi.
 */
import type { GuideEntry, GuidePart } from './index';

export type GuideLang = 'hi' | 'en';

/* ---------- UI strings ---------- */
export const GUIDE_UI: Record<string, { hi: string; en: string }> = {
  // hub
  'hub.badge': { hi: 'सीखें · Complete Learning Course', en: 'Learn · Complete Course' },
  'hub.title': { hi: 'सहकार लेखा से सम्पूर्ण Accounting सीखें', en: 'Master Cooperative Accounting with SahakarLekha' },
  'hub.desc': {
    hi: 'लेखांकन की नींव से लेकर बिक्री, खरीद, स्टॉक, GST/TDS, अंतिम खाते, ऑडिट व वर्षांत तक — {n} अध्याय की सरल हिंदी गाइड। हर सदस्य, क्लर्क, लेखाकार व ऑडिटर के लिए — बिल्कुल मुफ़्त, ऑनलाइन।',
    en: 'From the basics of accounting to sales, purchases, stock, GST/TDS, final accounts, audit and year-end — a {n}-chapter guide in plain language. For every member, clerk, accountant and auditor — completely free, online.',
  },
  'hub.quickstart': { hi: 'त्वरित गाइड · Quick Start', en: 'Quick Start' },
  'hub.quickstart.desc': { hi: 'ऐप कैसे चलाएँ — screenshots व step-by-step क्लिक निर्देश।', en: 'How to run the app — screenshots and step-by-step click instructions.' },
  'hub.open': { hi: 'खोलें', en: 'Open' },
  'hub.intro': { hi: 'भूमिका · Introduction', en: 'Introduction' },
  'hub.intro.desc': { hi: 'यह कोर्स किसके लिए है, कैसे पढ़ें, और तीन सुनहरे सूत्र।', en: 'Who this course is for, how to read it, and three golden principles.' },
  'hub.read': { hi: 'पढ़ें', en: 'Read' },
  'hub.pdf': { hi: 'पूरी किताब · PDF', en: 'Full Book · PDF' },
  'hub.pdf.desc': { hi: 'सम्पूर्ण {n}-अध्याय गाइड एक printable PDF में — ऑफ़लाइन पढ़ें/छापें।', en: 'The complete {n}-chapter guide in one printable PDF — read/print offline.' },
  'hub.download': { hi: 'डाउनलोड', en: 'Download' },
  'hub.search.placeholder': { hi: 'गाइड में खोजें — जैसे बिक्री, GST, स्टॉक, मूल्यह्रास…', en: 'Search the guide — e.g. sales, GST, stock, depreciation…' },
  'hub.search.none': { hi: 'कोई परिणाम नहीं मिला।', en: 'No results found.' },
  'hub.progress': { hi: 'आपकी प्रगति', en: 'Your progress' },
  'hub.progress.count': { hi: '{done} / {total} अध्याय · {pct}%', en: '{done} / {total} chapters · {pct}%' },
  'hub.start': { hi: 'पढ़ना शुरू करें', en: 'Start reading' },
  'hub.continue': { hi: 'पढ़ना जारी रखें', en: 'Continue reading' },
  'hub.reread': { hi: 'फिर से पढ़ें', en: 'Read again' },
  'hub.quiz.take': { hi: 'इस भाग की क्विज़ हल करें ({n} प्रश्न)', en: 'Take this part’s quiz ({n} questions)' },
  'hub.quiz.passed': { hi: 'क्विज़ उत्तीर्ण ✓ — दोबारा करें', en: 'Quiz passed ✓ — retake' },
  'hub.cert.title': { hi: 'पूर्णता प्रमाणपत्र', en: 'Completion Certificate' },
  'hub.cert.desc': { hi: 'सभी {total} भागों की क्विज़ उत्तीर्ण करें और अपना प्रमाणपत्र पाएँ — {done}/{total} पूरे।', en: 'Pass all {total} part quizzes and earn your certificate — {done}/{total} done.' },
  'hub.cert.get': { hi: 'प्रमाणपत्र पाएँ', en: 'Get certificate' },
  'hub.cert.view': { hi: 'प्रमाणपत्र देखें', en: 'View certificate' },
  'hub.cert.verify': { hi: 'प्रमाणपत्र सत्यापित करें', en: 'Verify a certificate' },
  'hub.cta.title': { hi: 'तैयार हैं? अपनी समिति शुरू करें', en: 'Ready? Start your society' },
  'hub.cta.desc': { hi: 'पढ़ते जाइए, साथ-साथ अपनी समिति में अभ्यास कीजिए — सहकार लेखा बिल्कुल मुफ़्त है।', en: 'Read on and practise in your own society — SahakarLekha is completely free.' },
  'hub.cta.start': { hi: 'अभी शुरू करें', en: 'Get started' },
  // chapter
  'ch.home': { hi: 'गाइड', en: 'Guide' },
  'ch.badge.appendix': { hi: 'परिशिष्ट', en: 'Appendix' },
  'ch.badge.chapter': { hi: 'अध्याय {n}', en: 'Chapter {n}' },
  'ch.badge.guide': { hi: 'सहकार लेखा गाइड', en: 'SahakarLekha Guide' },
  'ch.readtime': { hi: '~{n} मिनट पढ़ने में', en: '~{n} min read' },
  'ch.markdone': { hi: 'इस अध्याय को पूरा चिह्नित करें', en: 'Mark this chapter complete' },
  'ch.done': { hi: 'पूरा हुआ ✓ (हटाने हेतु दबाएँ)', en: 'Completed ✓ (tap to undo)' },
  'ch.prev': { hi: 'पिछला', en: 'Previous' },
  'ch.next': { hi: 'अगला', en: 'Next' },
  'ch.inthis': { hi: 'इस अध्याय में', en: 'In this chapter' },
  'ch.allchapters': { hi: 'सभी अध्याय', en: 'All chapters' },
  'ch.fallback': { hi: 'इस अध्याय का अंग्रेज़ी अनुवाद जल्द आ रहा है — फ़िलहाल हिंदी संस्करण दिखाया जा रहा है।', en: 'The English translation of this chapter is coming soon — showing the Hindi version for now.' },
  // quiz
  'quiz.breadcrumb': { hi: 'क्विज़', en: 'Quiz' },
  'quiz.badge': { hi: 'क्विज़ · {n} प्रश्न', en: 'Quiz · {n} questions' },
  'quiz.instructions': { hi: 'सभी प्रश्नों के उत्तर चुनकर "उत्तर जाँचें" दबाएँ। 70% या अधिक पर यह भाग उत्तीर्ण।', en: 'Answer all questions and press "Check answers". 70% or more passes this part.' },
  'quiz.qprefix': { hi: 'प्र.', en: 'Q' },
  'quiz.check': { hi: 'उत्तर जाँचें ({done}/{total})', en: 'Check answers ({done}/{total})' },
  'quiz.answerall': { hi: 'सभी प्रश्नों के उत्तर चुनें।', en: 'Answer all questions.' },
  'quiz.score': { hi: '{correct} / {total} सही · {pct}%', en: '{correct} / {total} correct · {pct}%' },
  'quiz.passed': { hi: 'बधाई! आपने यह भाग उत्तीर्ण कर लिया ✓', en: 'Congratulations! You passed this part ✓' },
  'quiz.failed': { hi: 'उत्तीर्ण होने के लिए {pct}% चाहिए — फिर कोशिश करें।', en: 'You need {pct}% to pass — try again.' },
  'quiz.retry': { hi: 'फिर से करें', en: 'Try again' },
  'quiz.gonext': { hi: 'आगे बढ़ें', en: 'Continue' },
  'quiz.cert': { hi: 'प्रमाणपत्र', en: 'Certificate' },
  // certificate
  'cert.breadcrumb': { hi: 'प्रमाणपत्र', en: 'Certificate' },
  'cert.locked.title': { hi: 'पूर्णता प्रमाणपत्र', en: 'Completion Certificate' },
  'cert.locked.desc': { hi: 'सभी {total} भागों की क्विज़ उत्तीर्ण करें — फिर यहाँ यूनीक क्रमांक वाला प्रमाणपत्र बनाएँ।', en: 'Pass all {total} part quizzes — then create your uniquely-numbered certificate here.' },
  'cert.progress': { hi: 'प्रगति: {done} / {total} भाग उत्तीर्ण', en: 'Progress: {done} / {total} parts passed' },
  'cert.quiz.passed': { hi: 'उत्तीर्ण ✓', en: 'Passed ✓' },
  'cert.quiz.solve': { hi: 'हल करें', en: 'Solve' },
  'cert.verifylink': { hi: 'किसी प्रमाणपत्र को सत्यापित करें', en: 'Verify a certificate' },
  'cert.claim.title': { hi: 'प्रमाणपत्र प्राप्त करें', en: 'Get your certificate' },
  'cert.claim.desc': { hi: 'बधाई! आपने सभी {total} भाग उत्तीर्ण कर लिए। प्रमाणपत्र बनाने के लिए अपना विवरण भरें।', en: 'Congratulations! You passed all {total} parts. Fill in your details to create the certificate.' },
  'cert.f.name': { hi: 'नाम', en: 'Name' },
  'cert.f.email': { hi: 'ईमेल', en: 'Email' },
  'cert.f.society': { hi: 'समिति का नाम', en: 'Society name' },
  'cert.f.optional': { hi: '(वैकल्पिक)', en: '(optional)' },
  'cert.ph.name': { hi: 'जैसे: सीताराम कुमार, सचिव', en: 'e.g. Sitaram Kumar, Secretary' },
  'cert.ph.society': { hi: 'जैसे: रानिया सहकारी समिति', en: 'e.g. Rania Cooperative Society' },
  'cert.email.invalid': { hi: 'कृपया सही ईमेल भरें।', en: 'Please enter a valid email.' },
  'cert.consent': { hi: 'मैं सहमत हूँ कि मेरा नाम व ईमेल प्रमाणपत्र जारी करने व उसके सत्यापन हेतु सुरक्षित रखा जाए', en: 'I agree that my name and email may be stored to issue and verify the certificate' },
  'cert.privacy': { hi: 'गोपनीयता नीति', en: 'Privacy Policy' },
  'cert.create': { hi: 'प्रमाणपत्र बनाएँ', en: 'Create certificate' },
  'cert.servernote': { hi: 'ऑनलाइन रिकॉर्ड अभी सहेजा नहीं जा सका — प्रमाणपत्र फिर भी मान्य है। बाद में दोबारा प्रयास कर सकते हैं।', en: 'The online record couldn’t be saved yet — the certificate is still valid. You can try again later.' },
  'cert.holder': { hi: 'धारक', en: 'Holder' },
  'cert.editdetails': { hi: 'विवरण बदलें', en: 'Edit details' },
  'cert.title': { hi: 'प्रमाण पत्र', en: 'Certificate' },
  'cert.subtitle': { hi: 'Certificate of Completion', en: 'Certificate of Completion' },
  'cert.this': { hi: 'यह प्रमाणित किया जाता है कि', en: 'This is to certify that' },
  'cert.completed': { hi: 'ने "सहकार लेखा वेब एप से सम्पूर्ण Accounting Guide" कोर्स के सभी {total} भाग सफलतापूर्वक उत्तीर्ण कर, सहकारी लेखांकन में दक्षता अर्जित कर ली है।', en: 'has successfully completed all {total} parts of the "Complete Accounting Guide with the SahakarLekha Web App" course and gained competence in cooperative accounting.' },
  'cert.date': { hi: 'दिनांक', en: 'Date' },
  'cert.certno': { hi: 'प्रमाणपत्र क्रमांक', en: 'Certificate No.' },
  'cert.authorized': { hi: 'अधिकृत · sahakarlekha.com', en: 'Authorised · sahakarlekha.com' },
  'cert.verifyfooter': { hi: 'सत्यापन: sahakarlekha.com/guide/verify पर क्रमांक व नाम दर्ज करें', en: 'Verify: enter the number and name at sahakarlekha.com/guide/verify' },
  'cert.download': { hi: 'PDF डाउनलोड करें', en: 'Download PDF' },
  'cert.print': { hi: 'प्रिंट करें', en: 'Print' },
  'cert.verify': { hi: 'सत्यापित करें', en: 'Verify' },
  'cert.back': { hi: 'गाइड पर लौटें', en: 'Back to guide' },
  'cert.filename': { hi: 'फ़ाइल इस नाम से सहेजी जाएगी:', en: 'The file will be saved as:' },
  // verify
  'verify.breadcrumb': { hi: 'प्रमाणपत्र सत्यापन', en: 'Certificate Verification' },
  'verify.title': { hi: 'प्रमाणपत्र सत्यापन', en: 'Certificate Verification' },
  'verify.desc': { hi: 'प्रमाणपत्र पर छपा क्रमांक व धारक का नाम दर्ज करें।', en: 'Enter the certificate number and holder name printed on the certificate.' },
  'verify.f.number': { hi: 'प्रमाणपत्र क्रमांक', en: 'Certificate number' },
  'verify.f.name': { hi: 'धारक का नाम', en: 'Holder name' },
  'verify.ph.name': { hi: 'जैसा प्रमाणपत्र पर लिखा है', en: 'As printed on the certificate' },
  'verify.btn': { hi: 'सत्यापित करें', en: 'Verify' },
  'verify.valid': { hi: '✓ वैध प्रमाणपत्र', en: '✓ Valid certificate' },
  'verify.holder': { hi: 'धारक:', en: 'Holder:' },
  'verify.issued': { hi: 'जारी दिनांक:', en: 'Issued on:' },
  'verify.course': { hi: 'सहकार लेखा सम्पूर्ण Accounting कोर्स', en: 'SahakarLekha Complete Accounting course' },
  'verify.invalid': { hi: '✗ सत्यापन असफल', en: '✗ Verification failed' },
  'verify.invalid.desc': { hi: 'क्रमांक व नाम मेल नहीं खाते, या क्रमांक का प्रारूप गलत है। कृपया प्रमाणपत्र पर लिखा सही क्रमांक व नाम दर्ज करें।', en: 'The number and name don’t match, or the number format is wrong. Please enter the exact number and name printed on the certificate.' },
  'verify.note': { hi: 'यह कोड प्रमाणपत्र के क्रमांक, धारक-नाम व जारी-तिथि के परस्पर मेल की पुष्टि करता है।', en: 'This code confirms that the certificate number, holder name and issue date all match.' },
  // language toggle
  'lang.hi': { hi: 'हिंदी', en: 'हिंदी' },
  'lang.en': { hi: 'English', en: 'English' },
};

export function gt(lang: GuideLang, key: string, vars?: Record<string, string | number>): string {
  const e = GUIDE_UI[key];
  let s = e ? e[lang] : key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
  return s;
}

/* ---------- English part titles ---------- */
export const PARTS_EN: Record<string, string> = {
  'bhag-1': 'Part 1 — Foundations of Accounting',
  'bhag-2': 'Part 2 — Getting Started with SahakarLekha',
  'bhag-3': 'Part 3 — Daily Operations',
  'bhag-4': 'Part 4 — Books & Trial Balance',
  'bhag-5': 'Part 5 — Final Accounts',
  'bhag-6': 'Part 6 — Tax Compliance',
  'bhag-7': 'Part 7 — Specialised Accounting',
  'bhag-8': 'Part 8 — Year-End & Security',
  'bhag-9': 'Part 9 — Reference & Practice',
  'parishisht': 'Appendices',
};

/* ---------- English entry (chapter/appendix) titles & summaries ---------- */
export const ENTRY_EN: Record<string, { shortTitle: string; summary: string }> = {
  bhumika: { shortTitle: 'Introduction', summary: 'Three principles: the app is a tool, understanding is yours; small correct habits save the books; transparency is the heart of cooperation.' },
  'adhyay-1': { shortTitle: 'Foundations: a cooperative society’s books', summary: 'Why records matter; applying debit & credit; the five account types; the accounting equation and cycle.' },
  'adhyay-2': { shortTitle: 'Registration, society setup & roles', summary: 'Create a society; set details & financial year; roles and Maker-Checker; reading the Dashboard.' },
  'adhyay-3': { shortTitle: 'Chart of Accounts', summary: 'Group vs sub-ledger; the code system; the standard chart; adding a new account.' },
  'adhyay-4': { shortTitle: 'Opening Balances', summary: 'Carry last year’s closing into this year; Dr = Cr; the root cause of “the Balance Sheet won’t tally”.' },
  'adhyay-5': { shortTitle: 'Members & membership', summary: 'Add & approve members; record share capital and admission fee separately; the member ledger; share refund on exit.' },
  'adhyay-6': { shortTitle: 'Vouchers: Receipt, Payment, Journal, Contra', summary: 'The four voucher types; Easy & Expert modes; approval and correctly cancelling vouchers.' },
  'adhyay-7': { shortTitle: 'Sales Management', summary: 'Cash/bank/credit sales; GST; stock linkage and the oversell block; the Sale Register.' },
  'adhyay-8': { shortTitle: 'Purchase Management', summary: 'Cash/credit purchases; GST input credit; TDS (deducted once); the Purchase Register.' },
  'adhyay-9': { shortTitle: 'Inventory', summary: 'Items/groups/opening; stock movements; the one-formula rule; weighted-average value.' },
  'adhyay-10': { shortTitle: 'Bill-wise Settlement', summary: 'Payments against specific bills; partial and oldest-first; advance/on-account; ageing of dues.' },
  'adhyay-11': { shortTitle: 'Salary Management', summary: 'Employee master & slips; gross/deductions/net; the salary entry; depositing EPF/ESI/PT/TDS.' },
  'adhyay-12': { shortTitle: 'Day Book & Ledger', summary: 'Reading the Day Book; an account’s ledger and running balance; search/filter; the audit trail.' },
  'adhyay-13': { shortTitle: 'Trial Balance', summary: 'Build & read it; why Dr = Cr matters; the NCDC two-section format; diagnosing a mismatch.' },
  'adhyay-14': { shortTitle: 'Trading Account', summary: 'Gross profit; opening + purchases − closing; activity-wise breakdown; the correct closing-stock value.' },
  'adhyay-15': { shortTitle: 'Income & Expenditure', summary: 'Net surplus/deficit; transfer of gross profit; direct vs indirect expenses; capital vs revenue.' },
  'adhyay-16': { shortTitle: 'Balance Sheet', summary: 'Assets = liabilities + capital; single closing-stock figure; avoiding double-counting; reading it.' },
  'adhyay-17': { shortTitle: 'Receipts & Payments', summary: 'A cash-basis summary; capital vs revenue; excluding contra; opening/closing cash & bank.' },
  'adhyay-18': { shortTitle: 'GST Management', summary: 'Output/input GST; CGST-SGST-IGST; HSN summary; correct tax on discounted bills; GSTR reconciliation.' },
  'adhyay-19': { shortTitle: 'TDS & quarterly return (26Q)', summary: 'When/how much TDS; deduct once; depositing TDS payable; the TDS register and 26Q quarters.' },
  'adhyay-20': { shortTitle: 'Depreciation', summary: 'SLM & WDV; per-asset WDV; accumulated depreciation; the journal; impact on the Balance Sheet.' },
  'adhyay-21': { shortTitle: 'Stock Valuation', summary: 'FIFO/weighted-average; canonical qty × cost; order-insensitive value; diagnosing a “₹0” value.' },
  'adhyay-22': { shortTitle: 'Profit Distribution', summary: 'Statutory reserve 25%; dividend and bonus; patronage rebate; distributable surplus; over-appropriation guard.' },
  'adhyay-23': { shortTitle: 'Statutory returns & federation report', summary: 'Federation report; member growth (FY-bounded); NPA classification; borrowed funds; statutory forms.' },
  'adhyay-24': { shortTitle: 'Year-end process & FY-Lock', summary: 'Year-end checklist; closing-stock journal; FY-Lock; carrying balances forward.' },
  'adhyay-25': { shortTitle: 'Audit Preparation', summary: 'Audit types; the document file; common objections; the audit certificate; transparency.' },
  'adhyay-26': { shortTitle: 'Data Security & Backup', summary: 'Cloud security & RLS; role control; export backups; password hygiene; “local vs cloud” safeguards.' },
  'adhyay-27': { shortTitle: 'Golden rules of cooperative accounting', summary: 'Day-to-day principles and warnings worth remembering.' },
  'adhyay-28': { shortTitle: 'Full case study: Rania Society (full year)', summary: 'A whole year — opening balances to final accounts and appropriation — tying out as one.' },
  'adhyay-29': { shortTitle: 'Special registers & records', summary: 'Member, share, loan, stock, salary, GST/TDS registers; their purpose and reconciliation.' },
  'adhyay-30': { shortTitle: 'Comprehensive FAQ (top 30)', summary: 'The most common questions and answers in SahakarLekha — a quick reference.' },
  'parishisht-a': { shortTitle: 'Standard Chart of Accounts', summary: 'The main ready-made accounts — code, name, category and report.' },
  'parishisht-b': { shortTitle: 'Glossary', summary: 'Plain meanings of the key accounting terms used in this guide.' },
  'parishisht-c': { shortTitle: 'Report → statutory form map', summary: 'Which app report maps to which statutory form/use.' },
  'parishisht-d': { shortTitle: 'Quick-reference card', summary: 'Debit-credit, voucher choice, key formulas and due dates at a glance.' },
  'parishisht-e': { shortTitle: 'Year-end checklist (printable)', summary: 'A printable year-end checklist with tick boxes.' },
  'parishisht-f': { shortTitle: 'Exercise answers (selected)', summary: 'Worked answers to selected exercises — check after solving.' },
  samapan: { shortTitle: 'Closing — a final word', summary: 'A recap of the journey and the three guiding principles of trustworthy cooperative bookkeeping.' },
};

export function localizedPartTitle(part: GuidePart, lang: GuideLang): string {
  return lang === 'en' ? (PARTS_EN[part.id] ?? part.title) : part.title;
}
export function localizedEntry(entry: GuideEntry, lang: GuideLang): { shortTitle: string; summary: string } {
  if (lang === 'en' && ENTRY_EN[entry.slug]) return ENTRY_EN[entry.slug];
  return { shortTitle: entry.shortTitle, summary: entry.summary };
}

/* ---------- bilingual content loader ---------- */
const RAW_HI = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const RAW_EN = import.meta.glob('./en/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Returns the chapter markdown for a language. `fallback` = true when an
 *  English page was requested but only Hindi exists yet. */
export function loadGuideContent(slug: string, lang: GuideLang): { content: string | null; fallback: boolean } {
  if (lang === 'en') {
    const en = RAW_EN['./en/' + slug + '.md'];
    if (en != null) return { content: en, fallback: false };
    return { content: RAW_HI['./' + slug + '.md'] ?? null, fallback: true };
  }
  return { content: RAW_HI['./' + slug + '.md'] ?? null, fallback: false };
}
