/**
 * Hub-page <title>/description — ONE source for the React page (useDocumentMeta) and the static
 * prerender (scripts/prerender-guide.mjs) (Phase L5).
 *
 * A render of all 376 live pages found the two copies had drifted on every hub: crawlers' first HTML said
 * one thing, the rendered page another (/guide even disagreed on the facts: "9 भाग" vs "30 अध्याय" —
 * the course has 10 parts and 35 chapters; test:hub-meta pins those numbers to the guide registry).
 * Pure (no imports) so the prerender can load it.
 */
export const HUB_META = {
  guide: {
    title: 'सहकार लेखा गाइड — सम्पूर्ण सहकारी लेखांकन कोर्स (हिंदी, मुफ़्त)',
    description: 'सहकारी समितियों के लिए सम्पूर्ण लेखांकन कोर्स — बिक्री, खरीद, स्टॉक, GST/TDS, अंतिम खाते, ऑडिट व वर्षांत। 10 भाग, 35 अध्याय, क्विज़ व प्रमाणपत्र — सरल हिंदी, बिल्कुल मुफ़्त।',
  },
  blog: {
    title: 'सहकार लेखा ब्लॉग — सहकारी समिति लेखांकन, ऑडिट व प्रबंधन',
    description: 'सहकारी समितियों के लिए डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट, अनुपालन व प्रबंधन पर सरल हिन्दी लेख — PACS, मार्केटिंग, उपभोक्ता व बहुउद्देशीय समितियों के लिए।',
  },
  help: {
    title: 'मदद केंद्र (Help Center) — कैसे करें | SahakarLekha',
    description: 'सहकारी समिति लेखांकन के रोज़मर्रा के काम — Member कैसे जोड़ें, Opening Balance कैसे डालें, Voucher कैसे करें — आसान स्टेप-बाय-स्टेप, सीधे app में करने के लिंक सहित।',
  },
  cookbook: {
    title: 'एंट्री कुकबुक (Accounting Entries) — कौन-सी एंट्री कैसे करें | SahakarLekha',
    description: 'सहकारी समिति की आम journal entries — नकद/उधार बिक्री-खरीद, शेयर पूँजी, ऋण-ब्याज, वेतन, डेप्रिसिएशन, क्लोज़िंग स्टॉक, HAFED कमीशन — हर एक का Dr/Cr उदाहरण सहित।',
  },
  glossary: {
    title: 'सहकारी लेखांकन शब्दकोश (Glossary) — हर शब्द आसान भाषा में | SahakarLekha',
    description: 'कैश बुक से बैलेंस शीट तक — सहकारी समिति लेखांकन के मुख्य शब्दों का आसान हिन्दी व English शब्दकोश। हर शब्द से जुड़ी गाइड, मदद व सॉफ्टवेयर तक पहुँचें।',
  },
  tools: {
    title: 'सहकारी लेखांकन कैलकुलेटर (Calculators) — मुफ्त | SahakarLekha',
    description: 'ब्याज, EMI, डेप्रिसिएशन, GST, TDS, शेयर कैपिटल, कैश अंतर, प्रतिशत व वर्किंग कैपिटल — सहकारी समिति के लिए मुफ्त, आसान कैलकुलेटर, सूत्र व समझाइश सहित।',
  },
} as const;

/** Markdown → one plain line for a meta description (same rule as the prerender's kiPlain). */
export function metaPlain(s: string | undefined | null): string {
  return (s || '')
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A glossary term's description: its Hindi explanation (the site is hi-IN), else the definition. */
export function glossaryMetaDescription(term: { hindi?: string; definition?: string }): string {
  return (metaPlain(term.hindi) || metaPlain(term.definition)).slice(0, 158);
}
