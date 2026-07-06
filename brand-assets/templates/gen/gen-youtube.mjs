/* V-01 YouTube channel kit generator — avatar, banner, watermark.
 * Same HarfBuzz-baked-paths approach as gen-social.mjs (shared helper block
 * duplicated deliberately — keep both in sync if editing).
 * Run: `npm run gen:youtube` from brand-assets/templates/. Output: ../export/. */
import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import { Blob as HbBlob, Face, Font, Buffer as HbBuffer, shape as hbShape } from 'harfbuzzjs';
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.join(DIR, '..', '..', 'fonts');
const OUT = path.join(DIR, '..', 'export');
fs.mkdirSync(OUT, { recursive: true });

const NAVY = '#153f79', ORANGE = '#f48525', NAVY_DARK = '#122d54',
  WHITE = '#ffffff', GREEN = '#1f9350', LIGHT = '#d1d8e0';

const FONT_FILES = {
  'hind-700': 'Hind-Bold.ttf', 'hind-600': 'Hind-SemiBold.ttf',
  'inter-600': 'Inter-SemiBold.ttf',
};
const fontCache = new Map();
function loadFont(key) {
  if (!fontCache.has(key)) {
    const data = fs.readFileSync(path.join(FONTS, FONT_FILES[key]));
    const ab = () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const face = new Face(new HbBlob(ab()));
    const font = new Font(face);
    font.setScale(face.upem, face.upem);
    const ot = opentype.parse(ab());
    for (let i = 0; i < ot.glyphs.length; i++) ot.glyphs.get(i).path;
    fontCache.set(key, { hbFont: font, upem: face.upem, ot });
  }
  return fontCache.get(key);
}
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
  const runs = text.match(/[ऀ-ॿ‌‍]+|[^ऀ-ॿ‌‍]+/g) || [];
  const { hbFont, upem, ot } = loadFont(fontKey);
  const scale = size / upem;
  let penX = 0, parts = [], bb = null;
  for (const run of runs) {
    const buf = new HbBuffer();
    buf.addText(run);
    buf.guessSegmentProperties();
    hbShape(hbFont, buf);
    for (const g of buf.getGlyphInfosAndPositions()) {
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
  }
  const d = parts.join(' ');
  if (d.includes('NaN')) throw new Error(`NaN shaping "${text}"`);
  return { d, adv: penX * scale, bb: bb || { x1: 0, y1: 0, x2: 0, y2: 0 } };
}
const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const G = (x, y, inner) => `<g transform="translate(${(+x).toFixed(2)} ${(+y).toFixed(2)})">${inner}</g>`;

// tile paths from B-02 master (512 box)
const TILE_D = 'M112.64 0 H399.36 A112.64 112.64 0 0 1 512 112.64 V399.36 A112.64 112.64 0 0 1 399.36 512 H112.64 A112.64 112.64 0 0 1 0 399.36 V112.64 A112.64 112.64 0 0 1 112.64 0Z';
const SA_D = 'M90.6 -106.2L90.6 -106.2L141.3 -106.2L141.3 -167.7L96.9 -167.7L96.9 -133.5Q96.9 -117.6 90.6 -106.2M-9 -201.3L213.6 -201.3L213.6 -167.7L183.6 -167.7L183.6 0L141.3 0L141.3 -72.9L96.3 -72.9Q79.2 -72.9 58.8 -75.3L58.8 -75.3L114.9 0L63.9 0L6 -80.7L6 -110.1L27.3 -110.1Q54.9 -110.1 54.9 -133.2L54.9 -133.2L54.9 -167.7L-9 -167.7L-9 -201.3';
const SA_TRANSFORM = 'translate(94.68 414.72) scale(1.5769)';

function writePng(name, W, H, body, scale = 1) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">\n${body}\n</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W * scale } }).render().asPng();
  fs.writeFileSync(path.join(OUT, name), png);
  console.log('export/' + name, `${(png.length / 1024).toFixed(0)}KB`);
}

/* ---------- 1. AVATAR 800x800 (YouTube crops to circle) ---------- */
{
  const S = 800;
  // full-bleed orange, स centered within the inner 62% (circle-safe)
  let b = `<rect width="${S}" height="${S}" fill="${ORANGE}"/>`;
  // स bbox in tile coords ≈ x 80-432, y 97-415 (from master); center & scale
  const k = (S * 0.52) / 512;
  b += `<g transform="translate(${(S - 512 * k) / 2} ${(S - 512 * k) / 2 + S * 0.01}) scale(${k.toFixed(4)})"><g transform="${SA_TRANSFORM}">${P(SA_D, WHITE)}</g></g>`;
  writePng('SL_V-01_yt-avatar_800.png', S, S, b);
}

/* ---------- 2. BANNER 2560x1440 (safe area 1546x423 centered) ---------- */
{
  const W = 2560, H = 1440;
  const CX = W / 2;
  // safe area: x 507..2053, y 508..931
  let b = `<rect width="${W}" height="${H}" fill="${NAVY}"/>`;
  b += `<circle cx="230" cy="180" r="330" fill="${NAVY_DARK}"/>`;
  b += `<circle cx="2380" cy="1260" r="380" fill="${NAVY_DARK}"/>`;
  // lockup centered: tile 130 + wordmark
  const TH = 130;
  const word = shapeText('सहकार लेखा', 'hind-700', TH * 0.62);
  const gap = 36;
  const lockW = TH + gap + word.adv;
  const lx = CX - lockW / 2, ly = 545;
  const k = TH / 512;
  b += `<g transform="translate(${lx.toFixed(1)} ${ly}) scale(${k.toFixed(4)})">${P(TILE_D, ORANGE)}<g transform="${SA_TRANSFORM}">${P(SA_D, WHITE)}</g></g>`;
  const wordDy = ly + TH * 0.52 - (word.bb.y1 + word.bb.y2) / 2;
  b += G(lx + TH + gap, wordDy, P(word.d, WHITE));
  // tagline
  const tag = shapeText('सहकारी समितियों का अपना सॉफ्टवेयर', 'hind-600', 44);
  b += G(CX - tag.adv / 2, 768, P(tag.d, LIGHT));
  // domain pill
  const dom = shapeText('sahakarlekha.com', 'inter-600', 38);
  const pw = dom.adv + 96, ph = 74, py = 812;
  b += `<rect x="${(CX - pw / 2).toFixed(1)}" y="${py}" width="${pw.toFixed(1)}" height="${ph}" rx="${ph / 2}" fill="${ORANGE}"/>`;
  const domDy = py + ph / 2 - (dom.bb.y1 + dom.bb.y2) / 2;
  b += G(CX - dom.adv / 2, domDy, P(dom.d, WHITE));
  // tricolor strip bottom edge (outside safe area — decorative on desktop)
  b += `<rect y="${H - 30}" width="${W}" height="10" fill="${ORANGE}"/><rect y="${H - 20}" width="${W}" height="10" fill="${WHITE}"/><rect y="${H - 10}" width="${W}" height="10" fill="${GREEN}"/>`;
  writePng('SL_V-01_yt-banner_2560x1440.png', W, H, b);
}

/* ---------- 3. WATERMARK 300x300 (white tile, स knocked out via mask) ---------- */
{
  const S = 300, k = S / 512;
  const mask = `<mask id="m"><rect width="512" height="512" fill="#fff"/><g transform="${SA_TRANSFORM}"><path d="${SA_D}" fill="#000"/></g></mask>`;
  const b = `<g transform="scale(${k.toFixed(4)})">${mask}<path d="${TILE_D}" fill="${WHITE}" fill-opacity="0.9" mask="url(#m)"/></g>`;
  writePng('SL_V-01_yt-watermark_300.png', S, S, b);
}
