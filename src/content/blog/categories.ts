/**
 * Blog categories — the ONE list of topics a post can belong to. Each category has
 * its own crawlable hub at /blog/category/<slug> (src/pages/BlogCategory.tsx, and
 * prerendered by scripts/prerender-guide.mjs, which loads this module).
 *
 * A post's `category:` in ./index.ts must be one of the `name`s below — the type
 * BlogCategoryName enforces it, and test-blog-categories.mjs checks it too.
 * Order here is the display order on /blog.
 */
export interface BlogCategory {
  /** URL segment: /blog/category/<slug> */
  slug: string;
  /** Hindi label shown on chips, headings and breadcrumbs */
  name: string;
  /** <title> of the hub page */
  metaTitle: string;
  /** meta description of the hub page */
  description: string;
  /** one or two lines shown under the hub's h1 */
  intro: string;
}

export const BLOG_CATEGORIES = [
  {
    slug: 'accounting-basics',
    name: 'लेखांकन की बुनियाद',
    metaTitle: 'लेखांकन की बुनियाद: सहकारी समिति के लिए | सहकार लेखा ब्लॉग',
    description: 'डबल एंट्री, लेजर, खातों का चार्ट, वित्तीय वर्ष और डेप्रिसिएशन — सहकारी समिति के हिसाब की बुनियादी बातें आसान भाषा में।',
    intro: 'हिसाब-किताब नया सीख रहे हैं? डेबिट-क्रेडिट से लेकर लेजर और डेप्रिसिएशन तक — यहाँ से शुरू करें।',
  },
  {
    slug: 'vouchers-daily-accounts',
    name: 'वाउचर व रोज़ का हिसाब',
    metaTitle: 'वाउचर, कैश बुक व बैंक मिलान: रोज़ का हिसाब | सहकार लेखा ब्लॉग',
    description: 'वाउचर एंट्री, भुगतान की मंज़ूरी, कैश बुक, बैंक मिलान (BRS), स्टॉक और वेतन — सहकारी समिति के रोज़ के लेखा-काम पर लेख।',
    intro: 'लेखाकार और कोषाध्यक्ष के रोज़ के काम: वाउचर भरना, नकद-बैंक संभालना, महीने का मिलान।',
  },
  {
    slug: 'members-shares-loans',
    name: 'सदस्य, शेयर, जमा व ऋण',
    metaTitle: 'सदस्य, शेयर, जमा व ऋण का हिसाब | सहकार लेखा ब्लॉग',
    description: 'सदस्यता, शेयर कैपिटल, सदस्य जमा पर ब्याज, KCC व फसल ऋण, वसूली और डिविडेंड — सदस्यों से जुड़े हिसाब पर लेख।',
    intro: 'सदस्यता से लेकर शेयर, जमा, ऋण और वसूली तक — सचिव और लेखाकार के लिए।',
  },
  {
    slug: 'reports-audit-year-end',
    name: 'रिपोर्ट, ऑडिट व वर्ष-अंत',
    metaTitle: 'रिपोर्ट, ऑडिट व वर्ष-अंत की तैयारी | सहकार लेखा ब्लॉग',
    description: 'ट्रायल बैलेंस, वित्तीय रिपोर्ट, ऑडिट वर्गीकरण, आंतरिक नियंत्रण, लाभ का बँटवारा और वर्षांत — सहकारी समिति की रिपोर्टिंग और ऑडिट पर लेख।',
    intro: 'ट्रायल बैलेंस पढ़ने से लेकर ऑडिट की तैयारी और साल बंद करने तक।',
  },
  {
    slug: 'tax-statutory-returns',
    name: 'कर व वैधानिक रिटर्न',
    metaTitle: 'GST, TDS व वैधानिक रिटर्न: सहकारी समिति | सहकार लेखा ब्लॉग',
    description: 'GST, TDS व 26Q, तिमाही अनुपालन कैलेंडर, वार्षिक और NABARD/फेडरेशन रिटर्न — सहकारी समिति के कर व रिटर्न पर लेख।',
    intro: 'कौन-सा कर, कौन-सा रिटर्न, कब तक — लेखाकार के लिए।',
  },
  {
    slug: 'law-governance',
    name: 'कानून, पंजीकरण व शासन',
    metaTitle: 'सहकारी कानून, पंजीकरण, उपविधि व बैठकें | सहकार लेखा ब्लॉग',
    description: 'पंजीकरण, उपविधि, अधिनियम व नियम, बोर्ड बैठक, AGM, चुनाव, पदाधिकारियों के अधिकार और कर्मचारी सेवा नियम — सहकारी समिति के कानून और शासन पर लेख।',
    intro: 'सचिव और पदाधिकारियों के लिए: नियम क्या कहते हैं, बैठक कैसे हो, किसके क्या अधिकार हैं।',
  },
  {
    slug: 'society-types',
    name: 'समिति के प्रकार',
    metaTitle: 'PACS, CM-PACS, डेयरी, उपभोक्ता व आवास समिति | सहकार लेखा ब्लॉग',
    description: 'PACS, CM-PACS, दुग्ध, उपभोक्ता भंडार, आवास और महिला समितियाँ — हर प्रकार की सहकारी समिति का काम और हिसाब।',
    intro: 'आपकी समिति किस प्रकार की है? उसके काम और हिसाब की ख़ास बातें यहाँ।',
  },
  {
    slug: 'schemes-procurement',
    name: 'योजनाएँ, खरीद व सरकारी अपडेट',
    metaTitle: 'सहकारी योजनाएँ, MSP खरीद व सरकारी अपडेट | सहकार लेखा ब्लॉग',
    description: 'HAFED/MSP खरीद, गोदाम, PM-KUSUM, CSC, NCDC योजनाएँ, PACS कंप्यूटरीकरण और सहकारिता नीति — सहकारी समितियों के लिए सरकारी योजनाएँ और अपडेट।',
    intro: 'सरकारी योजनाएँ, खरीद और नीति के अपडेट। ये लेख समय के साथ बदलते हैं, इसलिए हर लेख की तारीख़ देखें।',
  },
  {
    slug: 'cooperative-movement',
    name: 'सहकारिता आंदोलन',
    metaTitle: 'सहकारिता आंदोलन: इतिहास, संस्थाएँ व सफलता की कहानियाँ | सहकार लेखा ब्लॉग',
    description: 'सहकारिता के सिद्धांत, इतिहास, NABARD/NCDC की भूमिका, Amul, IFFCO, NDDB और सफलता की कहानियाँ — सहकारिता आंदोलन पर लेख।',
    intro: 'सहकारिता क्या है, कहाँ से आई और किन संस्थाओं ने इसे बड़ा बनाया।',
  },
  {
    slug: 'digital-accounting',
    name: 'डिजिटल लेखांकन व सहकार लेखा',
    metaTitle: 'डिजिटल लेखांकन व सहकार लेखा का उपयोग | सहकार लेखा ब्लॉग',
    description: 'सही सॉफ्टवेयर चुनना, Tally/Excel से माइग्रेशन, भूमिका व अनुमति, डेटा बैकअप और सहकार लेखा से शुरुआत — डिजिटल लेखांकन पर लेख।',
    intro: 'कागज़ या Excel से डिजिटल हिसाब पर कैसे आएँ, और सहकार लेखा का इस्तेमाल कैसे करें।',
  },
] as const satisfies readonly BlogCategory[];

export type BlogCategoryName = (typeof BLOG_CATEGORIES)[number]['name'];

const BY_NAME = new Map<string, BlogCategory>(BLOG_CATEGORIES.map((c) => [c.name, c]));
const BY_SLUG = new Map<string, BlogCategory>(BLOG_CATEGORIES.map((c) => [c.slug, c]));

export function categoryByName(name: string): BlogCategory | null {
  return BY_NAME.get(name) ?? null;
}

export function categoryBySlug(slug: string): BlogCategory | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Hub URL for a category name; falls back to /blog for an unknown name. */
export function categoryHref(name: string): string {
  const c = BY_NAME.get(name);
  return c ? `/blog/category/${c.slug}` : '/blog';
}
