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
  {
    slug: 'receive-payment',
    metaTitle: 'ग्राहक से वसूली की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'उधार बिक्री का पैसा ग्राहक से मिलने का journal — Dr Cash/Bank, Cr ग्राहक (Sundry Debtor)। बिल-वार निपटान सहित।',
    category: 'भुगतान व वसूली',
    title: 'ग्राहक से वसूली (Receive Payment)',
    intent: 'customer se vasooli receive payment entry',
    scenario: 'पहले उधार बेचे माल का पैसा ग्राहक से अब मिला।',
    lines: [
      { account: 'Cash / Bank', type: 'Dr' },
      { account: 'ग्राहक — Sundry Debtor (3303)', type: 'Cr' },
    ],
    narration: 'वसूली — ग्राहक ___, बिल सं. ___ के विरुद्ध',
    notes: ['App में Receive Payment से करें तो किस बिल के विरुद्ध है यह bill-wise सेट कर सकते हैं।'],
    deepLink: { route: '/receive-payment', label: 'App में वसूली दर्ज करें' },
    guideSlug: 'bill-wise-settlement',
    related: ['credit-sale', 'make-payment'],
  },
  {
    slug: 'make-payment',
    metaTitle: 'आपूर्तिकर्ता को भुगतान की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'उधार खरीद का भुगतान आपूर्तिकर्ता को करने का journal — Dr आपूर्तिकर्ता (Sundry Creditor), Cr Cash/Bank।',
    category: 'भुगतान व वसूली',
    title: 'आपूर्तिकर्ता को भुगतान (Make Payment)',
    intent: 'supplier ko bhugtan make payment entry',
    scenario: 'पहले उधार खरीदे माल का भुगतान आपूर्तिकर्ता को अब किया।',
    lines: [
      { account: 'आपूर्तिकर्ता — Sundry Creditor (2101)', type: 'Dr' },
      { account: 'Cash / Bank', type: 'Cr' },
    ],
    narration: 'भुगतान — आपूर्तिकर्ता ___, बिल सं. ___ के विरुद्ध',
    notes: ['App में Make Payment से bill-wise निपटान करें ताकि बकाया सही घटे।'],
    deepLink: { route: '/make-payment', label: 'App में भुगतान दर्ज करें' },
    guideSlug: 'bill-wise-settlement',
    related: ['credit-purchase', 'receive-payment'],
  },
  {
    slug: 'cash-deposit-to-bank',
    metaTitle: 'नकद बैंक में जमा (Contra) की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'नकद बैंक में जमा करने का contra journal — Dr Bank, Cr Cash। यह आय-व्यय नहीं, सिर्फ़ जगह बदली।',
    category: 'बैंक',
    title: 'नकद बैंक में जमा (Contra)',
    intent: 'cash bank me jama contra entry',
    scenario: 'हाथ का नकद बैंक खाते में जमा किया।',
    lines: [
      { account: 'Bank', type: 'Dr' },
      { account: 'Cash (नकद)', type: 'Cr' },
    ],
    narration: 'नकद बैंक में जमा — तारीख ___',
    notes: ['यह Contra voucher है — न आय है न व्यय, सिर्फ़ नकद से बैंक में पैसा गया। Receipts & Payments में यह नहीं गिना जाता।'],
    deepLink: { route: '/vouchers', label: 'App में Contra voucher करें' },
    guideSlug: 'voucher-types',
    related: ['bank-withdrawal-to-cash', 'cash-sale'],
  },
  {
    slug: 'bank-withdrawal-to-cash',
    metaTitle: 'बैंक से नकद निकासी (Contra) की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'बैंक से नकद निकालने का contra journal — Dr Cash, Cr Bank।',
    category: 'बैंक',
    title: 'बैंक से नकद निकासी (Contra)',
    intent: 'bank se nakad nikasi contra entry',
    scenario: 'बैंक खाते से नकद निकाला (हाथ में लिया)।',
    lines: [
      { account: 'Cash (नकद)', type: 'Dr' },
      { account: 'Bank', type: 'Cr' },
    ],
    narration: 'बैंक से नकद निकासी — तारीख ___',
    notes: ['Contra voucher — सिर्फ़ बैंक से नकद में जगह बदली, कोई आय/व्यय नहीं।'],
    deepLink: { route: '/vouchers', label: 'App में Contra voucher करें' },
    guideSlug: 'voucher-types',
    related: ['cash-deposit-to-bank'],
  },
  {
    slug: 'loan-recovery',
    metaTitle: 'ऋण मूल वसूली की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'ऋण की मूल राशि (principal) वापस आने का journal — Dr Cash/Bank, Cr Loans & Advances। ब्याज अलग।',
    category: 'लोन व ब्याज',
    title: 'ऋण मूल वसूली (Loan Recovery)',
    intent: 'loan recovery principal vasooli entry',
    scenario: 'सदस्य ने ऋण की मूल राशि लौटाई।',
    lines: [
      { account: 'Cash / Bank', type: 'Dr' },
      { account: 'Loans & Advances / ऋण (3304)', type: 'Cr', note: 'संपत्ति घटी' },
    ],
    narration: 'ऋण मूल वसूली — सदस्य ___, ऋण सं. ___',
    notes: ['ब्याज की वसूली अलग entry है (Dr Cash, Cr Interest Income) — मूल व ब्याज को कभी एक न मिलाएँ।'],
    deepLink: { route: '/loan-register', label: 'App में ऋण देखें' },
    guideSlug: 'member-management',
    related: ['loan-disbursed', 'loan-interest-received'],
  },
  {
    slug: 'asset-purchase',
    metaTitle: 'संपत्ति खरीद की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'फर्नीचर/कंप्यूटर आदि संपत्ति खरीदने का journal — Dr Asset (संपत्ति), Cr Cash/Bank। यह खर्च नहीं।',
    category: 'संपत्ति',
    title: 'संपत्ति खरीद (Asset Purchase)',
    intent: 'asset purchase sampatti kharid entry',
    scenario: 'समिति ने स्थायी संपत्ति (फर्नीचर/कंप्यूटर/वाहन) खरीदी।',
    lines: [
      { account: 'सम्बंधित संपत्ति — Fixed Asset', type: 'Dr', note: 'संपत्ति, खर्च नहीं' },
      { account: 'Cash / Bank', type: 'Cr' },
    ],
    narration: 'संपत्ति खरीद — ___, बिल सं. ___',
    notes: [
      'संपत्ति को खर्च न मानें — यह बैलेंस शीट में रहती है, और हर साल इस पर डेप्रिसिएशन लगता है।',
      'App में Asset Register में जोड़ें ताकि डेप्रिसिएशन अपने-आप गणना हो।',
    ],
    deepLink: { route: '/asset-register', label: 'App में संपत्ति जोड़ें' },
    guideSlug: 'depreciation',
    related: ['depreciation', 'cash-purchase'],
  },
  {
    slug: 'rent-paid',
    metaTitle: 'किराया भुगतान की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'किराया देने का journal — Dr Rent (व्यय), Cr Cash/Bank। किराये पर TDS लागू हो तो अलग कटौती।',
    category: 'खर्च',
    title: 'किराया भुगतान (Rent Paid)',
    intent: 'rent paid kiraya entry',
    scenario: 'समिति ने दफ़्तर/गोदाम का किराया दिया।',
    lines: [
      { account: 'Rent / किराया (व्यय)', type: 'Dr' },
      { account: 'Cash / Bank', type: 'Cr' },
    ],
    narration: 'किराया भुगतान — ___ माह',
    notes: ['सीमा से ऊपर किराये पर TDS लागू हो सकता है — तब Cr में TDS Payable अलग। नियम के लिए ऑडिटर से पुष्टि करें।'],
    deepLink: { route: '/vouchers', label: 'App में payment voucher करें' },
    guideSlug: 'expense-dictionary',
    related: ['expense-paid', 'salary-paid'],
  },
  {
    slug: 'expense-paid',
    metaTitle: 'सामान्य खर्च की एंट्री — बिजली/स्टेशनरी/मरम्मत | SahakarLekha',
    metaDescription: 'रोज़मर्रा के खर्च का journal — Dr सम्बंधित व्यय खाता, Cr Cash/Bank। सही व्यय खाते में डालें।',
    category: 'खर्च',
    title: 'सामान्य खर्च (Expense Paid)',
    intent: 'expense paid kharch bijli stationery entry',
    scenario: 'बिजली, स्टेशनरी, मरम्मत, यात्रा आदि कोई खर्च नकद/बैंक से किया।',
    lines: [
      { account: 'सम्बंधित व्यय (जैसे बिजली/स्टेशनरी)', type: 'Dr' },
      { account: 'Cash / Bank', type: 'Cr' },
    ],
    narration: 'खर्च — ___ (विवरण)',
    notes: ['हर खर्च को उसके सही व्यय खाते में डालें — सब "विविध खर्च" में न डालें, वरना रिपोर्ट बेकार हो जाती है।'],
    deepLink: { route: '/vouchers', label: 'App में payment voucher करें' },
    guideSlug: 'expense-dictionary',
    related: ['rent-paid'],
  },
  {
    slug: 'share-refund-on-exit',
    metaTitle: 'सदस्य निकासी पर शेयर वापसी की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'सदस्य के समिति छोड़ने पर शेयर पूँजी लौटाने का journal — Dr Share Capital, Cr Cash/Bank।',
    category: 'सदस्य व शेयर',
    title: 'शेयर वापसी — सदस्य निकासी',
    intent: 'share refund member exit nikasi entry',
    scenario: 'सदस्य ने समिति छोड़ी और उसकी शेयर पूँजी लौटानी है।',
    lines: [
      { account: 'Share Capital / शेयर पूँजी', type: 'Dr', note: 'पूँजी घटी' },
      { account: 'Cash / Bank', type: 'Cr' },
    ],
    narration: 'शेयर वापसी — सदस्य ___ की निकासी',
    notes: ['शेयर वापसी बायलॉज़ व राज्य नियमों के अधीन है (कई जगह सीमा/शर्तें होती हैं) — अपने RCS/ऑडिटर से पुष्टि करें।'],
    deepLink: { route: '/members', label: 'App में सदस्य देखें' },
    guideSlug: 'member-management',
    related: ['member-share-capital', 'profit-distribution-reserve'],
  },
  {
    slug: 'fixed-deposit',
    metaTitle: 'फिक्स्ड डिपॉज़िट (FD) की एंट्री — Dr/Cr | SahakarLekha',
    metaDescription: 'बैंक में FD करने का journal — Dr Fixed Deposit (निवेश/संपत्ति), Cr Bank। ब्याज मिलने पर आय।',
    category: 'बैंक',
    title: 'फिक्स्ड डिपॉज़िट (FD)',
    intent: 'fixed deposit fd investment entry',
    scenario: 'समिति ने बचत राशि बैंक में FD के रूप में रखी।',
    lines: [
      { account: 'Fixed Deposit / सावधि जमा (निवेश)', type: 'Dr', note: 'संपत्ति' },
      { account: 'Bank', type: 'Cr' },
    ],
    narration: 'FD — बैंक ___, FD सं. ___',
    notes: ['FD पर ब्याज मिलने पर अलग entry: Dr Bank/FD, Cr Interest Income। FD पर भी TDS कट सकता है।'],
    deepLink: { route: '/vouchers', label: 'App में voucher करें' },
    related: ['cash-deposit-to-bank'],
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
