/* B-04 deck master generator — writes deck/SL_B-04_deck-master_hien_v1.0.pptx
 * 8 branded layout slides with sample content + speaker-note instructions.
 * Regenerate: `npm run gen:deck` from brand-assets/templates/.
 * FONTS: install Hind + Inter from brand-assets/fonts on the presenting
 * machine once (double-click each TTF → Install) — otherwise Windows falls
 * back to Nirmala UI for Devanagari (readable, but off-brand). */
import pptxgen from 'pptxgenjs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOGO = p => path.join(DIR, '..', '..', 'logo', 'png', p);
const OUTFILE = path.join(DIR, '..', 'deck', 'SL_B-04_deck-master_hien_v1.0.pptx');

const NAVY = '153F79', ORANGE = 'F48525', NAVY_DARK = '122D54', GREEN = '1F9350',
  TEAL = '2999A3', WHITE = 'FFFFFF', LIGHT = 'D1D8E0', FG = '1D2330',
  MUTED = '676F7E', BG_MUTED = 'F3F5F7', BORDER = 'D1D8E0';
const HI = 'Hind', EN = 'Inter';

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.author = 'Sahakar Lekha';
pres.title = 'सहकार लेखा — Deck Master (B-04)';

const W = 10, H = 5.625;
const makeShadow = () => ({ type: 'outer', color: '122D54', blur: 8, offset: 2, angle: 45, opacity: 0.14 });

function blob(slide, x, y, w) {
  slide.addShape(pres.shapes.OVAL, { x, y, w, h: w, fill: { color: NAVY_DARK } });
}
function tricolor(slide) { // brand signature strip — title/closing slides only
  const t = 0.03;
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: H - 3 * t, w: W, h: t, fill: { color: ORANGE } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: H - 2 * t, w: W, h: t, fill: { color: WHITE } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: H - t, w: W, h: t, fill: { color: GREEN } });
}
function contentHeader(slide, title) {
  slide.addText(title, { x: 0.55, y: 0.32, w: 8.2, h: 0.65, fontFace: HI, fontSize: 22, bold: true, color: NAVY, margin: 0, valign: 'middle' });
  slide.addImage({ path: LOGO('SL_B-02_tile_512.png'), x: 9.12, y: 0.36, w: 0.42, h: 0.42 });
}
function footer(slide) {
  slide.addText('sahakarlekha.com', { x: 0.55, y: H - 0.42, w: 3, h: 0.3, fontFace: EN, fontSize: 9, color: MUTED, margin: 0 });
}

/* ---------- 1. TITLE ---------- */
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  blob(s, 7.6, -1.6, 4.2); blob(s, -1.1, 4.3, 2.6);
  s.addImage({ path: LOGO('SL_B-02_logo-horizontal-clean-reversed_2000.png'), x: 0.6, y: 0.55, w: 2.72, h: 0.55 });
  s.addText('प्रस्तुति का शीर्षक यहाँ लिखें', { x: 0.6, y: 1.85, w: 8.8, h: 0.95, fontFace: HI, fontSize: 32, bold: true, color: WHITE, margin: 0 });
  s.addText('उप-शीर्षक — किसके लिए, कब, एक पंक्ति में', { x: 0.6, y: 2.85, w: 8.4, h: 0.5, fontFace: HI, fontSize: 16, color: LIGHT, margin: 0 });
  s.addText('सहकारी समितियों का अपना सॉफ्टवेयर', { x: 0.6, y: 3.5, w: 8.4, h: 0.45, fontFace: HI, fontSize: 15, bold: true, color: ORANGE, margin: 0 });
  s.addText([
    { text: 'प्रस्तुतकर्ता का नाम   ·   ', options: { fontFace: HI } },
    { text: 'sahakarlekha.com', options: { fontFace: EN } },
  ], { x: 0.6, y: 4.55, w: 8.4, h: 0.4, fontSize: 12, color: LIGHT, margin: 0 });
  tricolor(s);
  s.addNotes('TITLE LAYOUT: शीर्षक + उप-शीर्षक + अपना नाम बदलें। बाकी कुछ मत छेड़ें। Tagline और तिरंगा पट्टी हर title slide पर रहती है।');
}

/* ---------- 2. SECTION DIVIDER ---------- */
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DARK };
  blob(s, 7.9, 3.4, 3.4);
  s.addImage({ path: LOGO('SL_B-02_tile_512.png'), x: 9.12, y: 0.4, w: 0.45, h: 0.45 });
  s.addText('01', { x: 0.6, y: 1.1, w: 3, h: 1.6, fontFace: EN, fontSize: 88, bold: true, color: ORANGE, margin: 0 });
  s.addText('अनुभाग का शीर्षक', { x: 0.6, y: 2.9, w: 8.4, h: 0.8, fontFace: HI, fontSize: 30, bold: true, color: WHITE, margin: 0 });
  s.addText('एक पंक्ति में — इस अनुभाग में क्या मिलेगा', { x: 0.6, y: 3.75, w: 8, h: 0.5, fontFace: HI, fontSize: 15, color: LIGHT, margin: 0 });
  s.addNotes('SECTION DIVIDER: नंबर (01/02/03...) और शीर्षक बदलें। हर बड़े हिस्से से पहले एक divider।');
}

/* ---------- 3. CONTENT / BULLETS ---------- */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  contentHeader(s, 'सामान्य content slide — शीर्षक यहाँ');
  s.addText([
    { text: 'पहला मुख्य बिंदु — छोटा और साफ़', options: { bullet: { code: '2022', indent: 14 }, breakLine: true } },
    { text: 'दूसरा बिंदु — ज़रूरी शब्द bold करें', options: { bullet: { code: '2022', indent: 14 }, breakLine: true } },
    { text: 'तीसरा बिंदु — आँकड़े Inter में: ₹1,12,500', options: { bullet: { code: '2022', indent: 14 }, breakLine: true } },
    { text: 'उप-बिंदु का उदाहरण', options: { bullet: { code: '2022', indent: 14 }, indentLevel: 1, breakLine: true } },
    { text: 'चौथा बिंदु — एक slide पर 5-6 से ज़्यादा नहीं', options: { bullet: { code: '2022', indent: 14 } } },
  ], { x: 0.6, y: 1.3, w: 8.6, h: 3.4, fontFace: HI, fontSize: 16, color: FG, paraSpaceAfter: 10, margin: 0, valign: 'top' });
  footer(s);
  s.addNotes('CONTENT LAYOUT: bullets बदलें। 5-6 bullets से ज़्यादा हों तो slide तोड़ें। रक़म/नंबर Inter font में।');
}

/* ---------- 4. TWO-COLUMN (text + screenshot) ---------- */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  contentHeader(s, 'Feature दिखाएँ — text बाएँ, screenshot दाएँ');
  s.addText([
    { text: 'Feature का फ़ायदा एक पंक्ति में', options: { bullet: { code: '2022', indent: 14 }, breakLine: true } },
    { text: 'दूसरा फ़ायदा', options: { bullet: { code: '2022', indent: 14 }, breakLine: true } },
    { text: 'तीसरा फ़ायदा', options: { bullet: { code: '2022', indent: 14 } } },
  ], { x: 0.6, y: 1.4, w: 4.1, h: 3.2, fontFace: HI, fontSize: 15, color: FG, paraSpaceAfter: 10, margin: 0, valign: 'top' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.05, y: 1.3, w: 4.35, h: 3.35, rectRadius: 0.08, fill: { color: BG_MUTED }, line: { color: BORDER, width: 1, dashType: 'dash' } });
  s.addText('यहाँ असली screenshot लगाएँ\n(demo data · नाम masked)', { x: 5.05, y: 2.55, w: 4.35, h: 0.9, fontFace: HI, fontSize: 13, color: MUTED, align: 'center', margin: 0 });
  footer(s);
  s.addNotes('TWO-COLUMN: dashed box हटाकर असली screenshot Insert करें (Insert → Pictures)। हमेशा demo-society data, असली नाम कभी नहीं।');
}

/* ---------- 5. STAT CALLOUTS ---------- */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  contentHeader(s, 'बड़े आँकड़े — 3 stat cards');
  const stats = [
    ['8', 'प्रकार की समितियाँ', NAVY],
    ['36', 'राज्य / UT', TEAL],
    ['₹0', 'लागत — बिल्कुल मुफ़्त', ORANGE],
  ];
  stats.forEach(([num, label, color], i) => {
    const x = 0.6 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 2.75, h: 2.5, rectRadius: 0.09, fill: { color: BG_MUTED }, shadow: makeShadow() });
    s.addText(num, { x, y: 1.95, w: 2.75, h: 1.1, fontFace: EN, fontSize: 44, bold: true, color, align: 'center', margin: 0 });
    s.addText(label, { x: x + 0.2, y: 3.15, w: 2.35, h: 0.7, fontFace: HI, fontSize: 14, color: FG, align: 'center', margin: 0 });
  });
  footer(s);
  s.addNotes('STATS LAYOUT: 3 बड़े नंबर — नंबर Inter Bold में, label Hind में। सिर्फ़ सच्चे आँकड़े (Brand Book truth rule)।');
}

/* ---------- 6. TABLE ---------- */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  contentHeader(s, 'Table का layout');
  const head = (t, opts = {}) => ({ text: t, options: { fill: { color: NAVY }, color: WHITE, bold: true, fontFace: HI, ...opts } });
  const num = t => ({ text: t, options: { align: 'right', fontFace: EN } });
  s.addTable([
    [head('विवरण'), head('अवधि'), head('राशि', { align: 'right' })],
    ['सदस्यता शुल्क', '2025-26', num('₹52,000')],
    [{ text: 'खाद बिक्री', options: { fill: { color: BG_MUTED } } }, { text: '2025-26', options: { fill: { color: BG_MUTED } } }, { ...num('₹8,45,600'), options: { ...num('').options, fill: { color: BG_MUTED } } }],
    ['ऋण वसूली', '2025-26', num('₹3,12,500')],
  ], {
    x: 0.6, y: 1.45, w: 8.8, colW: [4.4, 2.2, 2.2],
    fontFace: HI, fontSize: 13, color: FG,
    border: { type: 'solid', pt: 0.5, color: BORDER },
    rowH: 0.42, valign: 'middle',
  });
  footer(s);
  s.addNotes('TABLE LAYOUT: header हमेशा navy + white। रक़म right-aligned, Inter font, Indian grouping (₹1,12,500)। बारी-बारी rows पर हल्का gray।');
}

/* ---------- 7. CHART ---------- */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  contentHeader(s, 'Chart का layout — takeaway शीर्षक में लिखें');
  s.addChart(pres.charts.BAR, [{
    name: 'वसूली (₹ हज़ार में)',
    labels: ['अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त'],
    values: [220, 305, 288, 410, 465],
  }], {
    x: 0.6, y: 1.35, w: 8.8, h: 3.5, barDir: 'col',
    chartColors: [NAVY],
    chartArea: { fill: { color: 'FFFFFF' } },
    catAxisLabelColor: MUTED, valAxisLabelColor: MUTED,
    catAxisLabelFontFace: HI, valAxisLabelFontFace: EN,
    valGridLine: { color: 'E2E8F0', size: 0.5 }, catGridLine: { style: 'none' },
    showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: FG, dataLabelFontFace: EN,
    showLegend: false, showTitle: false,
  });
  footer(s);
  s.addNotes('CHART LAYOUT: series 1 navy, series 2 teal, highlight orange। Chart editable है (right-click → Edit Data)। शीर्षक में निष्कर्ष लिखें ("वसूली 2 गुना"), सिर्फ़ "chart" नहीं।');
}

/* ---------- 8. CLOSING ---------- */
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  blob(s, 7.4, -1.7, 4.4); blob(s, -1.2, 4.2, 2.8);
  s.addImage({ path: LOGO('SL_B-02_logo-horizontal-clean-reversed_2000.png'), x: 0.6, y: 0.6, w: 2.72, h: 0.55 });
  s.addText('आज ही अपनी समिति का हिसाब शुरू करें', { x: 0.6, y: 1.95, w: 8.8, h: 0.8, fontFace: HI, fontSize: 28, bold: true, color: WHITE, margin: 0 });
  s.addText('बिल्कुल मुफ़्त — 5 मिनट में पहली entry', { x: 0.6, y: 2.8, w: 8, h: 0.5, fontFace: HI, fontSize: 16, color: LIGHT, margin: 0 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 3.55, w: 3.1, h: 0.62, rectRadius: 0.31, fill: { color: ORANGE } });
  s.addText('sahakarlekha.com', { x: 0.6, y: 3.55, w: 3.1, h: 0.62, fontFace: EN, fontSize: 16, bold: true, color: WHITE, align: 'center', valign: 'middle', margin: 0 });
  s.addText([
    { text: 'WhatsApp: +91 94679 18545      ', options: { fontFace: EN } },
    { text: '@sahakarlekha', options: { fontFace: EN } },
  ], { x: 0.6, y: 4.45, w: 8, h: 0.4, fontSize: 13, color: LIGHT, margin: 0 });
  tricolor(s);
  s.addNotes('CLOSING: हर deck इसी slide पर खत्म — एक CTA, contact, तिरंगा पट्टी। QR जोड़ना हो तो दाईं ओर blob के ऊपर white panel में।');
}

await pres.writeFile({ fileName: OUTFILE });
console.log('wrote', OUTFILE);
