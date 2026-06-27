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
  nev?: boolean;          // statutory-adjacent (rates user-entered) → show note
}

const N = (v: number | string) => (typeof v === 'number' ? v : Number(v));
const bad: CalcResult = { ok: false, stats: [], note: 'कृपया सभी मान सही (धनात्मक) भरें।' };

export const CALCULATORS: CalcConfig[] = [
  /* 1 ── Depreciation (SLM / WDV) ── */
  {
    slug: 'depreciation-calculator',
    metaTitle: 'मूल्यह्रास (Depreciation) कैलकुलेटर — SLM व WDV | SahakarLekha',
    metaDescription: 'सीधी रेखा (SLM) और घटते मूल्य (WDV) से मूल्यह्रास निकालें — दर आप डालें, शेड्यूल तुरंत पाएं। सहकारी समिति के लिए मुफ्त कैलकुलेटर।',
    category: 'संपत्ति', title: 'मूल्यह्रास कैलकुलेटर (SLM / WDV)',
    hindiName: 'मूल्यह्रास कैलकुलेटर', englishName: 'Depreciation Calculator',
    intro: 'संपत्ति की घटती कीमत हर साल कैसे दर्ज करें — SLM या WDV से, आपकी दर पर।',
    keywords: ['मूल्यह्रास', 'depreciation', 'SLM', 'WDV', 'घिसाई', 'ghisai'],
    inputs: [
      { key: 'method', label: 'विधि', type: 'select', default: 'slm', options: [{ value: 'slm', label: 'सीधी रेखा (SLM)' }, { value: 'wdv', label: 'घटते मूल्य (WDV)' }] },
      { key: 'cost', label: 'संपत्ति की लागत', type: 'number', default: 100000, min: 0, prefix: '₹' },
      { key: 'rate', label: 'मूल्यह्रास दर', sub: 'आप डालें (कोई वैधानिक दर नहीं)', type: 'number', default: 10, min: 0, step: 0.01, suffix: '%' },
      { key: 'years', label: 'कितने वर्ष', type: 'number', default: 5, min: 1, suffix: 'वर्ष' },
      { key: 'salvage', label: 'अवशिष्ट मूल्य (SLM)', sub: 'वैकल्पिक', type: 'number', default: 0, min: 0, prefix: '₹' },
    ],
    compute: (v) => {
      const cost = N(v.cost), rate = N(v.rate), years = N(v.years), salvage = N(v.salvage) || 0, method = String(v.method);
      if (!(cost > 0) || !(rate >= 0) || !(years > 0)) return bad;
      const r = depreciation(method as 'slm' | 'wdv', cost, rate, years, salvage);
      return {
        ok: true,
        stats: [
          { label: 'कुल मूल्यह्रास', value: inr(r.totalDep), primary: true },
          { label: 'अंतिम बही मूल्य', value: inr(r.closingValue ?? 0) },
        ],
        table: { head: ['वर्ष', 'प्रारंभिक', 'मूल्यह्रास', 'अंतिम'], rows: r.schedule.map((s) => [String(s.year), inr(s.opening, 0), inr(s.depreciation, 0), inr(s.closing, 0)]) },
        note: method === 'wdv' ? 'WDV — हर साल घटते बही मूल्य पर दर लगती है।' : 'SLM — हर साल मूल लागत पर बराबर मूल्यह्रास।',
      };
    },
    formula: 'SLM (सीधी रेखा): `वार्षिक मूल्यह्रास = लागत × दर%`\n\nWDV (घटते मूल्य): `वार्षिक मूल्यह्रास = प्रारंभिक बही मूल्य × दर%`',
    explanation: 'मूल्यह्रास संपत्ति की घटती कीमत को हर साल खर्च के रूप में दर्ज करता है। **SLM** में हर साल बराबर राशि घटती है; **WDV** में शुरुआती साल ज़्यादा, बाद में कम। दर आप दर्ज करते हैं — कोई वैधानिक दर यहाँ तय नहीं की गई।',
    example: 'लागत ₹1,00,000, दर 10%, 5 वर्ष — SLM में हर साल ₹10,000; WDV में पहले साल ₹10,000, दूसरे साल ₹9,000 (₹90,000 का 10%), और इसी तरह घटते हुए।',
    mistakes: '- ❌ SLM और WDV को मिला देना — दोनों का तरीका अलग है।\n- ❌ वैधानिक दर मान लेना — सही दर अपने CA/नियमों से लें, यहाँ आप ही डालें।\n- ❌ अवशिष्ट मूल्य भूलना (SLM में बही मूल्य उससे नीचे नहीं जाता)।',
    relatedGlossary: ['asset', 'accounting-period', 'expense'],
    relatedKIs: ['KI-000112', 'KI-000111', 'KI-000034'],
    relatedArticles: [{ slug: 'depreciation-explained', title: 'डेप्रिसिएशन कैसे करें' }],
    relatedModules: [{ route: '/depreciation-schedule', label: 'डेप्रिसिएशन शेड्यूल' }, { route: '/asset-register', label: 'एसेट रजिस्टर' }],
    nev: true,
  },

  /* 2 ── Simple Interest ── */
  {
    slug: 'simple-interest-calculator',
    metaTitle: 'साधारण ब्याज (Simple Interest) कैलकुलेटर | SahakarLekha',
    metaDescription: 'मूलधन, दर और समय डालें — साधारण ब्याज और कुल राशि तुरंत पाएं, सूत्र व उदाहरण सहित। सहकारी समिति के लिए मुफ्त कैलकुलेटर।',
    category: 'ब्याज', title: 'साधारण ब्याज कैलकुलेटर',
    hindiName: 'साधारण ब्याज कैलकुलेटर', englishName: 'Simple Interest Calculator',
    intro: 'मूलधन × दर × समय — साधारण ब्याज और कुल राशि एक क्लिक पर।',
    keywords: ['साधारण ब्याज', 'simple interest', 'byaj', 'ब्याज'],
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
    formula: '`साधारण ब्याज (SI) = (मूलधन × दर × समय) ÷ 100`\n\n`कुल राशि = मूलधन + ब्याज`',
    explanation: 'साधारण ब्याज हर साल केवल **मूलधन** पर लगता है — ब्याज पर ब्याज नहीं। यह छोटे-अवधि के कर्ज़ या जमा के अनुमान के लिए उपयोगी है।',
    example: 'मूलधन ₹50,000, दर 8%, समय 2 वर्ष — ब्याज = (50000 × 8 × 2) ÷ 100 = ₹8,000; कुल राशि = ₹58,000।',
    mistakes: '- ❌ समय को महीनों में डालना (इसे वर्षों में डालें — 6 महीने = 0.5)।\n- ❌ साधारण और चक्रवृद्धि ब्याज को एक मानना।',
    relatedGlossary: [],
    relatedKIs: ['KI-000070', 'KI-000069'],
    relatedArticles: [{ slug: 'loan-and-interest-accounting', title: 'ऋण व ब्याज लेखांकन' }],
    relatedModules: [{ route: '/loan-register', label: 'ऋण रजिस्टर' }, { route: '/loan-interest', label: 'ऋण ब्याज' }],
  },

  /* 3 ── Compound Interest ── */
  {
    slug: 'compound-interest-calculator',
    metaTitle: 'चक्रवृद्धि ब्याज (Compound Interest) कैलकुलेटर | SahakarLekha',
    metaDescription: 'वार्षिक, छमाही, तिमाही या मासिक चक्रवृद्धि पर ब्याज निकालें — सूत्र, गणना व वर्ष-दर-वर्ष वृद्धि तालिका सहित।',
    category: 'ब्याज', title: 'चक्रवृद्धि ब्याज कैलकुलेटर',
    hindiName: 'चक्रवृद्धि ब्याज कैलकुलेटर', englishName: 'Compound Interest Calculator',
    intro: 'ब्याज पर ब्याज — वार्षिक/छमाही/तिमाही/मासिक चक्रवृद्धि और वृद्धि तालिका।',
    keywords: ['चक्रवृद्धि ब्याज', 'compound interest', 'CI'],
    inputs: [
      { key: 'principal', label: 'मूलधन', type: 'number', default: 50000, min: 0, prefix: '₹' },
      { key: 'rate', label: 'वार्षिक दर', type: 'number', default: 8, min: 0, step: 0.01, suffix: '%' },
      { key: 'years', label: 'समय', type: 'number', default: 3, min: 1, suffix: 'वर्ष' },
      { key: 'freq', label: 'चक्रवृद्धि', type: 'select', default: '1', options: [{ value: '1', label: 'वार्षिक' }, { value: '2', label: 'छमाही' }, { value: '4', label: 'तिमाही' }, { value: '12', label: 'मासिक' }] },
    ],
    compute: (v) => {
      const p = N(v.principal), r = N(v.rate), t = N(v.years), f = N(v.freq);
      if (!(p > 0) || !(r >= 0) || !(t > 0)) return bad;
      const res = compoundInterest(p, r, t, f as 1 | 2 | 4 | 12);
      return { ok: true, stats: [
        { label: 'चक्रवृद्धि ब्याज', value: inr(res.interest), primary: true },
        { label: 'कुल राशि', value: inr(res.total) },
      ], table: { head: ['वर्ष', 'राशि', 'कुल ब्याज'], rows: res.schedule.map((s) => [String(s.year), inr(s.amount, 0), inr(s.interest, 0)]) } };
    },
    formula: '`कुल राशि A = मूलधन × (1 + (दर÷n)/100)^(n × वर्ष)`\n\nजहाँ `n` = एक साल में चक्रवृद्धि की संख्या (वार्षिक=1, छमाही=2, तिमाही=4, मासिक=12)। `ब्याज = A − मूलधन`।',
    explanation: 'चक्रवृद्धि ब्याज में हर अवधि का ब्याज मूलधन में जुड़ जाता है, इसलिए अगली अवधि में **ब्याज पर भी ब्याज** लगता है। चक्रवृद्धि जितनी बार-बार, राशि उतनी ज़्यादा।',
    example: 'मूलधन ₹50,000, दर 8%, 3 वर्ष, वार्षिक — A = 50000 × (1.08)³ ≈ ₹62,986; ब्याज ≈ ₹12,986।',
    mistakes: '- ❌ साधारण ब्याज का सूत्र लगाना।\n- ❌ चक्रवृद्धि की संख्या (n) गलत चुनना।',
    relatedGlossary: [],
    relatedKIs: ['KI-000070', 'KI-000080'],
    relatedArticles: [{ slug: 'loan-and-interest-accounting', title: 'ऋण व ब्याज लेखांकन' }],
    relatedModules: [{ route: '/loan-register', label: 'ऋण रजिस्टर' }],
  },

  /* 4 ── Share Capital (educational) ── */
  {
    slug: 'share-capital-calculator',
    metaTitle: 'अंश पूँजी (Share Capital) कैलकुलेटर | SahakarLekha',
    metaDescription: 'अंकित मूल्य, अंशों की संख्या और चुकता % डालें — निर्गमित, अभिदत्त व चुकता पूँजी देखें। केवल शैक्षिक गणना।',
    category: 'सदस्य व शेयर', title: 'अंश पूँजी कैलकुलेटर',
    hindiName: 'अंश पूँजी कैलकुलेटर', englishName: 'Share Capital Calculator',
    intro: 'अंकित मूल्य × अंश = निर्गमित पूँजी; चुकता % से चुकता पूँजी — शैक्षिक।',
    keywords: ['अंश पूँजी', 'share capital', 'paid up', 'चुकता पूँजी'],
    inputs: [
      { key: 'faceValue', label: 'अंकित मूल्य (प्रति अंश)', type: 'number', default: 100, min: 0, prefix: '₹' },
      { key: 'numShares', label: 'अंशों की संख्या (निर्गमित)', type: 'number', default: 6000, min: 0 },
      { key: 'paidPct', label: 'चुकता %', type: 'number', default: 100, min: 0, step: 0.01, suffix: '%' },
      { key: 'authShares', label: 'अधिकृत अंश (वैकल्पिक)', type: 'number', default: 10000, min: 0 },
    ],
    compute: (v) => {
      const fv = N(v.faceValue), ns = N(v.numShares), pp = N(v.paidPct), au = N(v.authShares);
      if (!(fv > 0) || !(ns > 0) || !(pp >= 0)) return bad;
      const r = shareCapital(fv, ns, pp, au);
      return { ok: true, stats: [
        { label: 'अधिकृत पूँजी', value: r.authorised != null ? inr(r.authorised, 0) : '—' },
        { label: 'निर्गमित पूँजी', value: inr(r.issued, 0) },
        { label: 'अभिदत्त पूँजी', value: inr(r.subscribed, 0) },
        { label: 'चुकता पूँजी', value: inr(r.paidUp, 0), primary: true },
      ], note: 'शैक्षिक गणना — अभिदत्त = निर्गमित मानी गई है (आम सहकारी स्थिति)।' };
    },
    formula: '`निर्गमित पूँजी = अंकित मूल्य × अंशों की संख्या`\n\n`चुकता पूँजी = निर्गमित पूँजी × चुकता% ÷ 100`\n\n`अधिकृत पूँजी = अंकित मूल्य × अधिकृत अंश` (यदि भरा हो)',
    explanation: 'अंश पूँजी के तीन रूप होते हैं — **अधिकृत** (अनुमत सीमा), **निर्गमित** (जारी अंश) और **चुकता** (वास्तव में चुकाई गई)। क्रम: अधिकृत ≥ निर्गमित ≥ चुकता। बैलेंस शीट पर असली आँकड़ा **चुकता पूँजी** है।',
    example: 'अंकित मूल्य ₹100, 6,000 अंश, चुकता 90% — निर्गमित = ₹6,00,000; चुकता = ₹5,40,000।',
    mistakes: '- ❌ अधिकृत पूँजी को "उपलब्ध पैसा" मान लेना — असली आँकड़ा चुकता पूँजी है।\n- ❌ निर्गमित को अधिकृत सीमा से ऊपर दिखाना।',
    relatedGlossary: ['share', 'face-value', 'authorised-capital', 'issued-capital', 'paid-up-capital', 'share-certificate'],
    relatedKIs: ['KI-000153', 'KI-000155', 'KI-000156', 'KI-000157', 'KI-000158'],
    relatedArticles: [{ slug: 'share-capital-authorised-issued-paidup', title: 'अंश पूँजी के प्रकार' }, { slug: 'member-and-share-accounting', title: 'सदस्य व शेयर रजिस्टर' }],
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
    metaTitle: 'रोकड़ अंतर (Cash Difference) कैलकुलेटर | SahakarLekha',
    metaDescription: 'रोकड़ बही का शेष और भौतिक नकद डालें — अंतर, कमी (short) या अधिकता (excess) तुरंत जानें। नकद सत्यापन आसान।',
    category: 'रोकड़', title: 'रोकड़ अंतर कैलकुलेटर',
    hindiName: 'रोकड़ अंतर कैलकुलेटर', englishName: 'Cash Difference Calculator',
    intro: 'बही का शेष बनाम असल नकद — कमी या अधिकता तुरंत पकड़ें।',
    keywords: ['रोकड़ अंतर', 'cash difference', 'short', 'excess', 'नकद सत्यापन'],
    inputs: [
      { key: 'book', label: 'रोकड़ बही शेष', type: 'number', default: 12000, min: 0, prefix: '₹' },
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
    formula: '`अंतर = भौतिक नकद − रोकड़ बही शेष`\n\nधनात्मक = अधिकता (Excess); ऋणात्मक = कमी (Short); शून्य = बराबर।',
    explanation: 'रोकड़ सत्यापन में असल नकद गिनकर रोकड़ बही के शेष से मिलाया जाता है। दोनों बराबर होने चाहिए। अंतर का मतलब है कि कहीं एंट्री छूटी, गलत हुई, या रिसाव है — इसे टालें नहीं।',
    example: 'बही शेष ₹12,000, भौतिक नकद ₹11,800 — अंतर ₹200 की **कमी (short)**।',
    mistakes: '- ❌ अंतर को नज़रअंदाज़ करना — हमेशा तुरंत जाँचें।\n- ❌ रोकड़ शेष ऋणात्मक होना (यह असंभव है — गलती का संकेत)।',
    relatedGlossary: ['cash', 'cash-book', 'cash-in-hand', 'cash-account'],
    relatedKIs: ['KI-000099', 'KI-000102', 'KI-000101'],
    relatedArticles: [{ slug: 'cash-handling-and-verification', title: 'रोकड़ संभाल व सत्यापन' }, { slug: 'cash-book-vs-bank-book', title: 'रोकड़ बही vs बैंक बही' }],
    relatedHelp: [{ slug: 'cash-book', title: 'Cash Book कैसे देखें' }],
    relatedModules: [{ route: '/cash-book', label: 'रोकड़ बही' }],
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
    metaTitle: 'कार्यशील पूँजी (Working Capital) कैलकुलेटर | SahakarLekha',
    metaDescription: 'चालू परिसंपत्ति और चालू देयता डालें — कार्यशील पूँजी और चालू अनुपात (current ratio) तुरंत पाएं। शैक्षिक।',
    category: 'रिपोर्ट', title: 'कार्यशील पूँजी कैलकुलेटर',
    hindiName: 'कार्यशील पूँजी कैलकुलेटर', englishName: 'Working Capital Calculator',
    intro: 'चालू परिसंपत्ति − चालू देयता = कार्यशील पूँजी; और चालू अनुपात।',
    keywords: ['कार्यशील पूँजी', 'working capital', 'current ratio', 'चालू अनुपात'],
    inputs: [
      { key: 'ca', label: 'चालू परिसंपत्ति', type: 'number', default: 500000, min: 0, prefix: '₹' },
      { key: 'cl', label: 'चालू देयता', type: 'number', default: 300000, min: 0, prefix: '₹' },
    ],
    compute: (v) => {
      const ca = N(v.ca), cl = N(v.cl);
      if (!(ca >= 0) || !(cl >= 0)) return bad;
      const r = workingCapital(ca, cl);
      return { ok: true, stats: [
        { label: 'कार्यशील पूँजी', value: inr(r.workingCapital, 0), primary: true, tone: r.workingCapital >= 0 ? 'good' : 'bad' },
        { label: 'चालू अनुपात (Current Ratio)', value: r.currentRatio != null ? num(r.currentRatio) + ' : 1' : '—' },
      ], note: r.workingCapital < 0 ? 'ऋणात्मक कार्यशील पूँजी — चालू देयता परिसंपत्ति से ज़्यादा; नकदी पर ध्यान दें।' : 'धनात्मक कार्यशील पूँजी — अल्पकालीन स्थिति ठीक।' };
    },
    formula: '`कार्यशील पूँजी = चालू परिसंपत्ति − चालू देयता`\n\n`चालू अनुपात = चालू परिसंपत्ति ÷ चालू देयता`',
    explanation: 'कार्यशील पूँजी बताती है कि समिति के पास अल्पकालीन ज़रूरतें पूरी करने के लिए कितनी "खाली" पूँजी है। **चालू अनुपात** (आदर्शतः 1 से ऊपर) दिखाता है कि चालू देयता के मुकाबले चालू परिसंपत्ति कितनी है।',
    example: 'चालू परिसंपत्ति ₹5,00,000, चालू देयता ₹3,00,000 — कार्यशील पूँजी ₹2,00,000; चालू अनुपात 1.67 : 1।',
    mistakes: '- ❌ दीर्घकालीन परिसंपत्ति/देयता को चालू में गिनना।\n- ❌ ऋणात्मक कार्यशील पूँजी को अनदेखा करना।',
    relatedGlossary: ['asset', 'liability', 'capital'],
    relatedKIs: ['KI-000034', 'KI-000035', 'KI-000212'],
    relatedArticles: [{ slug: 'how-to-read-financial-reports', title: 'वित्तीय रिपोर्ट्स कैसे पढ़ें' }, { slug: 'half-year-financial-review', title: 'साल के बीच की समीक्षा' }],
    relatedModules: [{ route: '/reports', label: 'रिपोर्ट' }, { route: '/balance-sheet', label: 'बैलेंस शीट' }],
  },
];

export function findCalculator(slug: string): CalcConfig | null {
  return CALCULATORS.find((c) => c.slug === slug) ?? null;
}
