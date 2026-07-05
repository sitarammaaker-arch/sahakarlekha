/* B-04 social template generator.
 * WHY BAKED PATHS: resvg's live <text> cannot shape Devanagari (broken matras,
 * reph, lost spaces) — so every string is shaped with HarfBuzz and baked as
 * vector paths, same as the logo masters. Edit ../content/*.json, then run
 * `npm run gen` from templates/. Outputs SVG + 2x PNG into ../export/. */
import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import { Blob as HbBlob, Face, Font, Buffer as HbBuffer, shape as hbShape } from 'harfbuzzjs';
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.join(DIR, '..', '..', 'fonts');
const CONTENT = path.join(DIR, '..', 'content');
const OUT = path.join(DIR, '..', 'export');
fs.mkdirSync(OUT, { recursive: true });

// tokens (brand-assets/tokens/tokens.json)
const NAVY = '#153f79', ORANGE = '#f48525', NAVY_DARK = '#122d54',
  WHITE = '#ffffff', GREEN = '#1f9350', LIGHT = '#d1d8e0', MUT = '#676f7e';

const FONT_FILES = {
  'hind-700': 'Hind-Bold.ttf', 'hind-600': 'Hind-SemiBold.ttf',
  'hind-500': 'Hind-Medium.ttf', 'hind-400': 'Hind-Regular.ttf',
  'inter-700': 'Inter-Bold.ttf', 'inter-600': 'Inter-SemiBold.ttf',
  'inter-400': 'Inter-Regular.ttf',
};

const fontCache = new Map();
function loadFont(key) {
  if (!fontCache.has(key)) {
    const file = path.join(FONTS, FONT_FILES[key]);
    const data = fs.readFileSync(file);
    const ab = () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const face = new Face(new HbBlob(ab()));
    const font = new Font(face);
    font.setScale(face.upem, face.upem);
    const ot = opentype.parse(ab());
    for (let i = 0; i < ot.glyphs.length; i++) ot.glyphs.get(i).path; // pre-parse
    fontCache.set(key, { hbFont: font, upem: face.upem, ot });
  }
  return fontCache.get(key);
}

// serialize raw commands ourselves (opentype's toPathData emits NaN sometimes)
const ser = cmds => cmds.map(c => {
  const n = v => +v.toFixed(3);
  switch (c.type) {
    case 'M': return `M${n(c.x)} ${n(c.y)}`;
    case 'L': return `L${n(c.x)} ${n(c.y)}`;
    case 'Q': return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
    case 'C': return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
    case 'Z': return 'Z';
    default: throw new Error('cmd ' + c.type);
  }
}).join('');

function shapeText(text, fontKey, size) {
  const { hbFont, upem, ot } = loadFont(fontKey);
  const buf = new HbBuffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hbShape(hbFont, buf);
  const glyphs = buf.getGlyphInfosAndPositions();
  const scale = size / upem;
  let penX = 0, parts = [], bb = null;
  for (const g of glyphs) {
    const p = ot.glyphs.get(g.codepoint)
      .getPath((penX + (g.xOffset || 0)) * scale, -((g.yOffset || 0)) * scale, size);
    const d = ser(p.commands);
    if (d) {
      parts.push(d);
      const b = p.getBoundingBox();
      bb = bb ? { x1: Math.min(bb.x1, b.x1), y1: Math.min(bb.y1, b.y1), x2: Math.max(bb.x2, b.x2), y2: Math.max(bb.y2, b.y2) } : { ...b };
    }
    penX += g.xAdvance;
  }
  const d = parts.join(' ');
  if (d.includes('NaN')) throw new Error(`NaN shaping "${text}"`);
  return { d, adv: penX * scale, bb: bb || { x1: 0, y1: 0, x2: 0, y2: 0 } };
}

/* ---------- drawing helpers (all return SVG strings) ---------- */
const P = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const G = (x, y, inner) => `<g transform="translate(${(+x).toFixed(2)} ${(+y).toFixed(2)})">${inner}</g>`;

// text placed by baseline start (x,y); anchor: 'start'|'middle'|'end'
function txt(str, fontKey, size, color, x, y, anchor = 'start') {
  const t = shapeText(str, fontKey, size);
  const dx = anchor === 'middle' ? x - t.adv / 2 : anchor === 'end' ? x - t.adv : x;
  return { svg: G(dx, y, P(t.d, color)), adv: t.adv, bb: t.bb };
}
// vertically-centered text inside band [cy] (uses bbox midpoint)
function txtC(str, fontKey, size, color, x, cy, anchor = 'start') {
  const t = shapeText(str, fontKey, size);
  const dy = cy - (t.bb.y1 + t.bb.y2) / 2;
  const dx = anchor === 'middle' ? x - t.adv / 2 : anchor === 'end' ? x - t.adv : x;
  return { svg: G(dx, dy, P(t.d, color)), adv: t.adv };
}
const rr = (x, y, w, h, r, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;

// tile + wordmark lockup, H = tile height
const TILE_D = 'M112.64 0 H399.36 A112.64 112.64 0 0 1 512 112.64 V399.36 A112.64 112.64 0 0 1 399.36 512 H112.64 A112.64 112.64 0 0 1 0 399.36 V112.64 A112.64 112.64 0 0 1 112.64 0Z';
const SA_D = 'M90.6 -106.2L90.6 -106.2L141.3 -106.2L141.3 -167.7L96.9 -167.7L96.9 -133.5Q96.9 -117.6 90.6 -106.2M-9 -201.3L213.6 -201.3L213.6 -167.7L183.6 -167.7L183.6 0L141.3 0L141.3 -72.9L96.3 -72.9Q79.2 -72.9 58.8 -75.3L58.8 -75.3L114.9 0L63.9 0L6 -80.7L6 -110.1L27.3 -110.1Q54.9 -110.1 54.9 -133.2L54.9 -133.2L54.9 -167.7L-9 -167.7L-9 -201.3';
function lockup(x, y, H, wordColor = WHITE) {
  const k = H / 512;
  const tile = `<g transform="translate(${x} ${y}) scale(${k.toFixed(4)})">${P(TILE_D, ORANGE)}<g transform="translate(94.68 414.72) scale(1.5769)">${P(SA_D, WHITE)}</g></g>`;
  const word = txtC('सहकार लेखा', 'hind-700', H * 0.6, wordColor, x + H * 1.27, y + H * 0.52);
  return tile + word.svg;
}

// tricolor strip on one edge; band = per-stripe thickness
function strip(W, yTop, band) {
  return rr(0, yTop, W, band, 0, ORANGE) + rr(0, yTop + band, W, band, 0, WHITE) + rr(0, yTop + 2 * band, W, band, 0, GREEN);
}

// drawn arrow (no font glyph): stroke-based, centered on cy
const arrow = (x, cy, len = 30, col = WHITE) =>
  `<path d="M${x} ${cy} h${len} m0 0 l-11 -9 m11 9 l-11 9" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

// drawn green check, ~s px tall, baseline-ish at (x, cy)
const check = (x, cy, s = 22, col = GREEN) =>
  `<path d="M${x} ${cy} l${s * 0.35} ${s * 0.35} l${s * 0.75} ${-s * 0.8}" stroke="${col}" stroke-width="${s * 0.28}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

// green pill badge, right-aligned or centered
function badge(text, size, xRight, yTop, h, mode = 'right') {
  const t = shapeText(text, 'hind-600', size);
  const w = t.adv + h * 1.1;
  const x = mode === 'right' ? xRight - w : xRight - w / 2;
  return rr(x, yTop, w, h, h / 2, GREEN) + txtC(text, 'hind-600', size, WHITE, x + w / 2, yTop + h / 2 + 1, 'middle').svg;
}

// orange CTA pill with drawn arrow, centered at cx
function cta(text, size, cx, yTop, h) {
  const t = shapeText(text, 'hind-600', size);
  const aw = 34, gap = 16;
  const w = t.adv + aw + gap + h * 1.2;
  const x = cx - w / 2;
  const tx = x + (w - t.adv - aw - gap) / 2;
  const cy = yTop + h / 2;
  return rr(x, yTop, w, h, h / 2, ORANGE) +
    txtC(text, 'hind-600', size, WHITE, tx, cy + 1).svg +
    arrow(tx + t.adv + gap, cy, aw);
}

function blobs(spec) { return spec.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${NAVY_DARK}"/>`).join(''); }

function writeOut(name, W, H, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sahakar Lekha">\n<!-- generated by templates/gen/gen-social.mjs — edit content/*.json and re-run; do not hand-edit -->\n${body}\n</svg>\n`;
  fs.writeFileSync(path.join(OUT, name + '.svg'), svg, 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 } }).render().asPng();
  fs.writeFileSync(path.join(OUT, name + '.png'), png);
  console.log(`export/${name}.png`, `${(png.length / 1024).toFixed(0)}KB`);
}

/* ---------- format layouts ---------- */

function square(c, name) {
  const W = 1080, H = 1080;
  let b = rr(0, 0, W, H, 0, NAVY) + blobs([[985, 105, 270], [75, 1030, 210]]);
  b += lockup(64, 56, 64);
  if (c.badge) b += badge(c.badge, 30, 1016, 60, 56);
  b += txt(c.hook1, 'hind-700', 92, WHITE, 64, 500).svg;
  if (c.hook2) b += txt(c.hook2, 'hind-700', 92, ORANGE, 64, 618).svg;
  if (c.support) b += txt(c.support, 'hind-400', 40, LIGHT, 64, 706).svg;
  b += cta(c.cta || 'मुफ़्त शुरू करें', 36, 300, 880, 76);
  b += txt('sahakarlekha.com', 'inter-600', 30, LIGHT, 64, 1006).svg;
  b += strip(W, H - 18, 6);
  writeOut(name, W, H, b);
}

function status(c, name) {
  const W = 1080, H = 1920;
  let b = rr(0, 0, W, H, 0, NAVY) + blobs([[1000, 150, 300], [60, 1850, 260]]);
  b += lockup(W / 2 - 200, 90, 90);
  if (c.badge) b += badge(c.badge, 34, W / 2, 330, 64, 'center');
  b += txt(c.hook1, 'hind-700', 100, WHITE, W / 2, 760, 'middle').svg;
  if (c.hook2) b += txt(c.hook2, 'hind-700', 100, ORANGE, W / 2, 892, 'middle').svg;
  (c.support || []).forEach((line, i) => {
    b += txt(line, 'hind-400', 44, LIGHT, W / 2, 1010 + i * 64, 'middle').svg;
  });
  (c.checks || []).forEach((line, i) => {
    const y = 1260 + i * 84;
    b += check(316, y - 12, 26) + txt(line, 'hind-500', 42, WHITE, 372, y).svg;
  });
  b += cta(c.cta || 'मुफ़्त शुरू करें', 42, W / 2, 1580, 88);
  b += txt('sahakarlekha.com', 'inter-600', 36, LIGHT, W / 2, 1750, 'middle').svg;
  b += strip(W, H - 24, 8);
  writeOut(name, W, H, b);
}

function yt(c, name) {
  const W = 1280, H = 720;
  let b = rr(0, 0, W, H, 0, NAVY) + blobs([[1210, 60, 200], [40, 700, 170]]);
  b += lockup(48, 40, 60);
  if (c.badge) {
    const t = shapeText(c.badge, 'hind-600', 30);
    const w = t.adv + 64;
    b += rr(48, 128, w, 58, 29, GREEN) + txtC(c.badge, 'hind-600', 30, WHITE, 48 + w / 2, 157, 'middle').svg;
  }
  b += txt(c.hook1, 'hind-700', 88, WHITE, 48, 330).svg;
  if (c.hook2) b += txt(c.hook2, 'hind-700', 76, ORANGE, 48, 440).svg;
  // screenshot slot (replace at export: drop shot.png beside content json — see README)
  b += `<rect x="680" y="180" width="552" height="386" rx="14" fill="${NAVY_DARK}" stroke="${LIGHT}" stroke-width="2" stroke-dasharray="10 8"/>`;
  b += txt('यहाँ असली screenshot लगाएँ', 'hind-500', 30, LIGHT, 956, 380, 'middle').svg;
  b += txt('demo data · names masked', 'inter-400', 22, MUT, 956, 424, 'middle').svg;
  b += txt('sahakarlekha.com', 'inter-600', 32, LIGHT, 48, 640).svg;
  b += strip(W, H - 18, 6);
  writeOut(name, W, H, b);
}

function og(c, name) {
  const W = 1200, H = 630;
  let b = rr(0, 0, W, H, 0, NAVY) + blobs([[1130, 70, 190], [60, 600, 160]]);
  b += strip(W, 0, 6);
  b += lockup(56, 56, 66);
  b += txt(c.hook1, 'hind-700', 72, WHITE, 56, 330).svg;
  if (c.hook2) b += txt(c.hook2, 'hind-700', 72, ORANGE, 56, 424).svg;
  if (c.support) b += txt(c.support, 'hind-500', 34, LIGHT, 56, 500).svg;
  const t = shapeText('sahakarlekha.com', 'inter-600', 30);
  const w = t.adv + 72;
  b += rr(56, 540, w, 60, 30, ORANGE) + txtC('sahakarlekha.com', 'inter-600', 30, WHITE, 56 + w / 2, 570, 'middle').svg;
  writeOut(name, W, H, b);
}

const LAYOUTS = { square, status, yt, og };

/* ---------- run all content files ---------- */
for (const file of fs.readdirSync(CONTENT).filter(f => f.endsWith('.json'))) {
  const spec = JSON.parse(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
  const base = file.replace('.json', '');
  for (const [fmt, c] of Object.entries(spec)) {
    if (!LAYOUTS[fmt]) { console.warn('unknown format', fmt, 'in', file); continue; }
    LAYOUTS[fmt](c, `SL_B-04_${base}_${fmt}`);
  }
}
