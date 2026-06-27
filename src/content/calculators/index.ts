/**
 * SahakarLekha Calculator Engine — the registry (single source of truth).
 *
 * Each calculator is a data config: metadata (slug/meta first, for the prerender +
 * sitemap, like blog/index.ts), inputs, a pure `compute()` returning render-ready
 * results, content (formula/explanation/example/mistakes as markdown), and relations
 * (glossary/KIs/articles/help/modules). The shared CalculatorShell renders all of them,
 * so adding a calculator = adding one config here — no new components, no duplicate code.
 *
 * RULE: no statutory rate is hardcoded. Every rate is a user input. Educational only.
 *
 * NOTE for scripts/prerender-guide.mjs: it regexes this file expecting, per calculator,
 * `slug:`, `metaTitle:`, `metaDescription:` as single-quoted strings IN THAT ORDER, first.
 * Keep them first and avoid raw apostrophes inside them.
 */
import {
  depreciation, simpleInterest, compoundInterest, shareCapital, gst, tds, emi,
  cashDifference, percentage, workingCapital, inr, num, pct,
} from '@/lib/calculators/formulas';

export interface CalcInput {
  key: string;
  label: string;          // Hindi label
  sub?: string;           // small English/help hint
  type: 'number' | 'select';
  options?: { value: string; label: string }[];
  default: number | string;
  min?: number;
  step?: number;
  prefix?: string;        // e.g. ₹
  suffix?: string;        // e.g. %, वर्ष, महीने
}
export interface CalcStat { label: string; value: string; primary?: boolean; tone?: 'good' | 'bad' | 'neutral' }
export interface CalcTable { head: string[]; rows: string[][] }
export interface CalcResult { ok: boolean; stats: CalcStat[]; table?: CalcTable; note?: string }
export interface CalcFaq { q: string; a: string }

export interface CalcConfig {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  category: string;
  title: string;          // hero (Hindi)
  hindiName: string;
  englishName: string;
  intro: string;
  keywords: string[];
  inputs: CalcInput[];
  compute: (v: Record<string, number | string>) => CalcResult;
  formula: string;        // markdown
  explanation: string;    // markdown
  example: string;        // markdown
  mistakes: string;       // markdown
  relatedGlossary: string[];                 // ACTIVE glossary slugs only
  relatedKIs: string[];                      // source KI ids (shown as evidence)
  relatedArticles: { slug: string; title: string }[];
  relatedHelp?: { slug: string; title: string }[];
  relatedModules: { route: string; label: string }[];
  faqs?: CalcFaq[];                          // → FAQ section + FAQPage JSON-LD
  related?: string[];                        // related calculator slugs (cluster)
  nev?: boolean;          // statutory-adjacent (rates user-entered) → show note
}

const N = (v: number | string) => (typeof v === 'number' ? v : Number(v));
const bad: CalcResult = { ok: false, stats: [], note: 'कृपया सभी मान सही (धनात्मक) भरें।' };

export const CALCULATORS: CalcConfig[] = [
  /* 1 ── Depreciation (SLM / WDV) ── */
  {
    slug: 'depreciation-calculator',
    metaTitle: 'डेप्रिसिएशन (Depreciation) कैलकुलेटर — SLM व WDV | SahakarLekha',
    metaDescription: 'सीधी रेखा (SLM) और घटते मूल्य (WDV) से डेप्रिसिएशन निकालें — दर आप डालें, शेड्यूल तुरंत पाएं। सहकारी समिति के लिए मुफ्त कैलकुलेटर।',
    category: 'संपत्ति', title: 'डेप्रिसिएशन कैलकुलेटर (SLM / WDV)',
    hindiName: 'डेप्रिसिएशन कैलकुलेटर', englishName: 'Depreciation Calculator',
    intro: 'संपत्ति की घटती कीमत हर साल कैसे दर्ज करें — SLM या WDV से, आपकी दर पर।',
    keywords: ['डेप्रिसिएशन', 'depreciation', 'SLM', 'WDV', 'घिसाई', 'ghisai'],
    inputs: [
      { key: 'method', label: 'विधि', type: 'select', default: 'slm', options: [{ value: 'slm', label: 'सीधी रेखा (SLM)' }, { value: 'wdv', label: 'घटते मूल्य (WDV)' }] },
      { key: 'cost', label: 'संपत्ति की लागत', type: 'number', default: 100000, min: 0, prefix: '₹' },
      { key: 'rate', label: 'डेप्रिसिएशन दर', sub: 'आप डालें (कोई कानूनी दर नहीं)', type: 'number', default: 10, min: 0, step: 0.01, suffix: '%' },
      { key: 'years', label: 'कितने वर्ष', type: 'number', default: 5, min: 1, suffix: 'वर्ष' },
      { key: 'salvage', label: 'सैल्वेज वैल्यू (SLM)', sub: 'वैकल्पिक', type: 'number', default: 0, min: 0, prefix: '₹' },
    ],
    compute: (v) => {
      const cost = N(v.cost), rate = N(v.rate), years = N(v.years), salvage = N(v.salvage) || 0, method = String(v.method);
      if (!(cost > 0) || !(rate >= 0) || !(years > 0)) return bad;
      const r = depreciation(method as 'slm' | 'wdv', cost, rate, years, salvage);
      return {
        ok: true,
        stats: [
          { label: 'कुल डेप्रिसिएशन', value: inr(r.totalDep), primary: true },
          { label: 'अंतिम बही मूल्य', value: inr(r.closingValue ?? 0) },
        ],
        table: { head: ['वर्ष', 'प्रारंभिक', 'डेप्रिसिएशन', 'अंतिम'], rows: r.schedule.map((s) => [String(s.year), inr(s.opening, 0), inr(s.depreciation, 0), inr(s.closing, 0)]) },
        note: method === 'wdv' ? 'WDV — हर साल घटते बही मूल्य पर दर लगती है।' : 'SLM — हर साल मूल लागत पर बराबर डेप्रिसिएशन।',
      };
    },
    formula: 'SLM (सीधी रेखा): `वार्षिक डेप्रिसिएशन = लागत × दर%`\n\nWDV (घटते मूल्य): `वार्षिक डेप्रिसिएशन = प्रारंभिक बही मूल्य × दर%`',
    explanation: 'डेप्रिसिएशन संपत्ति की घटती कीमत को हर साल खर्च के रूप में दर्ज करता है। **SLM** में हर साल बराबर राशि घटती है; **WDV** में शुरुआती साल ज़्यादा, बाद में कम। दर आप दर्ज करते हैं — कोई कानूनी दर यहाँ तय नहीं की गई।',
    example: 'लागत ₹1,00,000, दर 10%, 5 वर्ष — SLM में हर साल ₹10,000; WDV में पहले साल ₹10,000, दूसरे साल ₹9,000 (₹90,000 का 10%), और इसी तरह घटते हुए।',
    mistakes: '- ❌ SLM और WDV को मिला देना — दोनों का तरीका अलग है।\n- ❌ कानूनी दर मान लेना — सही दर अपने CA/नियमों से लें, यहाँ आप ही डालें।\n- ❌ सैल्वेज वैल्यू भूलना (SLM में बही मूल्य उससे नीचे नहीं जाता)।',
    relatedGlossary: ['asset', 'accounting-period', 'expense'],
    relatedKIs: ['KI-000112', 'KI-000111', 'KI-000034'],
    relatedArticles: [{ slug: 'depreciation-explained', title: 'डेप्रिसिएशन कैसे करें' }],
    relatedModules: [{ route: '/depreciation-schedule', label: 'डेप्रिसिएशन शेड्यूल' }, { route: '/asset-register', label: 'एसेट रजिस्टर' }],
    nev: true,
  },

  /* 2 ── Simple Interest ── */
  {
    slug: 'simple-interest-calculator',
    metaTitle: 'सिंपल इंटरेस्ट (Simple Interest) कैलकुलेटर | SahakarLekha',
    metaDescription: 'मूलधन, दर और समय डालें — सिंपल इंटरेस्ट और कुल राशि तुरंत पाएं, सूत्र व उदाहरण सहित। सहकारी समिति के लिए मुफ्त कैलकुलेटर।',
    category: 'ब्याज', title: 'सिंपल इंटरेस्ट कैलकुलेटर',
    hindiName: 'सिंपल इंटरेस्ट कैलकुलेटर', englishName: 'Simple Interest Calculator',
    intro: 'मूलधन × दर × समय — सिंपल इंटरेस्ट और कुल राशि एक क्लिक पर।',
    keywords: ['सिंपल इंटरेस्ट', 'simple interest', 'byaj', 'ब्याज'],
    inputs: [
      { key: 'principal', label: 'मूलधन', type: 'number', default: 50000, min: 0, prefix: '₹' },
      { key: 'rate', label: 'वार्षिक दर', type: 'number', default: 8, min: 0, step: 0.01, suffix: '%' },
      { key: 'years', label: 'समय', type: 'number', default: 2, min: 0, step: 0.01, suffix: 'वर्ष' },
    ],
    compute: (v) => {
      const p = N(v.principal), r = N(v.rate), t = N(v.years);
      if (!(p > 0) || !(r >= 0) || !(t >= 0)) return bad;
      const res = simpleInterest(p, r, t);
      return { ok: true, stats: [
        { label: 'ब्याज', value: inr(res.interest), primary: true },
        { label: 'कुल राशि (मूलधन + ब्याज)', value: inr(res.total) },
      ] };
    },
    formula: '`सिंपल इंटरेस्ट (SI) = (मूलधन × दर × समय) ÷ 100`\n\n`कुल राशि = मूलधन + ब्याज`',
    explanation: 'सिंपल इंटरेस्ट हर साल केवल **मूलधन** पर लगता है — ब्याज पर ब्याज नहीं। यह छोटे-अवधि के कर्ज़ या जमा के अनुमान के लिए उपयोगी है।',
    example: 'मूलधन ₹50,000, दर 8%, समय 2 वर्ष — ब्याज = (50000 × 8 × 2) ÷ 100 = ₹8,000; कुल राशि = ₹58,000।',
    mistakes: '- ❌ समय को महीनों में डालना (इसे वर्षों में डालें — 6 महीने = 0.5)।\n- ❌ साधारण और कंपाउंड इंटरेस्ट को एक मानना।',
    relatedGlossary: [],
    relatedKIs: ['KI-000070', 'KI-000069'],
    relatedArticles: [{ slug: 'loan-and-interest-accounting', title: 'ऋण व ब्याज लेखांकन' }],
    relatedModules: [{ route: '/loan-register', label: 'ऋण रजिस्टर' }, { route: '/loan-interest', label: 'ऋण ब्याज' }],
  },

  /* 3 ── Compound Interest ── */
  {
    slug: 'compound-interest-calculator',
    metaTitle: 'कंपाउंड इंटरेस्ट (Compound Interest) कैलकुलेटर | SahakarLekha',
    metaDescription: 'वार्षिक, छमाही, तिमाही या मासिक कंपाउंड पर ब्याज निकालें — सूत्र, गणना व वर्ष-दर-वर्ष वृद्धि तालिका सहित।',
    category: 'ब्याज', title: 'कंपाउंड इंटरेस्ट कैलकुलेटर',
    hindiName: 'कंपाउंड इंटरेस्ट कैलकुलेटर', englishName: 'Compound Interest Calculator',
    intro: 'ब्याज पर ब्याज — वार्षिक/छमाही/तिमाही/मासिक कंपाउंड और वृद्धि तालिका।',
    keywords: ['कंपाउंड इंटरेस्ट', 'compound interest', 'CI'],
    inputs: [
      { key: 'principal', label: 'मूलधन', type: 'number', default: 50000, min: 0, prefix: '₹' },
      { key: 'rate', label: 'वार्षिक दर', type: 'number', default: 8, min: 0, step: 0.01, suffix: '%' },
      { key: 'years', label: 'समय', type: 'number', default: 3, min: 1, suffix: 'वर्ष' },
      { key: 'freq', label: 'कंपाउंड', type: 'select', default: '1', options: [{ value: '1', label: 'वार्षिक' }, { value: '2', label: 'छमाही' }, { value: '4', label: 'तिमाही' }, { value: '12', label: 'मासिक' }] },
    ],
    compute: (v) => {
      const p = N(v.principal), r = N(v.rate), t = N(v.years), f = N(v.freq);
      if (!(p > 0) || !(r >= 0) || !(t > 0)) return bad;
      const res = compoundInterest(p, r, t, f as 1 | 2 | 4 | 12);
      return { ok: true, stats: [
        { label: 'कंपाउंड इंटरेस्ट', value: inr(res.interest), primary: true },
        { label: 'कुल राशि', value: inr(res.total) },
      ], table: { head: ['वर्ष', 'राशि', 'कुल ब्याज'], rows: res.schedule.map((s) => [String(s.year), inr(s.amount, 0), inr(s.interest, 0)]) } };
    },
    formula: '`कुल राशि A = मूलधन × (1 + (दर÷n)/100)^(n × वर्ष)`\n\nजहाँ `n` = एक साल में कंपाउंड की संख्या (वार्षिक=1, छमाही=2, तिमाही=4, मासिक=12)। `ब्याज = A − मूलधन`।',
    explanation: 'कंपाउंड इंटरेस्ट में हर अवधि का ब्याज मूलधन में जुड़ जाता है, इसलिए अगली अवधि में **ब्याज पर भी ब्याज** लगता है। कंपाउंड जितनी बार-बार, राशि उतनी ज़्यादा।',
    example: 'मूलधन ₹50,000, दर 8%, 3 वर्ष, वार्षिक — A = 50000 × (1.08)³ ≈ ₹62,986; ब्याज ≈ ₹12,986।',
    mistakes: '- ❌ सिंपल इंटरेस्ट का सूत्र लगाना।\n- ❌ कंपाउंड की संख्या (n) गलत चुनना।',
    relatedGlossary: [],
    relatedKIs: ['KI-000070', 'KI-000080'],
    relatedArticles: [{ slug: 'loan-and-interest-accounting', title: 'ऋण व ब्याज लेखांकन' }],
    relatedModules: [{ route: '/loan-register', label: 'ऋण रजिस्टर' }],
  },

  /* 4 ── Share Capital (educational) ── */
  {
    slug: 'share-capital-calculator',
    metaTitle: 'शेयर कैपिटल (Share Capital) कैलकुलेटर | SahakarLekha',
    metaDescription: 'फेस वैल्यू, शेयरों की संख्या और चुकता % डालें — निर्गमित, सब्सक्राइब्ड व पेड-अप कैपिटल देखें। केवल शैक्षिक गणना।',
    category: 'सदस्य व शेयर', title: 'शेयर कैपिटल कैलकुलेटर',
    hindiName: 'शेयर कैपिटल कैलकुलेटर', englishName: 'Share Capital Calculator',
    intro: 'फेस वैल्यू × शेयर = इश्यूड कैपिटल; चुकता % से पेड-अप कैपिटल — शैक्षिक।',
    keywords: ['शेयर कैपिटल', 'share capital', 'paid up', 'पेड-अप कैपिटल'],
    inputs: [
      { key: 'faceValue', label: 'फेस वैल्यू (प्रति शेयर)', type: 'number', default: 100, min: 0, prefix: '₹' },
      { key: 'numShares', label: 'शेयरों की संख्या (निर्गमित)', type: 'number', default: 6000, min: 0 },
      { key: 'paidPct', label: 'चुकता %', type: 'number', default: 100, min: 0, step: 0.01, suffix: '%' },
      { key: 'authShares', label: 'अधिकृत शेयर (वैकल्पिक)', type: 'number', default: 10000, min: 0 },
    ],
    compute: (v) => {
      const fv = N(v.faceValue), ns = N(v.numShares), pp = N(v.paidPct), au = N(v.authShares);
      if (!(fv > 0) || !(ns > 0) || !(pp >= 0)) return bad;
      const r = shareCapital(fv, ns, pp, au);
      return { ok: true, stats: [
        { label: 'ऑथराइज़्ड कैपिटल', value: r.authorised != null ? inr(r.authorised, 0) : '—' },
        { label: 'इश्यूड कैपिटल', value: inr(r.issued, 0) },
        { label: 'सब्सक्राइब्ड कैपिटल', value: inr(r.subscribed, 0) },
        { label: 'पेड-अप कैपिटल', value: inr(r.paidUp, 0), primary: true },
      ], note: 'शैक्षिक गणना — सब्सक्राइब्ड = निर्गमित मानी गई है (आम सहकारी स्थिति)।' };
    },
    formula: '`इश्यूड कैपिटल = फेस वैल्यू × शेयरों की संख्या`\n\n`पेड-अप कैपिटल = इश्यूड कैपिटल × चुकता% ÷ 100`\n\n`ऑथराइज़्ड कैपिटल = फेस वैल्यू × अधिकृत शेयर` (यदि भरा हो)',
    explanation: 'शेयर कैपिटल के तीन रूप होते हैं — **अधिकृत** (अनुमत सीमा), **निर्गमित** (जारी शेयर) और **चुकता** (वास्तव में चुकाई गई)। क्रम: अधिकृत ≥ निर्गमित ≥ चुकता। बैलेंस शीट पर असली आँकड़ा **पेड-अप कैपिटल** है।',
    example: 'फेस वैल्यू ₹100, 6,000 शेयर, चुकता 90% — निर्गमित = ₹6,00,000; चुकता = ₹5,40,000।',
    mistakes: '- ❌ ऑथराइज़्ड कैपिटल को "उपलब्ध पैसा" मान लेना — असली आँकड़ा पेड-अप कैपिटल है।\n- ❌ निर्गमित को अधिकृत सीमा से ऊपर दिखाना।',
    relatedGlossary: ['share', 'face-value', 'authorised-capital', 'issued-capital', 'paid-up-capital', 'share-certificate'],
    relatedKIs: ['KI-000153', 'KI-000155', 'KI-000156', 'KI-000157', 'KI-000158'],
    relatedArticles: [{ slug: 'share-capital-authorised-issued-paidup', title: 'शेयर कैपिटल के प्रकार' }, { slug: 'member-and-share-accounting', title: 'सदस्य व शेयर रजिस्टर' }],
    relatedModules: [{ route: '/share-register', label: 'शेयर रजिस्टर' }],
  },

  /* 5 ── GST (exclusive / inclusive) ── */
  {
    slug: 'gst-calculator',
    metaTitle: 'GST कैलकुलेटर — Exclusive व Inclusive | SahakarLekha',
    metaDescription: 'राशि और GST दर डालें — आधार, GST (CGST+SGST) और कुल राशि निकालें। दर आप डालें, कोई दर तय नहीं। केवल शैक्षिक।',
    category: 'कर', title: 'GST कैलकुलेटर',
    hindiName: 'GST कैलकुलेटर', englishName: 'GST Calculator',
    intro: 'राशि + दर → आधार, GST (CGST/SGST) और कुल। दर आप डालते हैं।',
    keywords: ['GST', 'जीएसटी', 'gst calculator', 'cgst', 'sgst'],
    inputs: [
      { key: 'mode', label: 'राशि का प्रकार', type: 'select', default: 'exclusive', options: [{ value: 'exclusive', label: 'GST रहित (Exclusive)' }, { value: 'inclusive', label: 'GST सहित (Inclusive)' }] },
      { key: 'amount', label: 'राशि', type: 'number', default: 10000, min: 0, prefix: '₹' },
      { key: 'rate', label: 'GST दर', sub: 'आप डालें (कोई दर तय नहीं)', type: 'number', default: 18, min: 0, step: 0.01, suffix: '%' },
    ],
    compute: (v) => {
      const amount = N(v.amount), rate = N(v.rate), mode = String(v.mode);
      if (!(amount > 0) || !(rate >= 0)) return bad;
      const r = gst(amount, rate, mode as 'exclusive' | 'inclusive');
      return { ok: true, stats: [
        { label: 'आधार राशि', value: inr(r.base) },
        { label: 'कुल GST', value: inr(r.gst), primary: true },
        { label: 'CGST', value: inr(r.cgst) },
        { label: 'SGST', value: inr(r.sgst) },
        { label: 'कुल राशि', value: inr(r.total) },
      ], note: mode === 'inclusive' ? 'दी गई राशि में GST शामिल माना गया।' : 'दी गई राशि पर GST जोड़ा गया।' };
    },
    formula: 'GST रहित: `GST = राशि × दर% ÷ 100`, `कुल = राशि + GST`\n\nGST सहित: `आधार = राशि × 100 ÷ (100 + दर%)`, `GST = राशि − आधार`\n\n`CGST = SGST = GST ÷ 2` (राज्य के भीतर)',
    explanation: 'GST राशि पर लगने वाला कर है। **Exclusive** का मतलब राशि कर रहित है (कर जोड़ना है); **Inclusive** का मतलब राशि में कर पहले से शामिल है (अलग करना है)। राज्य के भीतर GST आम तौर पर CGST व SGST में बँटता है।',
    example: 'राशि ₹10,000, दर 18% (exclusive) — GST = ₹1,800 (CGST ₹900 + SGST ₹900); कुल = ₹11,800।',
    mistakes: '- ❌ Exclusive और Inclusive को उलटना।\n- ❌ कोई "मानक" दर मान लेना — सही दर आइटम/नियमों के अनुसार आप डालें। **विशेषज्ञ सत्यापन ज़रूरी।**',
    relatedGlossary: [],
    relatedKIs: ['KI-000124'],
    relatedArticles: [{ slug: 'gst-for-cooperatives', title: 'GST सहकारी समिति के लिए' }],
    relatedModules: [{ route: '/gst-summary', label: 'GST सारांश' }, { route: '/hsn-master', label: 'HSN मास्टर' }],
    nev: true,
  },

  /* 6 ── TDS ── */
  {
    slug: 'tds-calculator',
    metaTitle: 'TDS कैलकुलेटर — राशि व दर डालें | SahakarLekha',
    metaDescription: 'भुगतान राशि और TDS दर डालें — कटौती (TDS) और शुद्ध भुगतान निकालें। दर आप डालें, कोई कानूनी दर सुझाई नहीं जाती।',
    category: 'कर', title: 'TDS कैलकुलेटर',
    hindiName: 'TDS कैलकुलेटर', englishName: 'TDS Calculator',
    intro: 'राशि + दर → TDS कटौती और शुद्ध भुगतान। दर आप डालते हैं।',
    keywords: ['TDS', 'टीडीएस', 'tds calculator', 'कटौती'],
    inputs: [
      { key: 'amount', label: 'भुगतान राशि', type: 'number', default: 50000, min: 0, prefix: '₹' },
      { key: 'rate', label: 'TDS दर', sub: 'आप डालें (कोई दर सुझाई नहीं जाती)', type: 'number', default: 10, min: 0, step: 0.01, suffix: '%' },
    ],
    compute: (v) => {
      const amount = N(v.amount), rate = N(v.rate);
      if (!(amount > 0) || !(rate >= 0)) return bad;
      const r = tds(amount, rate);
      return { ok: true, stats: [
        { label: 'TDS कटौती', value: inr(r.tds), primary: true },
        { label: 'शुद्ध भुगतान', value: inr(r.net) },
      ] };
    },
    formula: '`TDS = भुगतान राशि × दर% ÷ 100`\n\n`शुद्ध भुगतान = भुगतान राशि − TDS`',
    explanation: 'TDS (स्रोत पर कर कटौती) में भुगतान करते समय एक हिस्सा काटकर सरकार को जमा किया जाता है, और शेष भुगतान पाने वाले को मिलता है। **दर और लागू होना** भुगतान के प्रकार पर निर्भर करता है — यह कैलकुलेटर कोई दर नहीं सुझाता; आप दर डालते हैं।',
    example: 'राशि ₹50,000, दर 10% — TDS = ₹5,000; शुद्ध भुगतान = ₹45,000।',
    mistakes: '- ❌ हर भुगतान पर TDS मान लेना — लागू होना नियमों पर निर्भर। **विशेषज्ञ सत्यापन ज़रूरी।**\n- ❌ गलत दर डालना — सही दर/अनुभाग अपने CA से पक्का करें।',
    relatedGlossary: [],
    relatedKIs: ['KI-000134'],
    relatedArticles: [{ slug: 'tds-and-26q-for-societies', title: 'TDS और 26Q गाइड' }],
    relatedModules: [{ route: '/tds-register', label: 'TDS रजिस्टर' }, { route: '/tds-form16a', label: 'फॉर्म 16A' }],
    nev: true,
  },

  /* 7 ── Loan EMI ── */
  {
    slug: 'loan-emi-calculator',
    metaTitle: 'लोन EMI कैलकुलेटर — किस्त, ब्याज व amortization | SahakarLekha',
    metaDescription: 'मूलधन, ब्याज दर और अवधि डालें — मासिक EMI, कुल ब्याज, कुल भुगतान और वर्ष-वार amortization तालिका पाएं।',
    category: 'ऋण', title: 'लोन EMI कैलकुलेटर',
    hindiName: 'लोन EMI कैलकुलेटर', englishName: 'Loan EMI Calculator',
    intro: 'मासिक किस्त (EMI), कुल ब्याज और वर्ष-वार amortization — एक क्लिक पर।',
    keywords: ['EMI', 'loan', 'किस्त', 'ऋण', 'amortization'],
    inputs: [
      { key: 'principal', label: 'ऋण राशि (मूलधन)', type: 'number', default: 300000, min: 0, prefix: '₹' },
      { key: 'rate', label: 'वार्षिक ब्याज दर', type: 'number', default: 9, min: 0, step: 0.01, suffix: '%' },
      { key: 'months', label: 'अवधि', type: 'number', default: 36, min: 1, suffix: 'महीने' },
    ],
    compute: (v) => {
      const p = N(v.principal), rate = N(v.rate), months = N(v.months);
      if (!(p > 0) || !(rate >= 0) || !(months > 0)) return bad;
      const r = emi(p, rate, months);
      return { ok: true, stats: [
        { label: 'मासिक EMI', value: inr(r.emi), primary: true },
        { label: 'कुल ब्याज', value: inr(r.interest) },
        { label: 'कुल भुगतान', value: inr(r.total) },
      ], table: { head: ['वर्ष', 'मूलधन चुकाया', 'ब्याज', 'शेष'], rows: r.yearly.map((y) => [String(y.year), inr(y.principal, 0), inr(y.interest, 0), inr(y.balance, 0)]) } };
    },
    formula: '`EMI = P × r × (1+r)^n ÷ ((1+r)^n − 1)`\n\nजहाँ `P` = मूलधन, `r` = मासिक दर (वार्षिक दर ÷ 12 ÷ 100), `n` = महीनों की संख्या।',
    explanation: 'EMI हर महीने की समान किस्त है जिसमें मूलधन और ब्याज दोनों होते हैं। शुरुआती किस्तों में ब्याज का हिस्सा ज़्यादा, बाद में मूलधन का। amortization तालिका दिखाती है कि हर साल कितना मूलधन घटा।',
    example: 'मूलधन ₹3,00,000, दर 9%, 36 महीने — EMI ≈ ₹9,540; कुल ब्याज ≈ ₹43,430।',
    mistakes: '- ❌ वार्षिक दर को सीधे मासिक मान लेना (दर ÷ 12 करें)।\n- ❌ अवधि को वर्षों में डालना (इसे महीनों में डालें)।',
    relatedGlossary: [],
    relatedKIs: ['KI-000070', 'KI-000077'],
    relatedArticles: [{ slug: 'loan-and-interest-accounting', title: 'ऋण व ब्याज लेखांकन' }, { slug: 'kcc-crop-loan-accounting', title: 'KCC व फसल ऋण' }],
    relatedHelp: [{ slug: 'loan-entry', title: 'Loan Entry कैसे करें' }],
    relatedModules: [{ route: '/loan-register', label: 'ऋण रजिस्टर' }, { route: '/loan-interest', label: 'ऋण ब्याज' }],
  },

  /* 8 ── Cash Difference ── */
  {
    slug: 'cash-difference-calculator',
    metaTitle: 'कैश अंतर (Cash Difference) कैलकुलेटर | SahakarLekha',
    metaDescription: 'कैश बुक का शेष और भौतिक नकद डालें — अंतर, कमी (short) या अधिकता (excess) तुरंत जानें। नकद सत्यापन आसान।',
    category: 'कैश', title: 'कैश अंतर कैलकुलेटर',
    hindiName: 'कैश अंतर कैलकुलेटर', englishName: 'Cash Difference Calculator',
    intro: 'बही का शेष बनाम असल नकद — कमी या अधिकता तुरंत पकड़ें।',
    keywords: ['कैश अंतर', 'cash difference', 'short', 'excess', 'नकद सत्यापन'],
    inputs: [
      { key: 'book', label: 'कैश बुक शेष', type: 'number', default: 12000, min: 0, prefix: '₹' },
      { key: 'physical', label: 'भौतिक नकद (गिनी हुई)', type: 'number', default: 11800, min: 0, prefix: '₹' },
    ],
    compute: (v) => {
      const book = N(v.book), physical = N(v.physical);
      if (!(book >= 0) || !(physical >= 0)) return bad;
      const r = cashDifference(book, physical);
      const label = r.status === 'short' ? 'कमी (Short)' : r.status === 'excess' ? 'अधिकता (Excess)' : 'कोई अंतर नहीं';
      return { ok: true, stats: [
        { label, value: r.status === 'match' ? '₹0' : inr(r.difference), primary: true, tone: r.status === 'match' ? 'good' : 'bad' },
      ], note: r.status === 'match' ? 'बही और भौतिक नकद बराबर — सही!' : 'अंतर मिला — तुरंत जाँचें; यह गलती या रिसाव का संकेत है।' };
    },
    formula: '`अंतर = भौतिक नकद − कैश बुक शेष`\n\nधनात्मक = अधिकता (Excess); ऋणात्मक = कमी (Short); शून्य = बराबर।',
    explanation: 'कैश सत्यापन में असल नकद गिनकर कैश बुक के शेष से मिलाया जाता है। दोनों बराबर होने चाहिए। अंतर का मतलब है कि कहीं एंट्री छूटी, गलत हुई, या रिसाव है — इसे टालें नहीं।',
    example: 'बही शेष ₹12,000, भौतिक नकद ₹11,800 — अंतर ₹200 की **कमी (short)**।',
    mistakes: '- ❌ अंतर को नज़रअंदाज़ करना — हमेशा तुरंत जाँचें।\n- ❌ कैश शेष ऋणात्मक होना (यह असंभव है — गलती का संकेत)।',
    relatedGlossary: ['cash', 'cash-book', 'cash-in-hand', 'cash-account'],
    relatedKIs: ['KI-000099', 'KI-000102', 'KI-000101'],
    relatedArticles: [{ slug: 'cash-handling-and-verification', title: 'कैश संभाल व सत्यापन' }, { slug: 'cash-book-vs-bank-book', title: 'कैश बुक vs बैंक बुक' }],
    relatedHelp: [{ slug: 'cash-book', title: 'Cash Book कैसे देखें' }],
    relatedModules: [{ route: '/cash-book', label: 'कैश बुक' }],
  },

  /* 9 ── Percentage ── */
  {
    slug: 'percentage-calculator',
    metaTitle: 'प्रतिशत (Percentage) कैलकुलेटर — वृद्धि, कमी, अंतर | SahakarLekha',
    metaDescription: 'प्रतिशत वृद्धि, कमी या दो मानों के बीच % अंतर निकालें — तुरंत, सूत्र व उदाहरण सहित। मुफ्त कैलकुलेटर।',
    category: 'सामान्य', title: 'प्रतिशत कैलकुलेटर',
    hindiName: 'प्रतिशत कैलकुलेटर', englishName: 'Percentage Calculator',
    intro: 'वृद्धि, कमी, या दो मानों के बीच प्रतिशत अंतर — तुरंत।',
    keywords: ['प्रतिशत', 'percentage', 'percent', 'वृद्धि', 'कमी'],
    inputs: [
      { key: 'mode', label: 'प्रकार', type: 'select', default: 'increase', options: [{ value: 'increase', label: '% वृद्धि' }, { value: 'decrease', label: '% कमी' }, { value: 'difference', label: '% अंतर (A→B)' }] },
      { key: 'a', label: 'मान A', type: 'number', default: 1000, step: 0.01 },
      { key: 'b', label: 'मान B / प्रतिशत', sub: 'वृद्धि/कमी में % डालें; अंतर में दूसरा मान', type: 'number', default: 10, step: 0.01 },
    ],
    compute: (v) => {
      const mode = String(v.mode), a = N(v.a), b = N(v.b);
      if (!isFinite(a) || !isFinite(b)) return bad;
      const r = percentage(mode as 'increase' | 'decrease' | 'difference', a, b);
      if (mode === 'difference') {
        return { ok: true, stats: [
          { label: 'प्रतिशत अंतर (A→B)', value: pct(r.result), primary: true },
          { label: 'मान में बदलाव', value: num(r.change) },
        ] };
      }
      return { ok: true, stats: [
        { label: mode === 'increase' ? 'वृद्धि के बाद मान' : 'कमी के बाद मान', value: num(r.result), primary: true },
        { label: mode === 'increase' ? 'जुड़ी राशि' : 'घटी राशि', value: num(r.change) },
      ] };
    },
    formula: '% वृद्धि: `नया = A + (A × B ÷ 100)`\n\n% कमी: `नया = A − (A × B ÷ 100)`\n\n% अंतर: `((B − A) ÷ |A|) × 100`',
    explanation: 'प्रतिशत रोज़ के हिसाब में काम आता है — वसूली%, खर्च में वृद्धि/कमी, या दो वर्षों के आँकड़ों की तुलना। यहाँ तीन सामान्य प्रकार हैं।',
    example: '1,000 में 10% वृद्धि → 1,100 (जुड़ी राशि 100)। 800 से 1,000 का % अंतर → +25%।',
    mistakes: '- ❌ "% वृद्धि" और "% अंतर" को एक मानना।\n- ❌ आधार (A) और तुलना मान (B) उलट देना।',
    relatedGlossary: [],
    relatedKIs: ['KI-000212'],
    relatedArticles: [{ slug: 'how-to-read-financial-reports', title: 'वित्तीय रिपोर्ट्स कैसे पढ़ें' }],
    relatedModules: [{ route: '/reports', label: 'रिपोर्ट' }],
  },

  /* 10 ── Working Capital ── */
  {
    slug: 'working-capital-calculator',
    metaTitle: 'वर्किंग कैपिटल (Working Capital) कैलकुलेटर | SahakarLekha',
    metaDescription: 'करंट एसेट और करंट लायबिलिटी डालें — वर्किंग कैपिटल और करंट रेशियो (current ratio) तुरंत पाएं। शैक्षिक।',
    category: 'रिपोर्ट', title: 'वर्किंग कैपिटल कैलकुलेटर',
    hindiName: 'वर्किंग कैपिटल कैलकुलेटर', englishName: 'Working Capital Calculator',
    intro: 'करंट एसेट − करंट लायबिलिटी = वर्किंग कैपिटल; और करंट रेशियो।',
    keywords: ['वर्किंग कैपिटल', 'working capital', 'current ratio', 'करंट रेशियो'],
    inputs: [
      { key: 'ca', label: 'करंट एसेट', type: 'number', default: 500000, min: 0, prefix: '₹' },
      { key: 'cl', label: 'करंट लायबिलिटी', type: 'number', default: 300000, min: 0, prefix: '₹' },
    ],
    compute: (v) => {
      const ca = N(v.ca), cl = N(v.cl);
      if (!(ca >= 0) || !(cl >= 0)) return bad;
      const r = workingCapital(ca, cl);
      return { ok: true, stats: [
        { label: 'वर्किंग कैपिटल', value: inr(r.workingCapital, 0), primary: true, tone: r.workingCapital >= 0 ? 'good' : 'bad' },
        { label: 'करंट रेशियो (Current Ratio)', value: r.currentRatio != null ? num(r.currentRatio) + ' : 1' : '—' },
      ], note: r.workingCapital < 0 ? 'ऋणात्मक वर्किंग कैपिटल — करंट लायबिलिटी एसेट से ज़्यादा; नकदी पर ध्यान दें।' : 'धनात्मक वर्किंग कैपिटल — अल्पकालीन स्थिति ठीक।' };
    },
    formula: '`वर्किंग कैपिटल = करंट एसेट − करंट लायबिलिटी`\n\n`करंट रेशियो = करंट एसेट ÷ करंट लायबिलिटी`',
    explanation: 'वर्किंग कैपिटल बताती है कि समिति के पास अल्पकालीन ज़रूरतें पूरी करने के लिए कितनी "खाली" कैपिटल है। **करंट रेशियो** (आदर्शतः 1 से ऊपर) दिखाता है कि करंट लायबिलिटी के मुकाबले करंट एसेट कितनी है।',
    example: 'करंट एसेट ₹5,00,000, करंट लायबिलिटी ₹3,00,000 — वर्किंग कैपिटल ₹2,00,000; करंट रेशियो 1.67 : 1।',
    mistakes: '- ❌ दीर्घकालीन एसेट/लायबिलिटी को चालू में गिनना।\n- ❌ ऋणात्मक वर्किंग कैपिटल को अनदेखा करना।',
    relatedGlossary: ['asset', 'liability', 'capital'],
    relatedKIs: ['KI-000034', 'KI-000035', 'KI-000212'],
    relatedArticles: [{ slug: 'how-to-read-financial-reports', title: 'वित्तीय रिपोर्ट्स कैसे पढ़ें' }, { slug: 'half-year-financial-review', title: 'साल के बीच की समीक्षा' }],
    relatedModules: [{ route: '/reports', label: 'रिपोर्ट' }, { route: '/balance-sheet', label: 'बैलेंस शीट' }],
  },
];

/* ── Topic-cluster data: FAQs (FAQPage schema) + related calculators ──
   Kept as maps and attached below so the compute configs above stay compact. */
const FAQS: Record<string, CalcFaq[]> = {
  'depreciation-calculator': [
    { q: 'SLM और WDV में क्या फर्क है?', a: 'SLM में हर साल मूल लागत पर बराबर डेप्रिसिएशन होता है; WDV में हर साल घटते बही मूल्य पर — इसलिए शुरुआती साल ज़्यादा घटता है।' },
    { q: 'क्या कोई तय डेप्रिसिएशन दर है?', a: 'यह कैलकुलेटर कोई कानूनी दर तय नहीं करता — सही दर आप अपने नियमों/CA के अनुसार स्वयं डालते हैं।' },
    { q: 'सैल्वेज वैल्यू क्या होता है?', a: 'संपत्ति की अनुमानित अंतिम कीमत; SLM में बही मूल्य इससे नीचे नहीं जाता।' },
  ],
  'simple-interest-calculator': [
    { q: 'साधारण और कंपाउंड इंटरेस्ट में फर्क?', a: 'सिंपल इंटरेस्ट सिर्फ़ मूलधन पर लगता है; कंपाउंड में हर अवधि का ब्याज मूलधन में जुड़कर अगली बार ब्याज पर भी ब्याज देता है।' },
    { q: 'समय महीनों में हो तो कैसे डालें?', a: 'समय वर्षों में डालें — 6 महीने = 0.5 वर्ष।' },
    { q: 'सिंपल इंटरेस्ट का सूत्र क्या है?', a: 'ब्याज = (मूलधन × दर × समय) ÷ 100; कुल राशि = मूलधन + ब्याज।' },
  ],
  'compound-interest-calculator': [
    { q: 'कंपाउंड की संख्या (n) क्या है?', a: 'एक साल में कितनी बार ब्याज जुड़ता है — वार्षिक=1, छमाही=2, तिमाही=4, मासिक=12।' },
    { q: 'बार-बार कंपाउंड से क्या होता है?', a: 'जितनी ज़्यादा बार कंपाउंड, अंतिम राशि उतनी थोड़ी ज़्यादा होती है।' },
    { q: 'क्या यह जमा/FD के लिए सही है?', a: 'यह शैक्षिक गणना है; वास्तविक दर व शर्तें अपने बैंक/नियमों से देखें।' },
  ],
  'share-capital-calculator': [
    { q: 'अधिकृत, निर्गमित व चुकता का क्रम?', a: 'अधिकृत ≥ निर्गमित ≥ चुकता। बैलेंस शीट पर असली आँकड़ा पेड-अप कैपिटल है।' },
    { q: 'सदस्य की शेयर कैपिटल कैसे निकलती है?', a: 'फेस वैल्यू × धारित शेयरों की संख्या।' },
    { q: 'क्या यह कानूनी गणना है?', a: 'नहीं, यह शैक्षिक है — विशिष्ट प्रावधानों के लिए अपने नियम/उपविधि देखें।' },
  ],
  'gst-calculator': [
    { q: 'Exclusive और Inclusive में फर्क?', a: 'Exclusive में राशि कर रहित होती है (कर जोड़ना है); Inclusive में राशि में कर पहले से शामिल होता है (अलग करना है)।' },
    { q: 'CGST और SGST कैसे बँटते हैं?', a: 'राज्य के भीतर लेन-देन में GST आम तौर पर आधा CGST व आधा SGST में बँटता है।' },
    { q: 'सही GST दर कौन-सी है?', a: 'यह कैलकुलेटर कोई दर नहीं सुझाता; सही दर आइटम/नियमों के अनुसार आप डालें और अपने CA से पुष्टि करें।' },
  ],
  'tds-calculator': [
    { q: 'TDS किस पर कटता है?', a: 'यह भुगतान के प्रकार पर निर्भर है और लागू होना नियमों पर — यह कैलकुलेटर कोई दर नहीं सुझाता।' },
    { q: 'TDS का सूत्र क्या है?', a: 'TDS = भुगतान राशि × दर% ÷ 100; शुद्ध भुगतान = राशि − TDS।' },
    { q: 'सही दर कहाँ से लें?', a: 'सही दर व अनुभाग अपने CA या आधिकारिक नियमों से पक्का करें।' },
  ],
  'loan-emi-calculator': [
    { q: 'EMI में क्या-क्या शामिल होता है?', a: 'हर महीने की समान किस्त में मूलधन और ब्याज दोनों होते हैं — शुरुआती किस्तों में ब्याज का हिस्सा ज़्यादा।' },
    { q: 'वार्षिक दर को मासिक कैसे करें?', a: 'वार्षिक दर ÷ 12 ÷ 100 = मासिक दर।' },
    { q: 'amortization तालिका क्या दिखाती है?', a: 'हर साल कितना मूलधन चुका, कितना ब्याज गया और शेष कितना बचा।' },
  ],
  'cash-difference-calculator': [
    { q: 'short और excess में फर्क?', a: 'भौतिक कैश बुक से कम हो = कमी (short); ज़्यादा हो = अधिकता (excess)।' },
    { q: 'अंतर मिले तो क्या करें?', a: 'तुरंत जाँचें — यह छूटी/गलत एंट्री या रिसाव का संकेत है, इसे टालें नहीं।' },
    { q: 'क्या कैश शेष ऋणात्मक हो सकता है?', a: 'नहीं; ऋणात्मक कैश हमेशा किसी गलती का संकेत है।' },
  ],
  'percentage-calculator': [
    { q: '% वृद्धि और % अंतर में फर्क?', a: '% वृद्धि किसी मान को बढ़ाती है; % अंतर दो मानों के बीच का बदलाव दिखाता है।' },
    { q: 'किसी हिस्से का प्रतिशत कैसे निकालें?', a: '(हिस्सा ÷ कुल) × 100।' },
    { q: 'प्रतिशत के सूत्र क्या हैं?', a: 'वृद्धि: A+(A×B÷100); कमी: A−(A×B÷100); अंतर: ((B−A)÷|A|)×100।' },
  ],
  'working-capital-calculator': [
    { q: 'वर्किंग कैपिटल क्या बताती है?', a: 'अल्पकालीन ज़रूरतें पूरी करने के लिए कितनी "खाली" कैपिटल है — करंट एसेट − करंट लायबिलिटी।' },
    { q: 'करंट रेशियो कितना अच्छा माना जाता है?', a: 'आम तौर पर 1 से ऊपर बेहतर माना जाता है (शैक्षिक मार्गदर्शन)।' },
    { q: 'ऋणात्मक वर्किंग कैपिटल का मतलब?', a: 'करंट लायबिलिटी एसेट से ज़्यादा है — नकदी पर ध्यान देने का संकेत।' },
  ],
};
const RELATED: Record<string, string[]> = {
  'depreciation-calculator': ['working-capital-calculator', 'share-capital-calculator'],
  'simple-interest-calculator': ['compound-interest-calculator', 'loan-emi-calculator'],
  'compound-interest-calculator': ['simple-interest-calculator', 'loan-emi-calculator'],
  'share-capital-calculator': ['working-capital-calculator', 'depreciation-calculator'],
  'gst-calculator': ['tds-calculator', 'percentage-calculator'],
  'tds-calculator': ['gst-calculator', 'percentage-calculator'],
  'loan-emi-calculator': ['simple-interest-calculator', 'compound-interest-calculator'],
  'cash-difference-calculator': ['percentage-calculator', 'working-capital-calculator'],
  'percentage-calculator': ['working-capital-calculator', 'gst-calculator'],
  'working-capital-calculator': ['percentage-calculator', 'depreciation-calculator'],
};
CALCULATORS.forEach((c) => { c.faqs = FAQS[c.slug] ?? []; c.related = RELATED[c.slug] ?? []; });

export function findCalculator(slug: string): CalcConfig | null {
  return CALCULATORS.find((c) => c.slug === slug) ?? null;
}

/** Related calculators for the cluster (resolved configs). */
export function relatedCalculators(slug: string): CalcConfig[] {
  const c = findCalculator(slug);
  if (!c || !c.related) return [];
  return c.related.map((s) => findCalculator(s)).filter((x): x is CalcConfig => x != null);
}

/** Reverse map: calculators that reference a given glossary term (for glossary → calculator links). */
export function calculatorsForGlossary(termSlug: string): CalcConfig[] {
  return CALCULATORS.filter((c) => c.relatedGlossary.includes(termSlug));
}

/** Reverse map: the calculator paired with a blog article (for article → calculator callouts). */
export function calculatorForArticle(articleSlug: string): CalcConfig | null {
  return CALCULATORS.find((c) => c.relatedArticles.some((a) => a.slug === articleSlug)) ?? null;
}
