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
  /** ISO date of the last real content change — drives the sitemap <lastmod> */
  updated?: string;
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
  {
    slug: 'add-ledger',
    metaTitle: 'Ledger (खाता) कैसे बनाएं — सहकारी समिति लेखांकन | SahakarLekha',
    metaDescription: 'नया लेजर हेड बनाना, सही समूह (संपत्ति/देनदारी/आय/व्यय/पूँजी) चुनना और कोड देना — ताकि खाता हर voucher व रिपोर्ट में सही जगह दिखे।',
    category: 'खाता-बही',
    title: 'Ledger (खाता) कैसे बनाएं',
    intent: 'ledger kaise banaye',
    difficulty: 'beginner',
    estTime: '3 मिनट',
    tldr: 'Ledger Heads पेज खोलें → "नया खाता" → नाम और सही समूह (संपत्ति/देनदारी/आय/व्यय/पूँजी) चुनें → सेव। अब यह खाता voucher entry व रिपोर्ट में दिखेगा।',
    prerequisites: [{ label: 'मानक चार्ट पहले से बना मिलता है — पहले देख लें कि खाता मौजूद तो नहीं', slug: undefined }],
    steps: [
      'मेन्यू से **Ledger Heads (लेजर हेड)** पेज खोलें।',
      '**"नया खाता / Add"** दबाएँ।',
      'खाते का नाम लिखें और उसका सही **समूह** चुनें — संपत्ति, देनदारी, आय, व्यय या पूँजी।',
      'ज़रूरत हो तो parent समूह और कोड चुनें (मानक चार्ट पहले से तैयार रहता है)।',
      '**सेव** करें। अब यह खाता voucher entry व सभी रिपोर्ट में उपलब्ध रहेगा।',
    ],
    commonMistakes: [
      'खाते को गलत समूह में डालना — इससे वह गलत रिपोर्ट में (जैसे आय की जगह व्यय) चला जाता है।',
      'सिस्टम के बने-बनाए खाते (Cash, Bank आदि) की नकल बनाना — पहले जाँचें कि खाता पहले से तो नहीं है।',
    ],
    faqs: [
      { q: 'खाता किस समूह में डालूँ?', a: 'जो आपके पास है/मिलना है = संपत्ति; जो देना है = देनदारी; कमाई = आय; खर्च = व्यय; सदस्यों की पूँजी/रिज़र्व = पूँजी।' },
    ],
    deepLink: { route: '/ledger-heads', label: 'SahakarLekha में नया खाता बनाएं' },
    guideSlug: 'chart-of-accounts',
    related: ['first-voucher', 'opening-balances'],
  },
  {
    slug: 'view-trial-balance',
    metaTitle: 'Trial Balance कैसे देखें — सहकारी समिति | SahakarLekha',
    metaDescription: 'ट्रायल बैलेंस खोलना, "as on" तारीख चुनना और कुल Dr = कुल Cr जाँचना — और PDF डाउनलोड। न मिलने पर सबसे पहले कहाँ देखें।',
    category: 'रिपोर्ट्स',
    title: 'Trial Balance कैसे देखें',
    intent: 'trial balance kaise dekhe',
    difficulty: 'beginner',
    estTime: '2 मिनट',
    tldr: 'Trial Balance पेज खोलें → "as on" तारीख चुनें → हर खाते का Dr/Cr बैलेंस दिखेगा। नीचे कुल Dr = कुल Cr होना चाहिए। PDF बटन से डाउनलोड करें।',
    steps: [
      'मेन्यू से **Trial Balance** पेज खोलें।',
      'जिस तारीख तक का हिसाब चाहिए वह **"as on" तारीख** चुनें।',
      'हर खाते का Dr या Cr बैलेंस सूची में दिखेगा।',
      'नीचे **कुल Dr और कुल Cr बराबर** होने चाहिए — यही दोहरी-एंट्री के सही होने का सबूत है।',
      '**PDF** बटन से समिति के नाम व हस्ताक्षर ब्लॉक सहित डाउनलोड करें।',
    ],
    commonMistakes: [
      'Dr=Cr न मिलने पर घबराना — आमतौर पर Opening Balance का अंतर होता है; वहाँ पहले जाँचें।',
    ],
    faqs: [
      { q: 'Trial Balance क्यों ज़रूरी है?', a: 'यह जल्दी दिखा देता है कि सारी एंट्रियाँ संतुलित (Dr=Cr) हैं या नहीं — बैलेंस शीट बनाने से पहले का ज़रूरी चेक।' },
    ],
    deepLink: { route: '/trial-balance', label: 'SahakarLekha में Trial Balance देखें' },
    guideSlug: 'trial-balance',
    related: ['cash-book', 'opening-balances'],
  },
  {
    slug: 'cash-book',
    metaTitle: 'Cash Book कैसे देखें — नकद बही सहकारी समिति | SahakarLekha',
    metaDescription: 'नकद की हर आवक-जावक और चलता बैलेंस देखना। Cash Book vouchers से अपने-आप बनती है — हाथ से भरने की ज़रूरत नहीं।',
    category: 'रिपोर्ट्स',
    title: 'Cash Book कैसे देखें',
    intent: 'cash book kaise dekhe',
    difficulty: 'beginner',
    estTime: '2 मिनट',
    tldr: 'Cash Book पेज खोलें → तारीख-सीमा चुनें → नकद की हर आवक-जावक व चलता बैलेंस दिखेगा। यह receipt/payment vouchers से अपने-आप बनता है।',
    steps: [
      'मेन्यू से **Cash Book** पेज खोलें।',
      'जिस अवधि का नकद हिसाब चाहिए वह **तारीख-सीमा** चुनें।',
      'हर नकद रसीद (आवक) व भुगतान (जावक) और साथ में **चलता बैलेंस** दिखेगा।',
      'यह आप अलग से नहीं भरते — receipt/payment vouchers से अपने-आप बनता है।',
    ],
    commonMistakes: [
      'Cash Book को हाथ से मिलाने की कोशिश — गड़बड़ी लगे तो voucher entry में ढूँढें, यहाँ नहीं।',
    ],
    faqs: [
      { q: 'Cash Book और Bank Book में फ़र्क?', a: 'Cash Book सिर्फ़ नकद (Cash खाता) दिखाती है, Bank Book बैंक खाते की आवक-जावक।' },
    ],
    deepLink: { route: '/cash-book', label: 'SahakarLekha में Cash Book देखें' },
    guideSlug: 'daybook-and-ledger',
    related: ['view-trial-balance', 'first-voucher'],
  },
  {
    slug: 'bank-reconciliation',
    metaTitle: 'Bank Reconciliation (BRS) कैसे करें — सहकारी समिति | SahakarLekha',
    metaDescription: 'बैंक स्टेटमेंट और बही का मिलान — अनभुनाए चेक, बैंक प्रभार व छूटी एंट्रियाँ पहचानकर बैंक-बैलेंस मिनटों में मिलाएँ।',
    category: 'बैंक',
    title: 'Bank Reconciliation कैसे करें',
    intent: 'bank reconciliation kaise kare',
    difficulty: 'intermediate',
    estTime: '6 मिनट',
    tldr: 'Bank Reconciliation पेज खोलें → बैंक खाता व तारीख चुनें → स्टेटमेंट से मिलान करें; अनभुनाए चेक व बैंक प्रभार पहचानें ताकि बही-बैलेंस और बैंक-बैलेंस मिल जाएँ।',
    steps: [
      'मेन्यू से **Bank Reconciliation (BRS)** पेज खोलें।',
      'जिस **बैंक खाते** का मिलान करना है वह और तारीख चुनें।',
      'बैंक स्टेटमेंट से entries मिलाएँ — जो दोनों में हैं उन्हें cleared मार्क करें।',
      'अंतर की वजहें पहचानें: **अनभुनाए चेक, बैंक प्रभार/ब्याज, या छूटी एंट्रियाँ।**',
      'छूटी एंट्रियाँ (जैसे बैंक प्रभार) voucher से जोड़ें — फिर दोनों बैलेंस मिल जाएँगे।',
    ],
    commonMistakes: [
      'बैंक प्रभार/ब्याज को बही में डालना भूल जाना — यही सबसे आम अंतर है।',
    ],
    faqs: [
      { q: 'बैलेंस क्यों नहीं मिल रहा?', a: 'आमतौर पर अनभुनाए चेक या बैंक प्रभार की वजह से — दोनों को पहचानकर एडजस्ट करें।' },
    ],
    deepLink: { route: '/bank-reconciliation', label: 'SahakarLekha में BRS करें' },
    related: ['cash-book'],
  },
  {
    slug: 'loan-entry',
    metaTitle: 'Loan Entry कैसे करें — सदस्य ऋण सहकारी समिति | SahakarLekha',
    metaDescription: 'नया ऋण दर्ज करना — सदस्य, राशि, ब्याज दर व तारीख। ऋण-वितरण का voucher अपने-आप बनता है ताकि ऋण संपत्ति की तरह बैलेंस शीट में दिखे।',
    category: 'लोन',
    title: 'Loan Entry कैसे करें',
    intent: 'loan entry kaise kare',
    difficulty: 'intermediate',
    estTime: '4 मिनट',
    tldr: 'Loan Register पेज खोलें → "नया ऋण" → सदस्य, राशि, ब्याज दर व तारीख भरें → सेव। ऋण-वितरण का voucher अपने-आप बनता है।',
    steps: [
      'मेन्यू से **Loan Register (ऋण रजिस्टर)** पेज खोलें।',
      '**"नया ऋण"** दबाएँ।',
      'सदस्य, ऋण राशि, ब्याज दर, प्रकार और वितरण तारीख भरें।',
      '**सेव** करें — ऋण-वितरण का payment voucher (Dr: Loans & Advances) अपने-आप बन जाता है।',
      'बाद में ब्याज व वसूली अलग vouchers से दर्ज करें।',
    ],
    commonMistakes: [
      'ऋण को खर्च मान लेना — ऋण **संपत्ति** है (वापस आना है), खर्च नहीं।',
    ],
    faqs: [
      { q: 'क्या ऋण का voucher अलग से बनाना होगा?', a: 'नहीं, वितरण का voucher अपने-आप बनता है। ब्याज व वसूली बाद में अलग से दर्ज करें।' },
    ],
    deepLink: { route: '/loan-register', label: 'SahakarLekha में Loan दर्ज करें' },
    related: ['add-member', 'first-voucher'],
  },
  {
    slug: 'user-permissions',
    metaTitle: 'User Permission कैसे दें — भूमिका आधारित पहुँच | SahakarLekha',
    metaDescription: 'नए user को भूमिका (admin/accountant/viewer/auditor) देना ताकि कौन क्या कर सकता है यह तय रहे — गलती व छेड़छाड़ का जोखिम घटाएँ।',
    category: 'सेटिंग्स',
    title: 'User Permission कैसे दें',
    intent: 'user permission kaise de',
    difficulty: 'intermediate',
    estTime: '3 मिनट',
    tldr: 'User Management पेज खोलें → user जोड़ें या चुनें → भूमिका (admin/accountant/viewer/auditor) तय करें → सेव। भूमिका तय करती है कौन क्या कर सकता है।',
    prerequisites: [{ label: 'यह केवल admin भूमिका वाले user के लिए है', slug: undefined }],
    steps: [
      'मेन्यू से **User Management** पेज खोलें।',
      'नया user जोड़ें या मौजूदा user चुनें।',
      'उसकी **भूमिका** चुनें — admin (सब कुछ), accountant (एंट्री), viewer (सिर्फ़ देखना), auditor (सिर्फ़ देखना)।',
      '**सेव** करें — अब वह user अपनी भूमिका के हिसाब से ही काम कर पाएगा।',
    ],
    commonMistakes: [
      'सबको admin बना देना — viewer/accountant भूमिकाएँ देकर गलती व छेड़छाड़ का जोखिम घटाएँ।',
    ],
    faqs: [
      { q: 'Auditor भूमिका क्या कर सकती है?', a: 'सिर्फ़ रिपोर्ट व डेटा देख सकती है, बदल नहीं सकती — ऑडिट के लिए सुरक्षित पहुँच।' },
    ],
    deepLink: { route: '/user-management', label: 'SahakarLekha में User Permission दें' },
    guideSlug: 'data-security-and-backup',
    related: ['audit-report'],
  },
  {
    slug: 'audit-report',
    metaTitle: 'Audit Report/Certificate कैसे निकालें — सहकारी समिति | SahakarLekha',
    metaDescription: 'ऑडिट सर्टिफिकेट निकालना — वित्तीय आँकड़े अपने-आप भरते हैं, ऑडिटर विवरण भरें और PDF डाउनलोड करें। State-wise audit schedules भी।',
    category: 'ऑडिट',
    title: 'Audit Report कैसे निकालें',
    intent: 'audit report kaise nikale',
    difficulty: 'advanced',
    estTime: '5 मिनट',
    tldr: 'Audit Certificate पेज खोलें → वित्तीय आँकड़े अपने-आप भरते हैं → ऑडिटर का विवरण भरें → PDF डाउनलोड करें। State-wise audit schedules (I–X) भी मिलते हैं।',
    prerequisites: [{ label: 'पहले साल बंद (year-end) व FY-lock पूरा कर लें', slug: undefined }],
    steps: [
      'मेन्यू से **Audit Certificate** पेज खोलें।',
      'समिति के वित्तीय आँकड़े (बैलेंस शीट आदि) **अपने-आप भर** जाते हैं।',
      'ऑडिटर का नाम, तारीख व टिप्पणियाँ भरें।',
      '**PDF** डाउनलोड करें — State-wise audit schedules (I–X) भी उपलब्ध हैं।',
    ],
    commonMistakes: [
      'साल बंद किए बिना रिपोर्ट निकालना — पहले year-end व FY-lock करें ताकि आँकड़े स्थिर रहें।',
    ],
    faqs: [
      { q: 'आँकड़े खुद भरने होंगे?', a: 'मुख्य वित्तीय आँकड़े app अपने-आप भरता है; आपको सिर्फ़ ऑडिटर विवरण भरना है।' },
    ],
    deepLink: { route: '/audit-certificate', label: 'SahakarLekha में Audit Report निकालें' },
    guideSlug: 'audit-preparation',
    related: ['user-permissions', 'view-trial-balance'],
  },
  {
    slug: 'record-purchase',
    metaTitle: 'खरीद (Purchase) कैसे दर्ज करें — सहकारी समिति | SahakarLekha',
    metaDescription: 'माल की खरीद दर्ज करना — आपूर्तिकर्ता, आइटम, दर व (ज़रूरत हो तो) GST/TDS। एंट्री करते ही voucher और स्टॉक अपने-आप अपडेट होते हैं।',
    category: 'खरीद-बिक्री',
    title: 'खरीद (Purchase) कैसे दर्ज करें',
    intent: 'purchase kaise darj kare',
    difficulty: 'beginner',
    estTime: '4 मिनट',
    tldr: 'Purchases पेज खोलें → आपूर्तिकर्ता चुनें → आइटम, मात्रा व दर भरें → नकद/उधार चुनें → सेव। voucher और स्टॉक अपने-आप बन/बढ़ जाते हैं।',
    prerequisites: [
      { label: 'आपूर्तिकर्ता (Supplier) पहले से बना हो', slug: undefined },
      { label: 'आइटम (Stock item) बना हो', slug: 'add-stock-item' },
    ],
    steps: [
      'मेन्यू से **Purchases (खरीद)** पेज खोलें।',
      '**आपूर्तिकर्ता** चुनें। अगर सूची में नहीं है तो पहले Suppliers पेज से जोड़ें।',
      'हर **आइटम**, उसकी **मात्रा** और **दर** भरें — कुल राशि अपने-आप जुड़ती जाएगी।',
      'GST/TDS लागू हो तभी वे फ़ील्ड भरें; सामान्य नकद खरीद में इन्हें खाली छोड़ दें।',
      '**नकद या उधार** चुनें और **सेव** करें।',
      'सेव होते ही खरीद का **voucher** और आइटम का **स्टॉक** अपने-आप अपडेट हो जाता है — अलग से entry की ज़रूरत नहीं।',
    ],
    commonMistakes: [
      'अलग से manual voucher भी बना देना — इससे डबल एंट्री हो जाती है; खरीद खुद voucher बनाती है।',
      'GST न लगने पर भी tax फ़ील्ड भर देना — इससे रिपोर्ट में गलत टैक्स दिखता है।',
    ],
    faqs: [
      { q: 'आपूर्तिकर्ता सूची में नहीं है, क्या करूँ?', a: 'पहले Suppliers पेज पर जाकर नया आपूर्तिकर्ता जोड़ें, फिर खरीद दर्ज करें।' },
      { q: 'खरीद हटाने पर क्या स्टॉक वापस घटेगा?', a: 'हाँ — खरीद हटाने पर उसका voucher और स्टॉक दोनों उलट जाते हैं।' },
    ],
    deepLink: { route: '/purchases', label: 'SahakarLekha में खरीद दर्ज करें' },
    guideSlug: 'purchase-entries',
    related: ['record-sale', 'make-payment', 'add-stock-item'],
  },
  {
    slug: 'record-sale',
    metaTitle: 'बिक्री (Sale) कैसे दर्ज करें — सहकारी समिति | SahakarLekha',
    metaDescription: 'माल की बिक्री दर्ज करना — ग्राहक, आइटम, दर। स्टॉक से ज़्यादा बिक्री app खुद रोकता है; voucher व स्टॉक अपने-आप अपडेट होते हैं।',
    category: 'खरीद-बिक्री',
    title: 'बिक्री (Sale) कैसे दर्ज करें',
    intent: 'sale kaise darj kare',
    difficulty: 'beginner',
    estTime: '4 मिनट',
    tldr: 'Sales पेज खोलें → ग्राहक चुनें → आइटम, मात्रा व दर भरें → नकद/उधार चुनें → सेव। स्टॉक व voucher अपने-आप अपडेट; स्टॉक से ज़्यादा बिक्री रुक जाती है।',
    prerequisites: [
      { label: 'आइटम में स्टॉक उपलब्ध हो', slug: 'add-stock-item' },
    ],
    steps: [
      'मेन्यू से **Sales (बिक्री)** पेज खोलें।',
      '**ग्राहक** चुनें (नकद बिक्री के लिए कैश ग्राहक भी चुन सकते हैं)।',
      'हर **आइटम**, **मात्रा** और **दर** भरें।',
      'अगर मात्रा उपलब्ध स्टॉक से ज़्यादा है, तो app आपको **रोक देगा** — पहले स्टॉक जाँचें।',
      '**नकद या उधार** चुनकर **सेव** करें।',
      'voucher और स्टॉक-घटौती अपने-आप हो जाती है।',
    ],
    commonMistakes: [
      'बिना स्टॉक के बिक्री करने की कोशिश — पहले खरीद/समायोजन से स्टॉक दर्ज करें।',
      'उधार बिक्री को नकद में दर्ज कर देना — इससे ग्राहक का बकाया गलत दिखेगा।',
    ],
    faqs: [
      { q: 'स्टॉक से ज़्यादा क्यों नहीं बेच सकते?', a: 'app नेगेटिव स्टॉक रोकता है ताकि रिपोर्ट सही रहे। पहले स्टॉक बढ़ाएँ, फिर बेचें।' },
      { q: 'उधार बिक्री का पैसा बाद में कैसे लें?', a: '"Receive Payment" पेज से बिल-वाइज़ वसूली दर्ज करें।' },
    ],
    deepLink: { route: '/sales', label: 'SahakarLekha में बिक्री दर्ज करें' },
    guideSlug: 'sales-entries',
    related: ['record-purchase', 'receive-payment', 'add-stock-item'],
  },
  {
    slug: 'receive-payment',
    metaTitle: 'ग्राहक से भुगतान (Receipt) कैसे लें — बिल-वाइज़ | SahakarLekha',
    metaDescription: 'उधार बिक्री की वसूली — बिल-वाइज़ सेटलमेंट से पुराने बिल पहले चुकाएँ, या अग्रिम/On-Account राशि दर्ज करें।',
    category: 'लेन-देन',
    title: 'ग्राहक से भुगतान (Receipt) कैसे लें',
    intent: 'customer se payment kaise le',
    difficulty: 'beginner',
    estTime: '3 मिनट',
    tldr: 'Receive Payment खोलें → ग्राहक चुनें → खुले बिलों में राशि बाँटें (पुराने पहले) या अग्रिम/On-Account डालें → सेव। रसीद voucher बन जाता है।',
    steps: [
      'मेन्यू से **Receive Payment (भुगतान प्राप्ति)** खोलें।',
      '**ग्राहक** चुनें — उसके खुले बिलों की संख्या साथ में दिखती है।',
      'राशि किन बिलों में लगे, चुनें — या **"पुराने बिल पहले बाँटें"** से अपने-आप बँटवा दें।',
      'कोई बिल न हो तो नीचे **अग्रिम / On-Account** राशि दर्ज कर सकते हैं।',
      'नकद/बैंक चुनकर **सेव** करें — रसीद (receipt) voucher बन जाता है।',
    ],
    commonMistakes: [
      'राशि किसी बिल से न जोड़ना — इससे बिल "बकाया" ही दिखता रहेगा; बिल-वाइज़ बाँटें।',
    ],
    faqs: [
      { q: 'ग्राहक ने पूरा नहीं, आधा दिया तो?', a: 'जितना मिला उतना दर्ज करें — बाकी अपने-आप बकाया रहेगा।' },
      { q: 'बिना बिल के अग्रिम कैसे लें?', a: 'On-Account/अग्रिम फ़ील्ड में राशि डालें; बाद के बिल में इसे adjust कर सकते हैं।' },
    ],
    deepLink: { route: '/receive-payment', label: 'SahakarLekha में भुगतान प्राप्ति दर्ज करें' },
    guideSlug: 'receipts-and-payments',
    related: ['record-sale', 'make-payment'],
  },
  {
    slug: 'make-payment',
    metaTitle: 'आपूर्तिकर्ता को भुगतान (Payment) कैसे करें — बिल-वाइज़ | SahakarLekha',
    metaDescription: 'खरीद के बकाया का भुगतान — बिल-वाइज़ सेटलमेंट से पुराने बिल पहले चुकाएँ, या अग्रिम/On-Account दर्ज करें।',
    category: 'लेन-देन',
    title: 'आपूर्तिकर्ता को भुगतान कैसे करें',
    intent: 'supplier ko payment kaise kare',
    difficulty: 'beginner',
    estTime: '3 मिनट',
    tldr: 'Make Payment खोलें → आपूर्तिकर्ता चुनें → खुले बिलों में राशि बाँटें (पुराने पहले) या अग्रिम डालें → नकद/बैंक चुनकर सेव।',
    steps: [
      'मेन्यू से **Make Payment (भुगतान)** खोलें।',
      '**आपूर्तिकर्ता** चुनें — उसके बकाया बिल दिखेंगे।',
      'राशि किन बिलों में लगे चुनें, या **पुराने बिल पहले** से अपने-आप बाँटें।',
      '**नकद या बैंक** चुनें (बैंक से हो तो सही बैंक खाता चुनें)।',
      '**सेव** करें — payment voucher बन जाता है।',
    ],
    commonMistakes: [
      'बैंक से भुगतान पर गलत बैंक खाता चुनना — इससे बैंक बुक मिलान (BRS) गड़बड़ होगा।',
    ],
    faqs: [
      { q: 'बिना बिल के अग्रिम भुगतान कैसे करें?', a: 'On-Account/अग्रिम फ़ील्ड में राशि डालें; बाद के बिल में adjust हो जाएगी।' },
    ],
    deepLink: { route: '/make-payment', label: 'SahakarLekha में भुगतान करें' },
    guideSlug: 'receipts-and-payments',
    related: ['record-purchase', 'receive-payment'],
  },
  {
    slug: 'process-salary',
    metaTitle: 'वेतन (Salary) कैसे प्रोसेस करें — सहकारी समिति | SahakarLekha',
    metaDescription: 'कर्मचारी जोड़ना, मासिक वेतन प्रोसेस करना और PF/ESI/PT/TDS कटौती — स्टेप बाय स्टेप। voucher अपने-आप बनता है।',
    category: 'वेतन',
    title: 'वेतन (Salary) कैसे प्रोसेस करें',
    intent: 'salary kaise process kare',
    difficulty: 'intermediate',
    estTime: '5 मिनट',
    tldr: 'Salary पेज → पहले कर्मचारी जोड़ें → "Salary Processing" टैब में महीना चुनें → कटौतियाँ जाँचें → "Process All" से वेतन दर्ज करें।',
    prerequisites: [
      { label: 'कर्मचारी (Employee) जोड़ लिए हों', slug: undefined },
    ],
    steps: [
      'मेन्यू से **Salary (वेतन)** पेज खोलें।',
      '**Employees** टैब में हर कर्मचारी का नाम, पद, जॉइनिंग तिथि व मूल वेतन भरें।',
      '**Salary Processing** टैब खोलें — app अनुमानित PF/ESI/PT/TDS भर देता है।',
      'हर पंक्ति की कटौती जाँचें; गलत हो तो सीधे बदल दें (जैसे TDS)।',
      '**Process All** दबाकर पूरे महीने का वेतन दर्ज करें — voucher अपने-आप बनता है।',
    ],
    commonMistakes: [
      'एक ही महीना दो बार प्रोसेस कर देना — पहले जाँचें कि वह महीना पहले से "processed" तो नहीं।',
      'TDS को हर महीने बराबर मानना — यह सालाना अनुमान से भरता है; ज़रूरत पर बदलें।',
    ],
    faqs: [
      { q: 'क्या वेतन का अलग voucher बनाना पड़ता है?', a: 'नहीं — "Process" करते ही वेतन का journal voucher अपने-आप बन जाता है।' },
      { q: 'प्रोसेस की हुई पंक्ति कैसे सुधारें?', a: 'उस वेतन स्लिप को हटाकर दोबारा प्रोसेस करें।' },
    ],
    deepLink: { route: '/salary', label: 'SahakarLekha में वेतन प्रोसेस करें' },
    guideSlug: 'salary-management',
    related: ['add-member'],
  },
  {
    slug: 'gst-return',
    metaTitle: 'GST सारांश देखना व भुगतान कैसे करें — सहकारी समिति | SahakarLekha',
    metaDescription: 'बिक्री-खरीद से बना GST सारांश देखना और GST भुगतान दर्ज करना — GSTR भरने के लिए ज़रूरी आँकड़े एक जगह।',
    category: 'GST व TDS',
    title: 'GST सारांश व भुगतान कैसे देखें',
    intent: 'gst kaise dekhe',
    difficulty: 'intermediate',
    estTime: '4 मिनट',
    tldr: 'GST Summary पेज खोलें → अवधि चुनें → Output GST, Input GST (ITC) और देय राशि देखें → उतना GST भुगतान voucher दर्ज करें।',
    steps: [
      'मेन्यू से **GST Summary** पेज खोलें।',
      '**अवधि (महीना/तिमाही)** चुनें।',
      'Output GST (बिक्री पर), Input GST/ITC (खरीद पर) और **शुद्ध देय** राशि देखें।',
      'यही आँकड़े GSTR-1 / 3B भरते समय काम आते हैं।',
      'GST जमा करने पर उसका **भुगतान voucher** दर्ज करें ताकि बही मिलती रहे।',
    ],
    commonMistakes: [
      'खरीद में GST न भरने से ITC छूट जाना — पात्र खरीद पर input GST ज़रूर भरें।',
    ],
    faqs: [
      { q: 'क्या SahakarLekha सीधे GSTR फाइल करता है?', a: 'यह सारांश व आँकड़े तैयार करता है; रिटर्न आप GST पोर्टल पर भरते हैं।' },
      { q: 'सहकारी समिति पर GST लगता है क्या?', a: 'टर्नओवर व गतिविधि पर निर्भर — पात्र होने पर लगता है; विस्तार गाइड में देखें।' },
    ],
    deepLink: { route: '/gst-summary', label: 'SahakarLekha में GST सारांश देखें' },
    guideSlug: 'gst-management',
    related: ['tds-deduct'],
  },
  {
    slug: 'tds-deduct',
    metaTitle: 'TDS कटौती व रजिस्टर कैसे देखें — सहकारी समिति | SahakarLekha',
    metaDescription: 'भुगतान पर काटा गया TDS एक जगह देखना और जमा करना — 24Q/26Q व Form 16A के लिए ज़रूरी आँकड़े।',
    category: 'GST व TDS',
    title: 'TDS रजिस्टर कैसे देखें',
    intent: 'tds kaise dekhe',
    difficulty: 'intermediate',
    estTime: '4 मिनट',
    tldr: 'TDS Register खोलें → अवधि चुनें → किस पर, किस दर से, कितना TDS कटा देखें → जमा करने पर भुगतान voucher दर्ज करें।',
    steps: [
      'मेन्यू से **TDS Register** पेज खोलें।',
      '**अवधि** चुनें — काटा गया सारा TDS एक सूची में दिखेगा।',
      'किस पार्टी पर, किस धारा/दर से, कितना TDS कटा — जाँचें।',
      'TDS सरकार में जमा करने पर उसका **भुगतान voucher** दर्ज करें।',
      'यही आँकड़े 24Q/26Q रिटर्न और Form 16A बनाने में काम आते हैं।',
    ],
    commonMistakes: [
      'PAN न भरना — बिना PAN के TDS रिटर्न व Form 16A अधूरे रहते हैं।',
    ],
    faqs: [
      { q: 'TDS किस दर से काटें?', a: 'भुगतान के प्रकार व धारा पर निर्भर; app पात्रता पर दर सुझाता है, पर अंतिम ज़िम्मेदारी आपकी है।' },
    ],
    deepLink: { route: '/tds-register', label: 'SahakarLekha में TDS रजिस्टर देखें' },
    guideSlug: 'tds-and-26q',
    related: ['gst-return'],
  },
  {
    slug: 'add-stock-item',
    metaTitle: 'स्टॉक आइटम कैसे जोड़ें — इन्वेंटरी | SahakarLekha',
    metaDescription: 'नया आइटम, इकाई, दर व प्रारंभिक स्टॉक जोड़ना, और बिक्री/खरीद खाता चुनना — ताकि खरीद-बिक्री सही खाते में जाए।',
    category: 'इन्वेंटरी',
    title: 'स्टॉक आइटम कैसे जोड़ें',
    intent: 'stock item kaise jode',
    difficulty: 'beginner',
    estTime: '3 मिनट',
    tldr: 'Inventory पेज → "नया आइटम" → नाम, इकाई, दर व प्रारंभिक स्टॉक भरें → बिक्री/खरीद खाता चुनें (न पता हो तो डिफ़ॉल्ट रखें) → सेव।',
    steps: [
      'मेन्यू से **Inventory (इन्वेंटरी)** पेज खोलें।',
      '**"नया आइटम"** दबाएँ।',
      'आइटम का **नाम**, **इकाई** (किलो/नग आदि) और **दर** भरें।',
      'अगर पुराना स्टॉक है तो **प्रारंभिक स्टॉक** की मात्रा डालें।',
      '**बिक्री खाता / खरीद खाता** चुनें — ठीक से न पता हो तो सुझाया गया डिफ़ॉल्ट (4101/5101) रहने दें।',
      '**सेव** करें — अब यह आइटम खरीद/बिक्री में चुना जा सकता है।',
    ],
    commonMistakes: [
      'गलत बिक्री/खरीद खाता चुनना — इससे Trading A/c में श्रेणी गलत दिखती है; ठीक न पता हो तो डिफ़ॉल्ट रखें।',
      'प्रारंभिक स्टॉक व दर खाली छोड़ना — इससे मूल्यांकन (valuation) अधूरा रहता है।',
    ],
    faqs: [
      { q: 'बिक्री/खरीद खाता क्यों माँगा जाता है?', a: 'ताकि हर आइटम की बिक्री-खरीद सही श्रेणी के खाते में जाए और रिपोर्ट अलग-अलग दिखे। न पता हो तो डिफ़ॉल्ट रखें।' },
      { q: 'स्टॉक बढ़ाना/घटाना कैसे करें?', a: 'खरीद से स्टॉक बढ़ता है, बिक्री से घटता है; सीधा सुधार "समायोजन" से करें।' },
    ],
    deepLink: { route: '/inventory', label: 'SahakarLekha में स्टॉक आइटम जोड़ें' },
    guideSlug: 'inventory-management',
    related: ['record-purchase', 'record-sale'],
  },
];

export function findHelpTask(slug: string): HelpTask | null {
  return HELP_TASKS.find((t) => t.slug === slug) ?? null;
}

/**
 * Contextual help: the task whose deep-link points at this app route (the reverse
 * of the PLG CTA). Lets an in-app screen link OUT to its matching how-to, closing
 * the acquisition↔activation↔support loop from one place (no per-page edits).
 */
export function helpForRoute(pathname: string): HelpTask | null {
  // Match the task whose deep-link route is the current route or a parent of it
  // (so `/members/123` and `/vouchers` sub-routes still resolve). Query strings
  // are already excluded from react-router's location.pathname. When several
  // tasks match, prefer the most specific (longest) route.
  const matches = HELP_TASKS.filter(
    (t) => pathname === t.deepLink.route || pathname.startsWith(t.deepLink.route + '/'),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, t) =>
    t.deepLink.route.length > best.deepLink.route.length ? t : best,
  );
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
