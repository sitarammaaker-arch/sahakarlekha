/**
 * relatedContent — the central knowledge-graph edge registry (GOS-11).
 *
 * crossLinks.ts owns the blog↔guide canonical pairs (Law L7). THIS module owns
 * every OTHER cross-surface edge so no public surface is a silo:
 *
 *   blog → help            (narrative → "अभी करें" task)
 *   glossary → blog        (definition → narrative deep-dive)
 *   help ↔ cookbook        (task → the journal entry it produces, and back)
 *   calculator → cookbook  (the math → how to RECORD it)
 *   software-type → guide/blog/help/cookbook   (landing page → knowledge)
 *   state → guide/blog/cookbook                (landing page → knowledge)
 *
 * PURE DATA + tiny pure helpers only — imported by page components AND
 * data-loaded (esbuild) by scripts/prerender-guide.mjs so the same edges land
 * in the prerendered static HTML. Do NOT import content registries here:
 * blog/guide indexes bundle their whole markdown corpus (import.meta.glob),
 * which must never leak into unrelated page chunks. Where a page can't cheaply
 * resolve a title (blog/guide refs), the ref carries its own short label.
 *
 * RULES: only genuine topical pairs (no forced links); every slug must exist —
 * `npm run test:related` validates all of them against the real registries.
 */

/** A cross-surface link whose target registry is too heavy to import — label travels with it. */
export interface Ref {
  slug: string;
  title: string;
}

export interface SurfaceLinks {
  guide?: Ref[];
  blog?: Ref[];
  help?: string[];      // help/cookbook registries are light — pages resolve real titles
  cookbook?: string[];
}

/* ---------------- blog → help (narrative → task) ---------------- */

export const BLOG_HELP: Record<string, string[]> = {
  'member-and-share-accounting': ['add-member'],
  'membership-rights-and-duties': ['add-member'],
  'voucher-entry-guide': ['first-voucher'],
  'voucher-narration-and-documents': ['first-voucher'],
  'cooperative-accounting-basics': ['first-voucher', 'add-ledger'],
  'debit-credit-and-double-entry': ['first-voucher'],
  'opening-balances-new-society': ['opening-balances'],
  'getting-started-sahakarlekha': ['add-ledger', 'opening-balances'],
  'how-to-read-financial-reports': ['view-trial-balance'],
  'trial-balance-explained': ['view-trial-balance'],
  'bank-reconciliation-guide': ['bank-reconciliation'],
  'cash-book-vs-bank-book': ['cash-book'],
  'cash-handling-and-verification': ['cash-book'],
  'loan-and-interest-accounting': ['loan-entry'],
  'kcc-crop-loan-accounting': ['loan-entry'],
  'loan-recovery-before-year-end': ['loan-entry'],
  'user-roles-and-permissions': ['user-permissions'],
  'audit-preparation-checklist': ['audit-report'],
  'chart-of-accounts-groups-heads': ['add-ledger'],
};

/* ---------------- glossary → blog (definition → narrative) ---------------- */
/* Ref form: glossary pages must not import the blog corpus. */

const B = (slug: string, title: string): Ref => ({ slug, title });

export const GLOSSARY_BLOG: Record<string, Ref> = {
  'cooperative-principles': B('cooperative-principles-and-values', 'सहकारिता के सिद्धांत और मूल्य'),
  'cooperative-values': B('cooperative-principles-and-values', 'सहकारिता के सिद्धांत और मूल्य'),
  'cooperative-vs-company': B('cooperative-vs-company-difference', 'सहकारी समिति बनाम कंपनी'),
  'society-types': B('cooperative-society-types-guide', 'सहकारी समितियों के प्रकार'),
  'cooperative-society': B('cooperative-society-types-guide', 'सहकारी समितियों के प्रकार'),
  'pacs': B('kcc-crop-loan-accounting', 'KCC व फसली ऋण का लेखांकन'),
  'dairy-cooperative': B('dairy-cooperative-accounting-basics', 'दुग्ध समिति लेखांकन की मूल बातें'),
  'double-entry': B('debit-credit-and-double-entry', 'डेबिट, क्रेडिट और डबल एंट्री'),
  'debit': B('debit-credit-and-double-entry', 'डेबिट, क्रेडिट और डबल एंट्री'),
  'credit': B('debit-credit-and-double-entry', 'डेबिट, क्रेडिट और डबल एंट्री'),
  'golden-rules': B('debit-credit-and-double-entry', 'डेबिट, क्रेडिट और डबल एंट्री'),
  'accounting-equation': B('accounting-equation-explained', 'अकाउंटिंग इक्वेशन'),
  'asset': B('accounting-equation-explained', 'अकाउंटिंग इक्वेशन'),
  'liability': B('accounting-equation-explained', 'अकाउंटिंग इक्वेशन'),
  'capital': B('share-capital-authorised-issued-paidup', 'शेयर कैपिटल: अधिकृत, निर्गमित, चुकता'),
  'cash-book': B('cash-book-vs-bank-book', 'कैश बुक बनाम बैंक बुक'),
  'bank-book': B('cash-book-vs-bank-book', 'कैश बुक बनाम बैंक बुक'),
  'cash': B('cash-handling-and-verification', 'कैश संभालना व मिलान'),
  'cash-in-hand': B('cash-handling-and-verification', 'कैश संभालना व मिलान'),
  'cash-account': B('cash-book-vs-bank-book', 'कैश बुक बनाम बैंक बुक'),
  'ledger': B('ledger-and-posting-explained', 'लेजर और पोस्टिंग'),
  'ledger-account': B('ledger-and-posting-explained', 'लेजर और पोस्टिंग'),
  'posting': B('ledger-and-posting-explained', 'लेजर और पोस्टिंग'),
  'journal': B('ledger-and-posting-explained', 'लेजर और पोस्टिंग'),
  'day-book': B('ledger-and-posting-explained', 'लेजर और पोस्टिंग'),
  'books-of-account': B('ledger-and-posting-explained', 'लेजर और पोस्टिंग'),
  'account': B('chart-of-accounts-groups-heads', 'चार्ट ऑफ अकाउंट्स: ग्रुप व हेड'),
  'account-group': B('chart-of-accounts-groups-heads', 'चार्ट ऑफ अकाउंट्स: ग्रुप व हेड'),
  'account-head': B('chart-of-accounts-groups-heads', 'चार्ट ऑफ अकाउंट्स: ग्रुप व हेड'),
  'voucher': B('voucher-entry-guide', 'वाउचर एंट्री गाइड'),
  'narration': B('voucher-narration-and-documents', 'वाउचर विवरण व दस्तावेज़'),
  'supporting-document': B('voucher-narration-and-documents', 'वाउचर विवरण व दस्तावेज़'),
  'voucher-approval': B('voucher-narration-and-documents', 'वाउचर विवरण व दस्तावेज़'),
  'membership': B('membership-rights-and-duties', 'सदस्यता: अधिकार व कर्तव्य'),
  'member': B('member-and-share-accounting', 'सदस्य व शेयर लेखांकन'),
  'nominal-member': B('membership-rights-and-duties', 'सदस्यता: अधिकार व कर्तव्य'),
  'associate-member': B('membership-rights-and-duties', 'सदस्यता: अधिकार व कर्तव्य'),
  'member-duties': B('membership-rights-and-duties', 'सदस्यता: अधिकार व कर्तव्य'),
  'nominee': B('membership-rights-and-duties', 'सदस्यता: अधिकार व कर्तव्य'),
  'share': B('share-capital-authorised-issued-paidup', 'शेयर कैपिटल: अधिकृत, निर्गमित, चुकता'),
  'share-certificate': B('share-capital-authorised-issued-paidup', 'शेयर कैपिटल: अधिकृत, निर्गमित, चुकता'),
  'authorised-capital': B('share-capital-authorised-issued-paidup', 'शेयर कैपिटल: अधिकृत, निर्गमित, चुकता'),
  'issued-capital': B('share-capital-authorised-issued-paidup', 'शेयर कैपिटल: अधिकृत, निर्गमित, चुकता'),
  'paid-up-capital': B('share-capital-authorised-issued-paidup', 'शेयर कैपिटल: अधिकृत, निर्गमित, चुकता'),
  'face-value': B('share-capital-authorised-issued-paidup', 'शेयर कैपिटल: अधिकृत, निर्गमित, चुकता'),
  'cheque': B('bank-payment-methods-cheque-dd-upi', 'बैंक भुगतान: चेक, DD, UPI'),
  'demand-draft': B('bank-payment-methods-cheque-dd-upi', 'बैंक भुगतान: चेक, DD, UPI'),
  'neft-rtgs': B('bank-payment-methods-cheque-dd-upi', 'बैंक भुगतान: चेक, DD, UPI'),
  'upi-for-societies': B('bank-payment-methods-cheque-dd-upi', 'बैंक भुगतान: चेक, DD, UPI'),
  'bank-account': B('bank-payment-methods-cheque-dd-upi', 'बैंक भुगतान: चेक, DD, UPI'),
  'multi-bank-handling': B('bank-payment-methods-cheque-dd-upi', 'बैंक भुगतान: चेक, DD, UPI'),
  'passbook': B('bank-reconciliation-guide', 'बैंक मिलान (BRS) गाइड'),
  'bank-statement': B('bank-reconciliation-guide', 'बैंक मिलान (BRS) गाइड'),
  'financial-year': B('financial-year-and-accounting-period', 'वित्तीय वर्ष व लेखा अवधि'),
  'accounting-period': B('financial-year-and-accounting-period', 'वित्तीय वर्ष व लेखा अवधि'),
  'going-concern': B('accounting-assumptions-going-concern-prudence', 'लेखांकन की मान्यताएँ'),
  'prudence': B('accounting-assumptions-going-concern-prudence', 'लेखांकन की मान्यताएँ'),
  'accounting': B('cooperative-accounting-basics', 'सहकारी लेखांकन की मूल बातें'),
  'accounting-cycle': B('cooperative-accounting-basics', 'सहकारी लेखांकन की मूल बातें'),
  'income': B('cooperative-accounting-basics', 'सहकारी लेखांकन की मूल बातें'),
  'expense': B('cooperative-accounting-basics', 'सहकारी लेखांकन की मूल बातें'),
  'transaction': B('cooperative-accounting-basics', 'सहकारी लेखांकन की मूल बातें'),
  'debit-credit-columns': B('trial-balance-explained', 'ट्रायल बैलेंस, आसान भाषा में'),
  'how-to-read-financial-reports': B('how-to-read-financial-reports', 'वित्तीय रिपोर्ट कैसे पढ़ें'),
  'choosing-software': B('choosing-cooperative-accounting-software', 'सही लेखा सॉफ्टवेयर कैसे चुनें'),
  'is-sahakarlekha-free': B('choosing-cooperative-accounting-software', 'सही लेखा सॉफ्टवेयर कैसे चुनें'),
  'saas': B('digital-accounting-for-cooperatives', 'डिजिटल लेखांकन क्यों ज़रूरी'),
  'cloud-accounting': B('digital-accounting-for-cooperatives', 'डिजिटल लेखांकन क्यों ज़रूरी'),
  'why-go-digital': B('digital-accounting-for-cooperatives', 'डिजिटल लेखांकन क्यों ज़रूरी'),
  'data-backup': B('data-security-and-backup', 'डेटा सुरक्षा व बैकअप'),
  'data-restore': B('data-security-and-backup', 'डेटा सुरक्षा व बैकअप'),
  'optimistic-save-rollback': B('data-security-and-backup', 'डेटा सुरक्षा व बैकअप'),
  'user-role': B('user-roles-and-permissions', 'यूज़र भूमिकाएँ व अनुमतियाँ'),
  'user-permission': B('user-roles-and-permissions', 'यूज़र भूमिकाएँ व अनुमतियाँ'),
  'tally-excel-migration': B('migrate-from-tally-or-excel', 'Tally/Excel से माइग्रेशन'),
  'universal-importer': B('migrate-from-tally-or-excel', 'Tally/Excel से माइग्रेशन'),
  'getting-started': B('getting-started-sahakarlekha', 'SahakarLekha से शुरुआत'),
  'society-setup': B('getting-started-sahakarlekha', 'SahakarLekha से शुरुआत'),
  'society-setup-steps': B('getting-started-sahakarlekha', 'SahakarLekha से शुरुआत'),
  'first-voucher-task': B('voucher-entry-guide', 'वाउचर एंट्री गाइड'),
  'opening-balance-entry-task': B('opening-balances-new-society', 'ओपनिंग बैलेंस कैसे डालें'),
  'year-end-close-task': B('year-end-closing-and-fy-lock', 'साल-अंत क्लोज़िंग व FY लॉक'),
};

/* ---------------- help ↔ cookbook (task ↔ the entry it produces) ---------------- */

export const HELP_COOKBOOK: Record<string, string[]> = {
  'add-member': ['member-share-capital'],
  'first-voucher': ['cash-sale', 'expense-paid', 'receive-payment'],
  'loan-entry': ['loan-disbursed', 'loan-interest-received', 'loan-recovery'],
  'cash-book': ['cash-deposit-to-bank', 'bank-withdrawal-to-cash'],
  'bank-reconciliation': ['bank-charges'],
  'audit-report': ['audit-fee'],
};

/** Reverse edge, derived — cookbook entry → the help task(s) that produce it. */
export function helpForCookbook(cookbookSlug: string): string[] {
  const out: string[] = [];
  for (const [help, entries] of Object.entries(HELP_COOKBOOK)) {
    if (entries.includes(cookbookSlug)) out.push(help);
  }
  return out;
}

/* ---------------- calculator → cookbook (the math → how to record it) ---------------- */

export const CALC_COOKBOOK: Record<string, string[]> = {
  'depreciation-calculator': ['depreciation'],
  'simple-interest-calculator': ['loan-interest-received'],
  'compound-interest-calculator': ['fixed-deposit'],
  'loan-emi-calculator': ['loan-disbursed', 'loan-recovery'],
  'gst-calculator': ['gst-payment'],
  'tds-calculator': ['tds-deposit'],
  'share-capital-calculator': ['member-share-capital', 'share-refund-on-exit'],
  'percentage-calculator': ['discount-allowed'],
};

/* ---------------- society-type / state landing pages → knowledge ---------------- */

const G = B; // guide refs use the same {slug,title} shape

export const SOCIETY_CONTENT: Record<string, SurfaceLinks> = {
  pacs: {
    guide: [G('special-registers', 'विशेष रजिस्टर (ऋण रजिस्टर धारा 32)'), G('society-type-entries', 'समिति-प्रकार अनुसार एंट्रियाँ')],
    blog: [B('kcc-crop-loan-accounting', 'KCC व फसली ऋण का लेखांकन')],
    help: ['loan-entry'],
    cookbook: ['loan-disbursed', 'loan-interest-received'],
  },
  dairy: {
    guide: [G('society-type-entries', 'समिति-प्रकार अनुसार एंट्रियाँ')],
    blog: [B('dairy-cooperative-accounting-basics', 'दुग्ध समिति लेखांकन की मूल बातें')],
    cookbook: ['milk-procurement'],
  },
  marketing: {
    guide: [G('msp-procurement-entries', 'MSP खरीद व HAFED एंट्रियाँ')],
    blog: [B('inventory-and-stock-management', 'इन्वेंटरी व स्टॉक प्रबंधन')],
    cookbook: ['farmer-payment-msp', 'hafed-procurement-commission', 'mandi-fee-hrdf'],
  },
  consumer: {
    guide: [G('sales-entries', 'बिक्री एंट्रियाँ'), G('inventory-management', 'इन्वेंटरी प्रबंधन')],
    blog: [B('inventory-and-stock-management', 'इन्वेंटरी व स्टॉक प्रबंधन')],
    cookbook: ['cash-sale', 'closing-stock'],
  },
  housing: {
    guide: [G('society-type-entries', 'समिति-प्रकार अनुसार एंट्रियाँ')],
    blog: [B('membership-rights-and-duties', 'सदस्यता: अधिकार व कर्तव्य')],
    cookbook: ['member-deposit', 'outstanding-expense'],
  },
  sugar: {
    guide: [G('society-type-entries', 'समिति-प्रकार अनुसार एंट्रियाँ')],
    blog: [B('cooperative-society-types-guide', 'सहकारी समितियों के प्रकार')],
    cookbook: ['asset-purchase', 'depreciation'],
  },
  labour: {
    guide: [G('salary-management', 'वेतन प्रबंधन')],
    blog: [B('salary-and-payroll-accounting', 'वेतन व पेरोल लेखांकन')],
    cookbook: ['salary-paid', 'epf-esi-deposit'],
  },
  multipurpose: {
    guide: [G('society-type-entries', 'समिति-प्रकार अनुसार एंट्रियाँ')],
    blog: [B('cooperative-society-types-guide', 'सहकारी समितियों के प्रकार')],
    help: ['first-voucher'],
  },
};

export const STATE_CONTENT: Record<string, SurfaceLinks> = {
  haryana: {
    guide: [G('msp-procurement-entries', 'MSP खरीद व HAFED एंट्रियाँ')],
    blog: [B('kcc-crop-loan-accounting', 'KCC व फसली ऋण का लेखांकन'), B('gst-for-cooperatives', 'सहकारी समितियों के लिए GST')],
    cookbook: ['farmer-payment-msp', 'hafed-procurement-commission', 'mandi-fee-hrdf', 'milk-procurement'],
  },
};

/* ---------------- tiny pure helpers ---------------- */

export function helpForBlog(blogSlug: string): string[] {
  return BLOG_HELP[blogSlug] || [];
}

export function blogForGlossary(glossarySlug: string): Ref | null {
  return GLOSSARY_BLOG[glossarySlug] || null;
}

export function cookbookForHelp(helpSlug: string): string[] {
  return HELP_COOKBOOK[helpSlug] || [];
}

export function cookbookForCalc(calcSlug: string): string[] {
  return CALC_COOKBOOK[calcSlug] || [];
}

export function contentForSociety(typeSlug: string): SurfaceLinks {
  return SOCIETY_CONTENT[typeSlug] || {};
}

export function contentForState(stateSlug: string): SurfaceLinks {
  return STATE_CONTENT[stateSlug] || {};
}
