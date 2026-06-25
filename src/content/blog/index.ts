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

/** Posts sorted newest-first (the canonical order for index + prev/next). */
export const BLOG_ORDER: BlogPost[] = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

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

/** Up to `n` related posts (same category first, then newest others). */
export function relatedPosts(slug: string, n = 2): BlogPost[] {
  const self = findPost(slug);
  if (!self) return [];
  const others = BLOG_ORDER.filter((p) => p.slug !== slug);
  const sameCat = others.filter((p) => p.category === self.category);
  const rest = others.filter((p) => p.category !== self.category);
  return [...sameCat, ...rest].slice(0, n);
}
