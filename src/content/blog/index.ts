/**
 * SahakarLekha Blog — hand-authored articles (separate from the auto-generated
 * /guide course). Each post's prose lives in ./<slug>.md and is loaded raw;
 * the metadata below drives the /blog index, per-post SEO and the prerenderer.
 *
 * NOTE for scripts/prerender-guide.mjs: it parses THIS file with a regex that
 * expects, per post and IN THIS ORDER, `slug:`, `metaTitle:`, `metaDescription:`,
 * `date:` as single-quoted strings. Keep those four fields first, in that order,
 * and avoid raw apostrophes inside them.
 */
export interface BlogPost {
  slug: string;
  /** <title> + og:title (≤ ~60 chars ideal) */
  metaTitle: string;
  /** meta description + og:description */
  metaDescription: string;
  /** ISO publish date YYYY-MM-DD */
  date: string;
  /** ISO last-updated date (optional) */
  updated?: string;
  /** category label (Hindi) shown as a chip */
  category: string;
  /** on-page hero heading (Devanagari, can differ from metaTitle) */
  title: string;
  /** short heading used on cards */
  shortTitle: string;
  /** one/two-line summary for cards + article intro */
  excerpt: string;
  /** colour accent key → mapped to a gradient cover in the pages */
  accent: 'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'indigo';
  /** topic tags */
  tags: string[];
}

// Reverse-chronological is enforced by sorting on `date` below.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'agm-preparation-checklist',
    metaTitle: 'AGM (वार्षिक आम सभा) की तैयारी: संपूर्ण चेकलिस्ट | SahakarLekha',
    metaDescription: 'सहकारी समिति की वार्षिक आम सभा से पहले क्या तैयार रखें — अंतिम खाते, ऑडिट रिपोर्ट, बँटवारा व कार्यवृत्त — आसान चेकलिस्ट।',
    date: '2026-09-15',
    category: 'बैठक व प्रशासन',
    title: 'AGM (वार्षिक आम सभा) की तैयारी: संपूर्ण चेकलिस्ट',
    shortTitle: 'AGM की तैयारी: चेकलिस्ट',
    excerpt: 'वार्षिक आम सभा से पहले दस्तावेज़, बँटवारा-प्रस्ताव व कार्यवृत्त — सब तैयार कैसे रखें।',
    accent: 'rose',
    tags: ['AGM', 'बैठक', 'प्रशासन'],
  },
  {
    slug: 'quarterly-compliance-calendar',
    metaTitle: 'तिमाही अनुपालन कैलेंडर: GST, TDS व रिटर्न की due-dates | SahakarLekha',
    metaDescription: 'GST, TDS, 26Q व रिटर्न की due-dates का सरल ढाँचा + मासिक 5-मिनट जाँच — जुर्माने से बचें।',
    date: '2026-10-13',
    category: 'कर अनुपालन',
    title: 'तिमाही अनुपालन कैलेंडर: GST, TDS व रिटर्न की due-dates',
    shortTitle: 'तिमाही अनुपालन कैलेंडर',
    excerpt: 'कब क्या फ़ाइल/जमा करना है — एक कैलेंडर व मासिक आदत से समिति जुर्माना-मुक्त रहती है।',
    accent: 'amber',
    tags: ['अनुपालन', 'GST', 'TDS'],
  },
  {
    slug: 'cooperative-week-going-digital',
    metaTitle: 'सहकारिता सप्ताह: डिजिटल सहकारिता की ओर एक कदम | SahakarLekha',
    metaDescription: 'सहकारिता सप्ताह पर समिति के लिए 3 संकल्प — डिजिटल हिसाब, पारदर्शिता व समय पर अनुपालन।',
    date: '2026-11-17',
    category: 'डिजिटल लेखांकन',
    title: 'सहकारिता सप्ताह: डिजिटल सहकारिता की ओर एक कदम',
    shortTitle: 'सहकारिता सप्ताह: डिजिटल की ओर',
    excerpt: 'सहकारिता सप्ताह पर अपनी समिति के लिए 3 संकल्प — डिजिटल, पारदर्शी, अनुपालन-तैयार।',
    accent: 'emerald',
    tags: ['सहकारिता सप्ताह', 'डिजिटल'],
  },
  {
    slug: 'loan-recovery-before-year-end',
    metaTitle: 'ऋण वसूली: वर्ष-अंत से पहले का सबसे ज़रूरी काम | SahakarLekha',
    metaDescription: 'बकाया-उम्र (aging) से वसूली सूची, वसूली% व NPA पर नज़र — वर्षांत से पहले व्यवस्थित ऋण वसूली।',
    date: '2026-12-15',
    category: 'सदस्य व ऋण',
    title: 'ऋण वसूली: वर्ष-अंत से पहले का सबसे ज़रूरी काम',
    shortTitle: 'ऋण वसूली: वर्ष-अंत से पहले',
    excerpt: 'aging-सूची, वसूली% व NPA — बकाया वसूली को व्यवस्थित कैसे करें, वर्ष-अंत से पहले।',
    accent: 'indigo',
    tags: ['वसूली', 'NPA', 'ऋण'],
  },
  {
    slug: 'half-year-financial-review',
    metaTitle: 'साल के बीच की वित्तीय समीक्षा: अभी क्यों ज़रूरी | SahakarLekha',
    metaDescription: '6-महीने का हेल्थ-चेक — ट्रायल बैलेंस, वसूली%, खर्च बनाम बजट — वर्षांत की भागदौड़ से बचें।',
    date: '2027-01-13',
    category: 'बैंक व रिपोर्ट',
    title: 'साल के बीच की वित्तीय समीक्षा: अभी क्यों ज़रूरी',
    shortTitle: 'साल के बीच की समीक्षा',
    excerpt: 'छमाही समीक्षा से गलतियाँ जल्दी पकड़ में आती हैं और वर्षांत आसान हो जाता है।',
    accent: 'sky',
    tags: ['समीक्षा', 'रिपोर्ट'],
  },
  {
    slug: 'year-end-readiness-checklist',
    metaTitle: 'वर्षांत से पहले: 10 ज़रूरी काम (FY क्लोज़िंग की तैयारी) | SahakarLekha',
    metaDescription: 'मार्च से पहले निपटाने वाले 10 काम — मिलान, स्टॉक, डेप्रिसिएशन, समायोजन — ताकि साल का अंत सहज हो।',
    date: '2027-02-17',
    category: 'मुनाफ़ा व बँटवारा',
    title: 'वर्षांत से पहले: 10 ज़रूरी काम (FY क्लोज़िंग की तैयारी)',
    shortTitle: 'वर्षांत से पहले: 10 काम',
    excerpt: 'मार्च की भागदौड़ से बचने के लिए समय रहते निपटाने वाली 10-काम की तैयारी-चेकलिस्ट।',
    accent: 'violet',
    tags: ['वर्षांत', 'चेकलिस्ट'],
  },
  {
    slug: 'new-financial-year-and-budget',
    metaTitle: 'नया वित्तीय वर्ष: सही शुरुआत और वार्षिक बजट | SahakarLekha',
    metaDescription: 'अप्रैल में नए साल की सही शुरुआत — सही ओपनिंग बैलेंस व एक साफ़ बजट से पूरा साल व्यवस्थित।',
    date: '2027-04-07',
    category: 'लेखांकन मूल बातें',
    title: 'नया वित्तीय वर्ष: सही शुरुआत और वार्षिक बजट',
    shortTitle: 'नया वित्तीय वर्ष व बजट',
    excerpt: 'सही opening और साफ़ बजट — नए वित्तीय वर्ष को व्यवस्थित व तनाव-मुक्त कैसे बनाएँ।',
    accent: 'emerald',
    tags: ['नया FY', 'बजट'],
  },
  {
    slug: 'annual-statutory-returns',
    metaTitle: 'वार्षिक व सांविधिक रिटर्न: साल बंद होने के बाद के काम | SahakarLekha',
    metaDescription: 'विभाग/संघ को वार्षिक रिटर्न, due-dates व रिकॉर्ड — साफ़ खातों से सांविधिक रिटर्न आसान।',
    date: '2027-05-12',
    category: 'ऑडिट व अनुपालन',
    title: 'वार्षिक व सांविधिक रिटर्न: साल बंद होने के बाद के ज़रूरी काम',
    shortTitle: 'वार्षिक व सांविधिक रिटर्न',
    excerpt: 'विभाग/संघ को वार्षिक रिटर्न समय पर — साफ़ खातों से यह रिपोर्ट निकालने जितना आसान।',
    accent: 'amber',
    tags: ['रिटर्न', 'अनुपालन'],
  },
  {
    slug: 'gst-for-cooperatives',
    metaTitle: 'GST सहकारी समिति के लिए: आसान गाइड | SahakarLekha',
    metaDescription: 'आउटपुट/इनपुट GST, ITC, GSTR-1/2B/3B और रियायती बिल पर सही कर — सहकारी समिति के लिए आसान GST गाइड।',
    date: '2026-06-30',
    category: 'कर अनुपालन',
    title: 'GST सहकारी समिति के लिए: आसान गाइड',
    shortTitle: 'GST सहकारी समिति के लिए',
    excerpt: 'आउटपुट-इनपुट GST, ITC मिलान और मासिक फ़ाइलिंग — GST को सहकारी समिति के नज़रिये से आसान बनाइए।',
    accent: 'sky',
    tags: ['GST', 'ITC', 'कर'],
  },
  {
    slug: 'tds-and-26q-for-societies',
    metaTitle: 'TDS और 26Q: सहकारी समिति के लिए सरल गाइड | SahakarLekha',
    metaDescription: 'TDS कब-कितना काटें, समय पर जमा, और तिमाही 26Q — सहकारी समिति के लिए आसान TDS गाइड।',
    date: '2026-07-07',
    category: 'कर अनुपालन',
    title: 'TDS और 26Q: सहकारी समिति के लिए सरल गाइड',
    shortTitle: 'TDS और 26Q गाइड',
    excerpt: 'किन भुगतानों पर TDS, सही कटौती-जमा, और तिमाही 26Q — उदाहरण सहित आसान भाषा में।',
    accent: 'amber',
    tags: ['TDS', '26Q', 'कर'],
  },
  {
    slug: 'depreciation-explained',
    metaTitle: 'डेप्रिसिएशन (घिसाई) कैसे करें: आसान समझ | SahakarLekha',
    metaDescription: 'SLM बनाम WDV, डेप्रिसिएशन की एंट्री और शेड्यूल — सही लाभ व बैलेंस शीट के लिए आसान गाइड।',
    date: '2026-08-25',
    category: 'लेखांकन मूल बातें',
    title: 'डेप्रिसिएशन (घिसाई) कैसे करें: आसान समझ',
    shortTitle: 'डेप्रिसिएशन कैसे करें',
    excerpt: 'संपत्तियों की घटती कीमत हर साल कैसे दर्ज करें — SLM/WDV, एंट्री और शेड्यूल सरल भाषा में।',
    accent: 'violet',
    tags: ['डेप्रिसिएशन', 'संपत्ति'],
  },
  {
    slug: 'year-end-closing-and-fy-lock',
    metaTitle: 'वर्षांत प्रक्रिया व FY-लॉक: साल कैसे बंद करें | SahakarLekha',
    metaDescription: 'साल बंद करने की चेकलिस्ट — समायोजन, अंतिम खाते, FY-लॉक — और closing से opening की सही कड़ी।',
    date: '2026-09-01',
    category: 'मुनाफ़ा व बँटवारा',
    title: 'वर्षांत प्रक्रिया व FY-लॉक: साल कैसे बंद करें',
    shortTitle: 'वर्षांत व FY-लॉक',
    excerpt: 'वर्षांत की चेकलिस्ट, अंतिम खाते और FY-लॉक — साल को साफ़, स्थिर व ऑडिट-रेडी बंद कीजिए।',
    accent: 'emerald',
    tags: ['वर्षांत', 'FY-लॉक'],
  },
  {
    slug: 'opening-balances-new-society',
    metaTitle: 'ओपनिंग बैलेंस: नई समिति या नए साल की सही शुरुआत | SahakarLekha',
    metaDescription: 'हर खाते का सही शुरुआती शेष व Dr=Cr — तुलन-पत्र पहले दिन से मिले, इसका आसान तरीका।',
    date: '2026-08-11',
    category: 'लेखांकन मूल बातें',
    title: 'ओपनिंग बैलेंस: नई समिति या नए साल की सही शुरुआत',
    shortTitle: 'ओपनिंग बैलेंस कैसे डालें',
    excerpt: 'सही ओपनिंग बैलेंस = साल भर सही खाते। Dr=Cr कैसे मिलाएँ, उदाहरण सहित।',
    accent: 'rose',
    tags: ['ओपनिंग बैलेंस', 'शुरुआत'],
  },
  {
    slug: 'kcc-crop-loan-accounting',
    metaTitle: 'KCC व फसल ऋण लेखांकन: PACS के लिए गाइड | SahakarLekha',
    metaDescription: 'KCC ऋण को संपत्ति, ब्याज को आय, अनुदान अलग, और वसूली/NPA की निगरानी — PACS के लिए आसान गाइड।',
    date: '2026-07-14',
    category: 'सदस्य व ऋण',
    title: 'KCC व फसल ऋण लेखांकन: PACS के लिए गाइड',
    shortTitle: 'KCC व फसल ऋण लेखांकन',
    excerpt: 'KCC ऋण, ब्याज, ब्याज-सहायता और वसूली/NPA — किसान-ऋण का सही हिसाब आसान भाषा में।',
    accent: 'indigo',
    tags: ['KCC', 'फसल ऋण', 'PACS'],
  },
  {
    slug: 'salary-and-payroll-accounting',
    metaTitle: 'वेतन व पेरोल लेखांकन: EPF, ESI व TDS सहित | SahakarLekha',
    metaDescription: 'सकल-शुद्ध वेतन, EPF/ESI/TDS कटौतियाँ और उनकी समय पर जमा — सहकारी समिति के लिए आसान पेरोल गाइड।',
    date: '2026-08-04',
    category: 'लेखांकन मूल बातें',
    title: 'वेतन व पेरोल लेखांकन: EPF, ESI व TDS सहित',
    shortTitle: 'वेतन व पेरोल लेखांकन',
    excerpt: 'सकल बनाम शुद्ध वेतन, हर कटौती की अलग देनदारी, और समय पर जमा — उदाहरण सहित।',
    accent: 'amber',
    tags: ['वेतन', 'EPF', 'ESI'],
  },
  {
    slug: 'data-security-and-backup',
    metaTitle: 'डेटा सुरक्षा व बैकअप: समिति का हिसाब कभी न खोएँ | SahakarLekha',
    metaDescription: 'लोकल बनाम क्लाउड, भूमिका-नियंत्रण, नियमित बैकअप व निर्यात — समिति के डेटा को सुरक्षित रखने की गाइड।',
    date: '2026-08-18',
    category: 'डिजिटल लेखांकन',
    title: 'डेटा सुरक्षा व बैकअप: समिति का हिसाब कभी न खोएँ',
    shortTitle: 'डेटा सुरक्षा व बैकअप',
    excerpt: 'क्लाउड बैकअप, भूमिका-आधारित पहुँच और निर्यात — ताकि समिति का हिसाब कभी न खोए।',
    accent: 'sky',
    tags: ['सुरक्षा', 'बैकअप', 'क्लाउड'],
  },
  {
    slug: 'nabard-and-federation-returns',
    metaTitle: 'NABARD व फेडरेशन रिटर्न: सहकारी समिति की रिपोर्टिंग | SahakarLekha',
    metaDescription: 'सदस्य-वृद्धि, पूँजी, ऋण-वसूली, NPA व संघ प्रपत्र — साफ़ खातों से NABARD/फेडरेशन रिपोर्ट आसान।',
    date: '2026-07-28',
    category: 'ऑडिट व अनुपालन',
    title: 'NABARD व फेडरेशन रिटर्न: सहकारी समिति की रिपोर्टिंग',
    shortTitle: 'NABARD व फेडरेशन रिटर्न',
    excerpt: 'ये रिपोर्ट साफ़ खातों का स्वाभाविक नतीजा हैं — कौन-सा डेटा, और कैसे आसान बनाएँ।',
    accent: 'violet',
    tags: ['NABARD', 'फेडरेशन', 'रिटर्न'],
  },
  {
    slug: 'cooperative-society-types-guide',
    metaTitle: 'सहकारी समिति के प्रकार: किसके लिए कौन-सा सेटअप | SahakarLekha',
    metaDescription: 'PACS, दुग्ध, उपभोक्ता, मार्केटिंग, बहुउद्देशीय — हर प्रकार की समिति की खास लेखांकन-ज़रूरत व सही सेटअप।',
    date: '2026-07-21',
    category: 'डिजिटल लेखांकन',
    title: 'सहकारी समिति के प्रकार: किसके लिए कौन-सा सेटअप',
    shortTitle: 'सहकारी समिति के प्रकार',
    excerpt: 'हर प्रकार की समिति की अलग ज़रूरत — और जो बुनियाद सबमें समान रहती है।',
    accent: 'emerald',
    tags: ['समिति प्रकार', 'PACS', 'सेटअप'],
  },
  {
    slug: 'profit-distribution-and-reserves',
    metaTitle: 'सहकारी समिति में लाभ का बँटवारा: रिज़र्व, डिविडेंड और बोनस | SahakarLekha',
    metaDescription: 'सहकारी समिति में नेट प्रॉफ़िट किस क्रम में बाँटें — पहले रिज़र्व फंड, फिर डिविडेंड और बोनस, और ज़रूरत से ज़्यादा बाँटने से बचाव।',
    date: '2026-06-25',
    category: 'लाभ व बँटवारा',
    title: 'लाभ का बँटवारा: रिज़र्व फंड, डिविडेंड और बोनस',
    shortTitle: 'लाभ का बँटवारा (प्रॉफ़िट)',
    excerpt: 'नेट प्रॉफ़िट किस क्रम में बाँटें — पहले रिज़र्व फंड, फिर डिविडेंड और बोनस, और ज़रूरत से ज़्यादा बाँटने से बचाव।',
    accent: 'amber',
    tags: ['लाभ', 'डिविडेंड', 'रिज़र्व फंड'],
  },
  {
    slug: 'member-and-share-accounting',
    metaTitle: 'सदस्य व शेयर रजिस्टर: सहकारी समिति में सही लेखांकन | SahakarLekha',
    metaDescription: 'शेयर पूँजी, प्रवेश शुल्क और डिविडेंड का पारदर्शी हिसाब कैसे रखें — सदस्य-भरोसा बढ़ाने वाली गाइड।',
    date: '2026-06-18',
    category: 'सदस्य व ऋण',
    title: 'सदस्य व शेयर रजिस्टर: सहकारी समिति में सही लेखांकन',
    shortTitle: 'सदस्य व शेयर रजिस्टर लेखांकन',
    excerpt: 'प्रवेश शुल्क बनाम शेयर पूँजी, सदस्य-बही, डिविडेंड और निकासी पर शेयर-वापसी — सब सही तरीके से।',
    accent: 'rose',
    tags: ['सदस्य', 'शेयर पूँजी', 'डिविडेंड'],
  },
  {
    slug: 'loan-and-interest-accounting',
    metaTitle: 'ऋण व ब्याज लेखांकन: PACS व समितियों के लिए गाइड | SahakarLekha',
    metaDescription: 'सदस्य ऋण, KCC और ब्याज की सही गणना व रिकॉर्डिंग — वसूली व NPA निगरानी सहित।',
    date: '2026-06-17',
    category: 'सदस्य व ऋण',
    title: 'ऋण व ब्याज लेखांकन: PACS व समितियों के लिए गाइड',
    shortTitle: 'ऋण व ब्याज लेखांकन',
    excerpt: 'ऋण को संपत्ति, ब्याज को आय मानना; KCC की बारीकियाँ; और वसूली% व NPA की निगरानी।',
    accent: 'amber',
    tags: ['ऋण', 'ब्याज', 'KCC', 'NPA'],
  },
  {
    slug: 'inventory-and-stock-management',
    metaTitle: 'इन्वेंटरी व स्टॉक प्रबंधन: मार्केटिंग व उपभोक्ता समितियों के लिए | SahakarLekha',
    metaDescription: 'खरीद-बिक्री, स्टॉक वैल्यूएशन और क्लोज़िंग स्टॉक का सटीक हिसाब — फैंटम बैलेंस से बचें।',
    date: '2026-06-16',
    category: 'इन्वेंटरी',
    title: 'इन्वेंटरी व स्टॉक प्रबंधन: मार्केटिंग व उपभोक्ता समितियों के लिए',
    shortTitle: 'इन्वेंटरी व स्टॉक प्रबंधन',
    excerpt: 'एक-सूत्र स्टॉक नियम, वेटेड एवरेज मूल्य, और क्लोज़िंग स्टॉक की एकल गणना से सही लाभ।',
    accent: 'indigo',
    tags: ['इन्वेंटरी', 'स्टॉक', 'closing stock'],
  },
  {
    slug: 'bank-reconciliation-guide',
    metaTitle: 'बैंक समाधान (BRS) कैसे करें: सहकारी समिति गाइड | SahakarLekha',
    metaDescription: 'बैंक स्टेटमेंट और बही का मिलान आसानी से — अंतर कैसे ढूँढें और ठीक करें।',
    date: '2026-06-15',
    category: 'बैंक व रिपोर्ट',
    title: 'बैंक समाधान (BRS) कैसे करें: सहकारी समिति गाइड',
    shortTitle: 'बैंक समाधान (BRS) कैसे करें',
    excerpt: 'अनभुनाए चेक, बैंक प्रभार और छूटी एंट्रियाँ — हर अंतर पहचानकर बैंक बैलेंस मिनटों में मिलाएँ।',
    accent: 'sky',
    tags: ['बैंक समाधान', 'BRS', 'मिलान'],
  },
  {
    slug: 'how-to-read-financial-reports',
    metaTitle: 'वित्तीय रिपोर्ट्स कैसे पढ़ें: Trial Balance से Balance Sheet तक | SahakarLekha',
    metaDescription: 'ट्रायल बैलेंस, लाभ-हानि, रसीद-भुगतान और बैलेंस शीट को आसान हिन्दी में पढ़ना सीखें।',
    date: '2026-06-14',
    category: 'बैंक व रिपोर्ट',
    title: 'वित्तीय रिपोर्ट्स कैसे पढ़ें: Trial Balance से Balance Sheet तक',
    shortTitle: 'वित्तीय रिपोर्ट्स कैसे पढ़ें',
    excerpt: 'हर रिपोर्ट एक सवाल का जवाब है — पाँच मुख्य रिपोर्ट्स और उनका आपसी जुड़ाव सरल भाषा में।',
    accent: 'emerald',
    tags: ['रिपोर्ट', 'ट्रायल बैलेंस', 'बैलेंस शीट'],
  },
  {
    slug: 'audit-preparation-checklist',
    metaTitle: 'सहकारी समिति ऑडिट की तैयारी: संपूर्ण चेकलिस्ट | SahakarLekha',
    metaDescription: 'ऑडिट से पहले क्या तैयार रखें, कौन-सी रिपोर्ट चाहिए और audit paras कैसे घटाएँ — व्यावहारिक चेकलिस्ट।',
    date: '2026-06-13',
    category: 'ऑडिट व अनुपालन',
    title: 'सहकारी समिति ऑडिट की तैयारी: संपूर्ण चेकलिस्ट',
    shortTitle: 'ऑडिट की तैयारी: चेकलिस्ट',
    excerpt: 'तैयार दस्तावेज़, सबसे आम आपत्तियाँ और उनका बचाव — ऑडिट को कुछ दिनों का सहज काम बनाइए।',
    accent: 'violet',
    tags: ['ऑडिट', 'चेकलिस्ट', 'अनुपालन'],
  },
  {
    slug: 'common-accounting-mistakes',
    metaTitle: 'सहकारी समितियों की 10 आम लेखांकन गलतियाँ और बचाव | SahakarLekha',
    metaDescription: 'जो गलतियाँ हर साल ऑडिट में पकड़ी जाती हैं — और उन्हें रोकने के आसान तरीके।',
    date: '2026-06-12',
    category: 'ऑडिट व अनुपालन',
    title: 'सहकारी समितियों की 10 आम लेखांकन गलतियाँ (और उनसे बचाव)',
    shortTitle: '10 आम लेखांकन गलतियाँ',
    excerpt: 'खाते मिलाना, suspense, डबल-काउंट स्टॉक, वाउचर मिटाना — 10 आम चूकें और उनका सरल बचाव।',
    accent: 'rose',
    tags: ['गलतियाँ', 'ऑडिट', 'बचाव'],
  },
  {
    slug: 'future-of-cooperative-erp',
    metaTitle: 'सहकारी ERP का भविष्य: डिजिटल सहकारिता की ओर | SahakarLekha',
    metaDescription: 'क्लाउड, AI और एकीकृत रिपोर्टिंग सहकारी क्षेत्र को कैसे बदलेंगे — और समितियाँ अभी क्या करें।',
    date: '2026-06-11',
    category: 'डिजिटल लेखांकन',
    title: 'सहकारी ERP का भविष्य: डिजिटल सहकारिता की ओर',
    shortTitle: 'सहकारी ERP का भविष्य',
    excerpt: 'क्लाउड-फ़र्स्ट, एकीकृत अनुपालन, रीयल-टाइम डैशबोर्ड और सहायक AI — और तीन सिद्धांत जो नहीं बदलते।',
    accent: 'indigo',
    tags: ['ERP', 'भविष्य', 'क्लाउड'],
  },
  {
    slug: 'voucher-entry-guide',
    metaTitle: 'वाउचर एंट्री कैसे करें: स्टेप-बाय-स्टेप गाइड | SahakarLekha',
    metaDescription: 'Receipt, Payment, Journal व Contra वाउचर सही तरीके से कैसे भरें — उदाहरण सहित संपूर्ण मार्गदर्शिका सहकारी समिति के लिए।',
    date: '2026-06-19',
    category: 'वाउचर एंट्री',
    title: 'वाउचर एंट्री कैसे करें: स्टेप-बाय-स्टेप गाइड',
    shortTitle: 'वाउचर एंट्री कैसे करें',
    excerpt: 'चार प्रकार के वाउचर, "पैसा आया या गया" से Dr/Cr तय करना, और हर रिपोर्ट को सही बनाने का सरल तरीका।',
    accent: 'violet',
    tags: ['वाउचर', 'रसीद-भुगतान', 'डबल-एंट्री'],
  },
  {
    slug: 'cooperative-accounting-basics',
    metaTitle: 'सहकारी लेखांकन की मूल बातें: शुरुआत से समझें | SahakarLekha',
    metaDescription: 'डबल-एंट्री, खातों के पाँच प्रकार, डेबिट-क्रेडिट और लेखांकन समीकरण — नए सचिव व लेखाकार के लिए आसान हिन्दी गाइड।',
    date: '2026-06-21',
    category: 'लेखांकन मूल बातें',
    title: 'सहकारी लेखांकन की मूल बातें: नए सचिव व लेखाकार के लिए',
    shortTitle: 'सहकारी लेखांकन की मूल बातें',
    excerpt: 'खातों के पाँच प्रकार, डेबिट-क्रेडिट का सुनहरा नियम और लेखांकन समीकरण — पूरी बुनियाद एक जगह।',
    accent: 'sky',
    tags: ['बुनियाद', 'डेबिट-क्रेडिट', 'लेखांकन चक्र'],
  },
  {
    slug: 'digital-accounting-for-cooperatives',
    metaTitle: 'सहकारी समितियों को डिजिटल लेखांकन की ज़रूरत क्यों है? | SahakarLekha',
    metaDescription: 'मैनुअल बहीखाते की कमियाँ, ऑडिट की दिक्कतें और डिजिटल लेखांकन के लाभ — जानिए सहकारी समितियाँ अब भी डिजिटल अकाउंटिंग क्यों अपनाएँ।',
    date: '2026-06-23',
    category: 'डिजिटल लेखांकन',
    title: 'सहकारी समितियों को अभी भी डिजिटल लेखांकन की आवश्यकता क्यों है?',
    shortTitle: 'डिजिटल लेखांकन की आवश्यकता क्यों है?',
    excerpt: 'भरोसा, पारदर्शिता और अनुपालन अब कागज़ की पहुँच से बाहर हैं — जानिए मैनुअल से डिजिटल की ओर बढ़ना अभी क्यों ज़रूरी है।',
    accent: 'emerald',
    tags: ['डिजिटल लेखांकन', 'ऑडिट', 'पारदर्शिता'],
  },
];

// raw markdown for every post, keyed by "./<slug>.md"
const RAW = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export function loadBlogRaw(slug: string): string | null {
  return RAW['./' + slug + '.md'] ?? null;
}

/** Posts sorted newest-first (ALL posts, incl. future-scheduled). */
export const BLOG_ORDER: BlogPost[] = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

/** Today as YYYY-MM-DD (local). Recomputed at call time so scheduled posts
 *  auto-reveal in the browser once their date arrives — no rebuild needed. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A post is "live" once its publish date is today or earlier. */
export function isPublished(p: BlogPost): boolean {
  return p.date <= todayISO();
}

/** Published posts only, newest-first — the public reading order (index, prev/next). */
export function publishedOrder(): BlogPost[] {
  return BLOG_ORDER.filter(isPublished);
}

export function findPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}

/** Estimated reading time in minutes from the post's markdown (Hindi ~130 wpm). */
export function readingMinutes(slug: string): number {
  const raw = loadBlogRaw(slug);
  if (!raw) return 1;
  const body = raw.replace(/^#\s+.*(\r?\n)+/, '');
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 130));
}

/** Up to `n` related posts (published only; same category first, then newest). */
export function relatedPosts(slug: string, n = 2): BlogPost[] {
  const self = findPost(slug);
  if (!self) return [];
  const others = publishedOrder().filter((p) => p.slug !== slug);
  const sameCat = others.filter((p) => p.category === self.category);
  const rest = others.filter((p) => p.category !== self.category);
  return [...sameCat, ...rest].slice(0, n);
}
