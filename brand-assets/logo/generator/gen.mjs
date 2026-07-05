/* SahakarLekha B-02 logo master generator.
 * HarfBuzz shapes the Devanagari, opentype.js extracts outlines,
 * output = self-contained SVGs (no font dependency). */
import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import { Blob as HbBlob, Face, Font, Buffer as HbBuffer, shape as hbShape } from 'harfbuzzjs';

import { fileURLToPath } from 'url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, '..');
const FONTS = path.join(DIR, '..', '..', 'fonts');

// ---- canonical colors from src/index.css tokens (single source) ----
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
const NAVY = hslToHex(215, 70, 28);      // --primary
const ORANGE = hslToHex(28, 90, 55);     // --accent (saffron)
const NAVY_DARK = hslToHex(215, 65, 20); // --sidebar-background
const WHITE = '#ffffff';

const fontCache = new Map();
function loadFonts(file) {
  if (!fontCache.has(file)) {
    const data = fs.readFileSync(file);
    const blob = new HbBlob(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    const face = new Face(blob);
    const font = new Font(face);
    font.setScale(face.upem, face.upem);
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const ot = opentype.parse(ab);
    // opentype.js lazily parses glyphs; parsing composites out of index order
    // can corrupt component outlines (NaN coords). Force-parse in index order.
    for (let i = 0; i < ot.glyphs.length; i++) ot.glyphs.get(i).path;
    fontCache.set(file, { hbFont: font, upem: face.upem, ot });
  }
  return fontCache.get(file);
}

function shapeToPath(file, text, fontSize, tracking = 0) {
  const { hbFont, upem, ot } = loadFonts(file);
  const buf = new HbBuffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hbShape(hbFont, buf);
  const glyphs = buf.getGlyphInfosAndPositions();
  const scale = fontSize / upem;
  let penX = 0;
  const parts = [];
  let bb = null;
  // own serializer: opentype's toPathData() curve optimizer emits NaN at
  // certain float pen positions; raw commands are always clean.
  const ser = (cmds) => cmds.map(c => {
    const n = v => +v.toFixed(3);
    switch (c.type) {
      case 'M': return `M${n(c.x)} ${n(c.y)}`;
      case 'L': return `L${n(c.x)} ${n(c.y)}`;
      case 'Q': return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      case 'C': return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      case 'Z': return 'Z';
      default: throw new Error('unknown cmd ' + c.type);
    }
  }).join('');
  for (const g of glyphs) {
    const glyph = ot.glyphs.get(g.codepoint);
    const p = glyph.getPath((penX + (g.xOffset || 0)) * scale, -((g.yOffset || 0)) * scale, fontSize);
    const d = ser(p.commands);
    if (d) {
      parts.push(d);
      const b = p.getBoundingBox();
      if (!bb) bb = { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
      else {
        bb.x1 = Math.min(bb.x1, b.x1); bb.y1 = Math.min(bb.y1, b.y1);
        bb.x2 = Math.max(bb.x2, b.x2); bb.y2 = Math.max(bb.y2, b.y2);
      }
    }
    penX += g.xAdvance + tracking * upem;
  }
  const d = parts.join(' ');
  if (d.includes('NaN')) throw new Error(`NaN in path for "${text}" (${file})`);
  return { d, advance: penX * scale, bb };
}

function roundedRect(x, y, w, h, r) {
  return `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

const g = (dx, dy, inner) => `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})">${inner}</g>`;
const p = (d, fill) => `<path d="${d}" fill="${fill}"/>`;

function svgFile(name, viewW, viewH, body, title) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW.toFixed(0)} ${viewH.toFixed(0)}" role="img" aria-label="${title}">\n<!-- SahakarLekha brand master v1.0 - Hind/Inter outlines baked in (no font dependency). navy ${NAVY} orange ${ORANGE}. Regenerate via brand-assets/logo/generator - do not hand-edit paths. -->\n${body}\n</svg>\n`;
  fs.writeFileSync(path.join(OUT, name), svg, 'utf8');
  console.log('wrote', name, `(${Math.round(viewW)}x${Math.round(viewH)})`);
}

fs.mkdirSync(OUT, { recursive: true });

// ---------- glyph pieces ----------
const sa = shapeToPath(path.join(FONTS, 'Hind-Bold.ttf'), 'स', 300);
const word = shapeToPath(path.join(FONTS, 'Hind-Bold.ttf'), 'सहकार लेखा', 96);
const latin = shapeToPath(path.join(FONTS, 'Inter-SemiBold.ttf'), 'sahakarlekha.com', 24, 0.015);
const latinName = shapeToPath(path.join(FONTS, 'Inter-SemiBold.ttf'), 'Sahakar Lekha', 26);
const tagline = shapeToPath(path.join(FONTS, 'Hind-SemiBold.ttf'), 'सहकारी समितियों का अपना सॉफ्टवेयर', 34);

// ---------- 1. TILE (512): orange square, white स ----------
const T = 512, R = T * 0.22;
const saH = sa.bb.y2 - sa.bb.y1, saW = sa.bb.x2 - sa.bb.x1;
const k = (T * 0.62) / saH;
const saDx = (T - saW * k) / 2 - sa.bb.x1 * k;
const saDy = (T - saH * k) / 2 - sa.bb.y1 * k;
const saTransform = `translate(${saDx.toFixed(2)} ${saDy.toFixed(2)}) scale(${k.toFixed(4)})`;
svgFile('SL_B-02_tile_v1.0.svg', T, T,
  p(roundedRect(0, 0, T, T, R), ORANGE) + `<g transform="${saTransform}">${p(sa.d, WHITE)}</g>`,
  'SahakarLekha tile logo');

for (const [file, tileFill, saFill] of [
  ['SL_B-02_tile-mono-navy_v1.0.svg', NAVY, WHITE],
  ['SL_B-02_tile-mono-white_v1.0.svg', WHITE, NAVY],
]) {
  svgFile(file, T, T,
    p(roundedRect(0, 0, T, T, R), tileFill) + `<g transform="${saTransform}">${p(sa.d, saFill)}</g>`,
    'SahakarLekha tile logo monochrome');
}

// ---------- 2. HORIZONTAL LOCKUP ----------
const TH = 128, GAP = 30;
const k2 = TH / T;
const tileSmall = () =>
  `<g transform="scale(${k2.toFixed(4)})">` +
  p(roundedRect(0, 0, T, T, R), ORANGE) +
  `<g transform="${saTransform}">${p(sa.d, WHITE)}</g></g>`;

const textX = TH + GAP;
const wordDy = 52 - (word.bb.y1 + word.bb.y2) / 2;
const latDy = 109 - (latin.bb.y1 + latin.bb.y2) / 2;
const lockW = textX + Math.max(word.advance, latin.advance) + 6;
const lockup = (wordFill, latFill) =>
  g(textX, wordDy, p(word.d, wordFill)) + g(textX, latDy, p(latin.d, latFill));

svgFile('SL_B-02_logo-horizontal_v1.0.svg', lockW, TH,
  tileSmall() + lockup(NAVY, ORANGE), 'SahakarLekha logo');
svgFile('SL_B-02_logo-horizontal-reversed_v1.0.svg', lockW, TH,
  tileSmall() + lockup(WHITE, ORANGE), 'SahakarLekha logo reversed');

// clean variant: wordmark only, no URL line — for letterheads/contexts that
// already show the domain elsewhere. Wordmark vertically centered on tile.
const wordDyC = 64 - (word.bb.y1 + word.bb.y2) / 2;
const lockWC = textX + word.advance + 6;
svgFile('SL_B-02_logo-horizontal-clean_v1.0.svg', lockWC, TH,
  tileSmall() + g(textX, wordDyC, p(word.d, NAVY)), 'SahakarLekha logo clean');
svgFile('SL_B-02_logo-horizontal-clean-reversed_v1.0.svg', lockWC, TH,
  tileSmall() + g(textX, wordDyC, p(word.d, WHITE)), 'SahakarLekha logo clean reversed');

// ---------- 3. STACKED ----------
const ST = 160, kS = ST / T;
const stackW = Math.max(word.advance, ST) + 48;
const tileX = (stackW - ST) / 2;
const wordX = (stackW - word.advance) / 2;
const latX = (stackW - latinName.advance) / 2;
const wordTop = ST + 34; // top of wordmark block
const wordBase = wordTop - word.bb.y1;
const latBase = wordBase + (word.bb.y2 - word.bb.y1) * 0.2 + 34 - latinName.bb.y1;
const stackH = latBase + latinName.bb.y2 + 14;
const stackBody = (wordFill, latFill) =>
  `<g transform="translate(${tileX.toFixed(2)} 0) scale(${kS.toFixed(4)})">` +
  p(roundedRect(0, 0, T, T, R), ORANGE) +
  `<g transform="${saTransform}">${p(sa.d, WHITE)}</g></g>` +
  g(wordX, wordBase, p(word.d, wordFill)) +
  g(latX, latBase, p(latinName.d, latFill));
svgFile('SL_B-02_logo-stacked_v1.0.svg', stackW, stackH, stackBody(NAVY, ORANGE), 'SahakarLekha stacked logo');
svgFile('SL_B-02_logo-stacked-reversed_v1.0.svg', stackW, stackH, stackBody(WHITE, ORANGE), 'SahakarLekha stacked logo reversed');

// ---------- 4. HORIZONTAL + TAGLINE ----------
const tagBase = TH + 40 - tagline.bb.y1;
const tagW = Math.max(lockW, textX + tagline.advance + 6);
const tagH = tagBase + tagline.bb.y2 + 14;
svgFile('SL_B-02_logo-with-tagline_v1.0.svg', tagW, tagH,
  tileSmall() + lockup(NAVY, ORANGE) + g(textX, tagBase, p(tagline.d, NAVY_DARK)),
  'SahakarLekha logo with tagline');

console.log('colors', { NAVY, ORANGE, NAVY_DARK });
