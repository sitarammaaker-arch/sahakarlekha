/**
 * Entry Cookbook — the REFERENCE layer: a searchable library of "to record X,
 * Dr/Cr this" cooperative accounting entries. Distinct from /guide (LEARN),
 * /blog (narrative) and /help (DO/task). Each entry is a typed Knowledge Object:
 * a real scenario + the journal posting (Dr/Cr lines) + narration + notes, with
 * an optional deep-link into the app and a "पूरा समझें" guide cross-link (L7).
 *
 * Account names mirror SahakarLekha's standard chart (Cash, 4101 Sales, 5101
 * Purchases, 3304 Loans & Advances, 5201 Salary, 3403 Closing Stock, etc.).
 * Slugs English; titles/body everyday Hinglish. IMPORTANT: this is reference
 * education, not a ruling — entries note when to verify with the auditor.
 */
export interface CookbookLine { account: string; type: 'Dr' | 'Cr'; note?: string }

export interface CookbookEntry {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  category: string;
  title: string;
  intent: string;
  /** when this entry applies (1–2 lines) */
  scenario: string;
  /** the journal posting */
  lines: CookbookLine[];
  /** example narration to type in the voucher */
  narration: string;
  /** society types this is typical for (optional) */
  societyTypes?: string[];
  /** gotchas / variants */
  notes?: string[];
  /** optional: do it in the app */
  deepLink?: { route: string; label: string };
  /** related in-depth guide chapter (L7) */
  guideSlug?: string;
  related?: string[];
}

export const COOKBOOK_ENTRIES: CookbookEntry[] = [
  {
    slug: 'cash-sale',
    metaTitle: 'नकद बिक्री की एंट्री — Dr/Cr कैसे करें | SahakarLekha',
    metaDescription: 'नकद बिक्री का journal — Dr Cash, Cr Sales। GST लगने पर Output GST अलग। सहकारी समिति के लिए उदाहरण सहित।',
    category: 'खरीद-बिक्री',
    title: 'नकद बिक्री (Cash Sale)',
    intent: 'cash sale ki entry',
    scenario: 'समिति ने माल नकद में बेचा (पैसा तुरंत मिला)।',
    lines: [
      { account: 'Cash (नकद)', type: 'Dr' },
      { account: 'Sales / बिक्री (4101)', type: 'Cr' },
      { account: 'Output GST (अगर लागू)', type: 'Cr', note: 'सिर्फ़ तब जब बिल पर GST लिया हो' },
    ],
    narration: 'नकद बिक्री — बिल सं. ___',
    notes: [
      'App में Sale Management से करें तो यह voucher अपने-आप बनता है और स्टॉक भी घटता है।',
      'अलग-अलग category के माल पर अलग Sales खाता (per-item routing) रखें ताकि रिपोर्ट साफ़ रहे।',
    ],
    deepLink: { route: '/sales', label: 'App में बिक्री दर्ज करें' },
    guideSlug: 'sales-entries',
    related: ['credit-sale', 'cash-purchase'],
  },
  {
    slug: 'credit-sale',
    metaTitle: 'उधार बिक्री की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'उधार बिक्री का journal — Dr ग्राहक (Sundry Debtor), Cr Sales। बाद में वसूली पर Dr Cash, Cr ग्राहक।',
    category: 'खरीद-बिक्री',
    title: 'उधार बिक्री (Credit Sale)',
    intent: 'credit sale udhaar bikri entry',
    scenario: 'माल उधार बेचा — पैसा बाद में आना है।',
    lines: [
      { account: 'ग्राहक — Sundry Debtor (3303)', type: 'Dr' },
      { account: 'Sales / बिक्री (4101)', type: 'Cr' },
    ],
    narration: 'उधार बिक्री — ___ को, बिल सं. ___',
    notes: [
      'जब पैसा आए तब अलग receipt: Dr Cash/Bank, Cr वही ग्राहक खाता।',
      'हर ग्राहक का अलग sub-ledger रखें ताकि बकाया साफ़ दिखे।',
    ],
    deepLink: { route: '/sales', label: 'App में बिक्री दर्ज करें' },
    guideSlug: 'sales-entries',
    related: ['cash-sale', 'receive-payment'],
  },
  {
    slug: 'cash-purchase',
    metaTitle: 'नकद खरीद की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'नकद खरीद का journal — Dr Purchases, Cr Cash। GST input अलग खाते में।',
    category: 'खरीद-बिक्री',
    title: 'नकद खरीद (Cash Purchase)',
    intent: 'cash purchase kharid entry',
    scenario: 'समिति ने माल नकद में खरीदा।',
    lines: [
      { account: 'Purchases / खरीद (5101)', type: 'Dr' },
      { account: 'Input GST (अगर लागू)', type: 'Dr', note: 'GST बिल पर ही' },
      { account: 'Cash (नकद)', type: 'Cr' },
    ],
    narration: 'नकद खरीद — ___ से, बिल सं. ___',
    notes: ['App में Purchase Management से करें तो स्टॉक अपने-आप बढ़ता है।'],
    deepLink: { route: '/purchases', label: 'App में खरीद दर्ज करें' },
    guideSlug: 'purchase-entries',
    related: ['credit-purchase', 'cash-sale'],
  },
  {
    slug: 'credit-purchase',
    metaTitle: 'उधार खरीद की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'उधार खरीद का journal — Dr Purchases, Cr आपूर्तिकर्ता (Sundry Creditor)। भुगतान बाद में।',
    category: 'खरीद-बिक्री',
    title: 'उधार खरीद (Credit Purchase)',
    intent: 'credit purchase udhaar kharid entry',
    scenario: 'माल उधार खरीदा — भुगतान बाद में करना है।',
    lines: [
      { account: 'Purchases / खरीद (5101)', type: 'Dr' },
      { account: 'आपूर्तिकर्ता — Sundry Creditor (2101)', type: 'Cr' },
    ],
    narration: 'उधार खरीद — ___ से, बिल सं. ___',
    notes: ['भुगतान करते समय: Dr वही आपूर्तिकर्ता खाता, Cr Cash/Bank।'],
    deepLink: { route: '/purchases', label: 'App में खरीद दर्ज करें' },
    guideSlug: 'purchase-entries',
    related: ['cash-purchase', 'make-payment'],
  },
  {
    slug: 'member-share-capital',
    metaTitle: 'सदस्य शेयर पूँजी की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'सदस्य से शेयर पूँजी मिलने का journal — Dr Cash, Cr Share Capital। प्रवेश शुल्क अलग खाते में।',
    category: 'सदस्य व शेयर',
    title: 'शेयर पूँजी प्राप्त (Share Capital)',
    intent: 'share capital ki entry',
    scenario: 'नए/मौजूदा सदस्य ने शेयर पूँजी जमा की।',
    lines: [
      { account: 'Cash (नकद)', type: 'Dr' },
      { account: 'Share Capital / शेयर पूँजी', type: 'Cr' },
      { account: 'Admission Fee / प्रवेश शुल्क (अगर साथ लिया)', type: 'Cr', note: 'शेयर पूँजी से अलग आय है' },
    ],
    narration: 'शेयर पूँजी प्राप्त — सदस्य ___',
    notes: [
      'App में Members से सदस्य जोड़ें तो यह voucher अपने-आप बनता है — अलग से न बनाएँ (डबल एंट्री से बचें)।',
      'प्रवेश शुल्क आय है, शेयर पूँजी देनदारी/पूँजी — दोनों को कभी एक न मिलाएँ।',
    ],
    deepLink: { route: '/members', label: 'App में सदस्य जोड़ें' },
    guideSlug: 'member-management',
    related: ['dividend-declared', 'loan-disbursed'],
  },
  {
    slug: 'loan-disbursed',
    metaTitle: 'सदस्य ऋण वितरण की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'ऋण देने का journal — Dr Loans & Advances (संपत्ति), Cr Cash। ऋण खर्च नहीं, संपत्ति है।',
    category: 'लोन व ब्याज',
    title: 'ऋण वितरण (Loan Disbursed)',
    intent: 'loan disbursement entry',
    scenario: 'समिति ने सदस्य को ऋण दिया।',
    lines: [
      { account: 'Loans & Advances / ऋण (3304)', type: 'Dr', note: 'संपत्ति — वापस आना है' },
      { account: 'Cash / Bank', type: 'Cr' },
    ],
    narration: 'ऋण वितरण — सदस्य ___, ऋण सं. ___',
    notes: ['App में Loan Register से करें तो यह voucher अपने-आप बनता है।', 'ऋण को कभी खर्च न मानें — यह संपत्ति है।'],
    deepLink: { route: '/loan-register', label: 'App में ऋण दर्ज करें' },
    guideSlug: 'member-management',
    related: ['loan-interest-received', 'member-share-capital'],
  },
  {
    slug: 'loan-interest-received',
    metaTitle: 'ऋण ब्याज प्राप्ति की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'ऋण पर ब्याज मिलने का journal — Dr Cash, Cr Interest Income (आय)।',
    category: 'लोन व ब्याज',
    title: 'ऋण ब्याज प्राप्त (Loan Interest)',
    intent: 'loan interest received entry',
    scenario: 'सदस्य ने ऋण पर ब्याज चुकाया।',
    lines: [
      { account: 'Cash / Bank', type: 'Dr' },
      { account: 'Interest Income / ब्याज आय', type: 'Cr' },
    ],
    narration: 'ऋण ब्याज प्राप्त — सदस्य ___, ऋण सं. ___',
    notes: ['मूल वसूली (principal) अलग होती है: Dr Cash, Cr Loans & Advances। ब्याज को principal से न मिलाएँ।'],
    guideSlug: 'member-management',
    related: ['loan-disbursed'],
  },
  {
    slug: 'salary-paid',
    metaTitle: 'वेतन भुगतान की एंट्री — कटौती सहित Dr/Cr | SahakarLekha',
    metaDescription: 'वेतन का journal — Dr Salary (सकल), Cr Cash/Bank (शुद्ध) और Cr EPF/ESI/TDS payable (कटौती)।',
    category: 'वेतन',
    title: 'वेतन भुगतान (Salary, कटौती सहित)',
    intent: 'salary payment entry with deductions',
    scenario: 'कर्मचारी को वेतन दिया, जिसमें EPF/TDS आदि कटौती है।',
    lines: [
      { account: 'Salary / वेतन (5201)', type: 'Dr', note: 'सकल (gross) वेतन' },
      { account: 'Cash / Bank', type: 'Cr', note: 'शुद्ध (net) — जो हाथ में दिया' },
      { account: 'EPF/ESI/TDS Payable / देय कटौती', type: 'Cr', note: 'जो काटा, बाद में जमा होगा' },
    ],
    narration: 'वेतन भुगतान — ___ माह, कर्मचारी ___',
    notes: [
      'कटौती (EPF/TDS) देनदारी है — जब विभाग में जमा करें तब: Dr वही Payable, Cr Cash/Bank।',
      'App में Salary Management से slip बनाएँ तो यह सब अपने-आप होता है।',
    ],
    deepLink: { route: '/salary', label: 'App में वेतन दर्ज करें' },
    guideSlug: 'salary-management',
    related: ['bank-charges'],
  },
  {
    slug: 'bank-charges',
    metaTitle: 'बैंक प्रभार व ब्याज की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'बैंक प्रभार: Dr Bank Charges, Cr Bank। बैंक ब्याज: Dr Bank, Cr Interest Income। BRS में अक्सर छूटते हैं।',
    category: 'बैंक',
    title: 'बैंक प्रभार / बैंक ब्याज',
    intent: 'bank charges interest entry',
    scenario: 'बैंक ने प्रभार काटा या ब्याज जमा किया (स्टेटमेंट में दिखा)।',
    lines: [
      { account: 'Bank Charges / बैंक प्रभार (व्यय)', type: 'Dr', note: 'प्रभार की स्थिति में' },
      { account: 'Bank', type: 'Cr', note: 'प्रभार की स्थिति में' },
    ],
    narration: 'बैंक प्रभार — स्टेटमेंट तारीख ___',
    notes: [
      'बैंक ब्याज जमा हो तो उल्टा: Dr Bank, Cr Interest Income (आय)।',
      'ये entries Bank Reconciliation में सबसे आम छूट हैं — स्टेटमेंट से ज़रूर मिलाएँ।',
    ],
    deepLink: { route: '/bank-reconciliation', label: 'App में BRS करें' },
    guideSlug: 'daybook-and-ledger',
    related: ['salary-paid'],
  },
  {
    slug: 'depreciation',
    metaTitle: 'डेप्रिसिएशन की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'घिसाई का journal — Dr Depreciation (व्यय), Cr Accumulated Depreciation। साल के अंत में।',
    category: 'साल-अंत',
    title: 'डेप्रिसिएशन (Depreciation)',
    intent: 'depreciation ki entry',
    scenario: 'साल के अंत में संपत्ति पर घिसाई लगानी है।',
    lines: [
      { account: 'Depreciation / डेप्रिसिएशन (व्यय)', type: 'Dr' },
      { account: 'Accumulated Depreciation / संचित घिसाई', type: 'Cr' },
    ],
    narration: 'डेप्रिसिएशन — वर्ष ___',
    notes: ['App में Depreciation Schedule से "Post" करें तो यह सबके लिए अपने-आप बनता है (SLM/WDV)।'],
    deepLink: { route: '/depreciation-schedule', label: 'App में डेप्रिसिएशन पोस्ट करें' },
    guideSlug: 'depreciation',
    related: ['closing-stock'],
  },
  {
    slug: 'closing-stock',
    metaTitle: 'क्लोज़िंग स्टॉक की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'साल के अंत क्लोज़िंग स्टॉक: Dr Closing Stock (संपत्ति 3403), Cr Trading/Purchases। डबल-काउंट से बचें।',
    category: 'साल-अंत',
    title: 'क्लोज़िंग स्टॉक (Closing Stock)',
    intent: 'closing stock entry',
    scenario: 'साल के अंत बचा हुआ माल books में लाना है।',
    lines: [
      { account: 'Closing Stock / समापन स्टॉक (3403)', type: 'Dr', note: 'संपत्ति' },
      { account: 'Closing Stock A/c — Trading (5150)', type: 'Cr' },
    ],
    narration: 'क्लोज़िंग स्टॉक — वर्ष ___',
    notes: [
      'App में Year-End / Closing Stock Report से "Post" करें तो यह सही मूल्य (वेटेड एवरेज) पर अपने-आप बनता है।',
      'क्लोज़िंग स्टॉक की गणना एक ही जगह से रखें — Trading और Balance Sheet दोनों में डबल-काउंट न हो।',
    ],
    deepLink: { route: '/closing-stock-report', label: 'App में क्लोज़िंग स्टॉक पोस्ट करें' },
    guideSlug: 'trading-account',
    related: ['depreciation', 'profit-distribution-reserve'],
  },
  {
    slug: 'hafed-procurement-commission',
    metaTitle: 'HAFED/MSP खरीद कमीशन की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'विपणन समिति का MSP खरीद कमीशन: Dr HAFED/एजेंसी प्राप्य, Cr Commission Income। बारदाना व सूखत अलग।',
    category: 'HAFED / MSP',
    title: 'HAFED/MSP खरीद कमीशन',
    intent: 'hafed msp commission entry',
    scenario: 'विपणन समिति ने HAFED/एजेंसी के लिए MSP पर खरीद की और कमीशन कमाया।',
    lines: [
      { account: 'HAFED / एजेंसी प्राप्य (Receivable)', type: 'Dr' },
      { account: 'Commission Income / कमीशन आय', type: 'Cr' },
    ],
    narration: 'MSP खरीद कमीशन — सीज़न ___',
    societyTypes: ['विपणन / Marketing', 'PACS'],
    notes: [
      'बारदाना (gunny) व सूखत (driage) का हिसाब अलग खातों में रखें — कमीशन में न मिलाएँ।',
      'किसान भुगतान व ऋण-कटौती अलग entries हैं। राज्य/एजेंसी के नियम बदल सकते हैं — अपने RCS/ऑडिटर से पुष्टि करें।',
    ],
    guideSlug: 'msp-procurement-entries',
    related: ['cash-purchase', 'credit-sale'],
  },
  {
    slug: 'profit-distribution-reserve',
    metaTitle: 'लाभ बँटवारा व रिज़र्व फंड की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'नेट प्रॉफ़िट से रिज़र्व फंड व डिविडेंड: Dr Profit Appropriation, Cr Reserve Fund / Dividend Payable।',
    category: 'साल-अंत',
    title: 'लाभ बँटवारा — रिज़र्व व डिविडेंड',
    intent: 'profit distribution reserve fund dividend entry',
    scenario: 'साल का नेट प्रॉफ़िट बाँटना है — पहले रिज़र्व फंड, फिर डिविडेंड/बोनस।',
    lines: [
      { account: 'Profit & Loss Appropriation / लाभ-बँटवारा', type: 'Dr' },
      { account: 'Reserve Fund / रिज़र्व फंड (25%)', type: 'Cr', note: 'पहले यही' },
      { account: 'Dividend Payable / देय डिविडेंड', type: 'Cr', note: 'मंज़ूरी के बाद' },
    ],
    narration: 'लाभ बँटवारा — वर्ष ___',
    notes: [
      'क्रम मायने रखता है: पहले कानूनी रिज़र्व फंड (आमतौर पर 25%), फिर बाँटने लायक मुनाफ़ा।',
      'डिविडेंड दर व बँटवारा आम सभा/बायलॉज़ व राज्य नियमों से तय होता है — अपने RCS/ऑडिटर से पुष्टि करें।',
    ],
    deepLink: { route: '/profit-distribution', label: 'App में लाभ बँटवारा करें' },
    guideSlug: 'profit-distribution',
    related: ['member-share-capital', 'closing-stock'],
  },
];

export function findCookbookEntry(slug: string): CookbookEntry | null {
  return COOKBOOK_ENTRIES.find((e) => e.slug === slug) ?? null;
}

export const COOKBOOK_CATEGORIES: string[] = COOKBOOK_ENTRIES.reduce<string[]>((acc, e) => {
  if (!acc.includes(e.category)) acc.push(e.category);
  return acc;
}, []);

export function relatedCookbookEntries(slug: string): CookbookEntry[] {
  const self = findCookbookEntry(slug);
  if (!self?.related) return [];
  return self.related.map(findCookbookEntry).filter((e): e is CookbookEntry => !!e);
}
