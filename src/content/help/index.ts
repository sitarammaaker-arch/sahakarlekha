/**
 * Help Center — the DO layer (task-oriented "kaise kare" articles), distinct from
 * the /guide course (LEARN) and /blog (narrative). This is the first consumer of
 * the Knowledge Object model: each HelpTask is a typed KO with the standard envelope
 * (Constitution Art. VI / X) PLUS the two things that make this layer unique —
 *   1. a deep-link CTA into the exact app screen (Product-Led Growth loop), and
 *   2. a canonical-by-intent link DOWN to the in-depth guide chapter (Law L7),
 *      so the how-to stays short and never duplicates the guide.
 *
 * Slugs are English (per the project convention); titles/body are everyday Hinglish
 * (per the writing-style rule). Keep articles short (<= ~600 words, steps-first, L8).
 */
export interface HelpFaq { q: string; a: string }
export interface HelpPrereq { label: string; slug?: string }

export interface HelpTask {
  /** English, stable URL slug → /help/<slug> */
  slug: string;
  /** <title> + og:title */
  metaTitle: string;
  /** meta description + og:description */
  metaDescription: string;
  /** category chip (Hindi) */
  category: string;
  /** on-page H1 (Hinglish) */
  title: string;
  /** the literal search query this answers (e.g. "member kaise jode") */
  intent: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** e.g. "3 मिनट" */
  estTime: string;
  /** 1–2 line atomic answer shown at top + used by AI engines (Art. VIII/IX) */
  tldr: string;
  prerequisites?: HelpPrereq[];
  /** numbered steps, each a short Hinglish line */
  steps: string[];
  commonMistakes?: string[];
  faqs?: HelpFaq[];
  /** PLG CTA: the exact app route to perform this task + button label */
  deepLink: { route: string; label: string };
  /** "पूरा समझें" → in-depth guide chapter slug (canonical-by-intent, L7) */
  guideSlug?: string;
  /** related help-task slugs */
  related?: string[];
}

export const HELP_TASKS: HelpTask[] = [
  {
    slug: 'add-member',
    metaTitle: 'सहकारी समिति में Member कैसे जोड़ें — स्टेप बाय स्टेप | SahakarLekha',
    metaDescription: 'नया सदस्य जोड़ना, शेयर पूँजी व प्रवेश शुल्क की एंट्री और अप्रूवल — 3 मिनट में। शेयर पूँजी का receipt voucher अपने-आप बनता है।',
    category: 'सदस्य व शेयर',
    title: 'Member कैसे जोड़ें',
    intent: 'member kaise jode',
    difficulty: 'beginner',
    estTime: '3 मिनट',
    tldr: 'Members पेज खोलें → "नया सदस्य" → नाम, सदस्य ID, शेयर पूँजी व प्रवेश शुल्क भरें → सेव करें। शेयर पूँजी का receipt voucher अपने-आप बन जाता है।',
    prerequisites: [{ label: 'समिति सेटअप एक बार पूरा कर लें', slug: undefined }],
    steps: [
      'बाईं ओर के मेन्यू से **Members (सदस्य)** पेज खोलें।',
      '**"नया सदस्य / Add Member"** बटन दबाएँ।',
      'सदस्य का नाम, अलग सदस्य ID, और जॉइनिंग तारीख भरें।',
      '**शेयर पूँजी** और (अगर लागू हो) **प्रवेश शुल्क** की राशि अलग-अलग भरें — दोनों एक नहीं हैं।',
      '**सेव** करें। शेयर पूँजी व प्रवेश शुल्क का receipt voucher अपने-आप बन जाता है, इसलिए अलग से voucher बनाने की ज़रूरत नहीं।',
      'अगर अप्रूवल ज़रूरी है तो सदस्य "pending" दिखेगा — अप्रूव करने पर ही उसके voucher बनते हैं।',
    ],
    commonMistakes: [
      'शेयर पूँजी और प्रवेश शुल्क को एक ही फ़ील्ड में जोड़ देना — इन्हें अलग रखें, वरना रिपोर्ट में हिसाब गड़बड़ होगा।',
      'सदस्य जोड़ने के बाद उसी का अलग से manual share-capital voucher भी बना देना — इससे डबल एंट्री हो जाती है। App खुद voucher बनाता है।',
    ],
    faqs: [
      { q: 'क्या शेयर पूँजी का voucher अलग से बनाना पड़ता है?', a: 'नहीं। सदस्य सेव करते ही (या अप्रूव करते ही) शेयर पूँजी और प्रवेश शुल्क का receipt voucher अपने-आप बन जाता है।' },
      { q: 'सदस्य ID क्या होनी चाहिए?', a: 'कोई भी यूनिक नंबर/कोड — पर हर सदस्य की अलग होनी चाहिए, वरना app डुप्लिकेट की चेतावनी देगा।' },
    ],
    deepLink: { route: '/members', label: 'SahakarLekha में अभी Member जोड़ें' },
    guideSlug: 'member-management',
    related: ['opening-balances', 'first-voucher'],
  },
  {
    slug: 'opening-balances',
    metaTitle: 'Opening Balance कैसे डालें — सहकारी समिति लेखांकन | SahakarLekha',
    metaDescription: 'पिछले साल के क्लोज़िंग बैलेंस इस साल के ओपनिंग बैलेंस में डालना — Dr=Cr मिलान सहित। "बैलेंस शीट क्यों नहीं मिल रही" की जड़ यहीं है।',
    category: 'शुरुआत',
    title: 'Opening Balance कैसे डालें',
    intent: 'opening balance kaise dale',
    difficulty: 'beginner',
    estTime: '5 मिनट',
    tldr: 'Society Setup → Opening Balances खोलें → हर खाते का पिछले साल का बंद बैलेंस उसके Dr/Cr साइड में भरें → कुल Dr = कुल Cr होना चाहिए → सेव करें।',
    prerequisites: [
      { label: 'Chart of Accounts (लेजर हेड) तैयार हों', slug: undefined },
      { label: 'पिछले साल की बैलेंस शीट सामने रखें', slug: undefined },
    ],
    steps: [
      '**Society Setup → Opening Balances** पेज खोलें।',
      'हर खाते के सामने उसका पिछले साल का **बंद (closing) बैलेंस** भरें।',
      'खाता संपत्ति/खर्च है तो **Dr** साइड, देनदारी/पूँजी/आय है तो **Cr** साइड में राशि डालें।',
      'नीचे दिख रहे **कुल Dr और कुल Cr को बराबर** करें — अगर बराबर नहीं, तो कोई बैलेंस छूटा है।',
      '**सेव** करें। अब इस साल की बैलेंस शीट सही base से शुरू होगी।',
    ],
    commonMistakes: [
      'Dr और Cr का कुल बराबर न होना — यही "बैलेंस शीट नहीं मिल रही" की सबसे आम वजह है।',
      'किसी खाते को गलत साइड (Dr की जगह Cr) में डालना — संपत्ति हमेशा Dr, देनदारी/पूँजी हमेशा Cr।',
    ],
    faqs: [
      { q: 'ओपनिंग बैलेंस कब डालें?', a: 'नई समिति शुरू करते समय या किसी पुरानी समिति को पहली बार app में लाते समय — पिछले साल के बंद बैलेंस से।' },
      { q: 'बैलेंस शीट नहीं मिल रही, क्या करूँ?', a: 'सबसे पहले Opening Balances में कुल Dr = कुल Cr जाँचें — ज़्यादातर अंतर यहीं से आता है।' },
    ],
    deepLink: { route: '/opening-balances', label: 'SahakarLekha में Opening Balance डालें' },
    guideSlug: 'opening-balances',
    related: ['add-member', 'first-voucher'],
  },
  {
    slug: 'first-voucher',
    metaTitle: 'पहला Voucher कैसे करें — Receipt, Payment, Journal | SahakarLekha',
    metaDescription: '"पैसा आया या गया" से Dr/Cr तय करना, और receipt/payment/journal voucher सही भरना — उदाहरण सहित, सहकारी समिति के लिए।',
    category: 'वाउचर एंट्री',
    title: 'पहला Voucher कैसे करें',
    intent: 'voucher kaise kare',
    difficulty: 'beginner',
    estTime: '4 मिनट',
    tldr: 'Vouchers पेज खोलें → प्रकार चुनें (पैसा आया = Receipt, पैसा गया = Payment) → तारीख, खाता और राशि भरें → सेव। Cash Book, Bank Book व रिपोर्ट अपने-आप अपडेट हो जाती हैं।',
    prerequisites: [{ label: 'ज़रूरी लेजर हेड बने हों', slug: undefined }],
    steps: [
      'मेन्यू से **Vouchers (वाउचर)** पेज खोलें।',
      'प्रकार चुनें: पैसा **आया** तो **Receipt**, पैसा **गया** तो **Payment**, सिर्फ़ खातों के बीच समायोजन तो **Journal**, और नकद↔बैंक हेर-फेर तो **Contra**।',
      'तारीख, सामने वाला खाता, और राशि भरें — "आसान मोड" में app खुद Dr/Cr लगा देता है।',
      'विवरण (narration) में छोटा-सा कारण लिखें, ताकि बाद में समझ आए।',
      '**सेव** करें। Cash/Bank Book और सभी रिपोर्ट अपने-आप अपडेट हो जाती हैं।',
    ],
    commonMistakes: [
      'Receipt और Payment में उलझ जाना — हमेशा सोचें "पैसा आया या गया"।',
      'FY लॉक होने पर एंट्री करने की कोशिश — पहले उसी वर्ष को अनलॉक करें।',
    ],
    faqs: [
      { q: 'कौन-सा voucher कब?', a: 'पैसा आया → Receipt, पैसा गया → Payment, खातों के बीच बिना नकदी समायोजन → Journal, नकद↔बैंक → Contra।' },
      { q: 'क्या मुझे खुद Dr/Cr तय करना होगा?', a: 'आसान मोड में नहीं — app खुद लगा देता है। विशेषज्ञ मोड में आप multi-line एंट्री खुद कर सकते हैं।' },
    ],
    deepLink: { route: '/vouchers', label: 'SahakarLekha में अभी Voucher करें' },
    guideSlug: 'voucher-types',
    related: ['add-member', 'opening-balances'],
  },
];

export function findHelpTask(slug: string): HelpTask | null {
  return HELP_TASKS.find((t) => t.slug === slug) ?? null;
}

/** Distinct categories in first-seen order, for the hub. */
export const HELP_CATEGORIES: string[] = HELP_TASKS.reduce<string[]>((acc, t) => {
  if (!acc.includes(t.category)) acc.push(t.category);
  return acc;
}, []);

export function relatedHelpTasks(slug: string): HelpTask[] {
  const self = findHelpTask(slug);
  if (!self?.related) return [];
  return self.related.map(findHelpTask).filter((t): t is HelpTask => !!t);
}
