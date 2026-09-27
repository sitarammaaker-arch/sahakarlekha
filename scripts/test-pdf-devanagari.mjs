// Hindi DATA in PDF tables (names, narrations) is drawn by the browser (jsPDF cannot shape
// Devanagari). Pure parts + wiring; the canvas drawing itself is browser-only.
// Run: node scripts/test-pdf-devanagari.mjs
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    return next(spec, ctx);
  }
`));
const D = await import(pathToFileURL(path.join(SRC, 'lib/pdfDevanagari.ts')).href);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
ok(D.hasDevanagari('किसान') && !D.hasDevanagari('Farmer 123'), 'detects Devanagari');
ok(D.devanagariPlaceholder('किसान') === 'nnn' && D.devanagariPlaceholder('की') === 'n', 'placeholder: one Latin char per letter, none for matras');
ok(D.devanagariPlaceholder('MSP गेहूँ 51,700') === 'MSP nn 51,700', 'Latin and digits kept as they are');
D.installDevanagariCells();
ok(true, 'install is a no-op outside a browser (no throw)');
const pdf = fs.readFileSync(path.join(SRC, 'lib/pdf.ts'), 'utf8');
ok(/^installDevanagariCells\(\);/m.test(pdf), 'installed once, where every PDF module loads (lib/pdf.ts)');
const mod = fs.readFileSync(path.join(SRC, 'lib/pdfDevanagari.ts'), 'utf8');
ok(/autoTableSetDefaults\(/.test(mod) && /willDrawCell/.test(mod) && /minCellHeight/.test(mod) && /actualBoundingBoxAscent/.test(mod), 'global table hooks; placeholder not drawn; room for marks; laid out by the real ink box (no clipped matras)');
console.log(`PDF Devanagari: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
