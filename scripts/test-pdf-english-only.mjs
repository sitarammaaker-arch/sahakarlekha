// The generators in pdf.ts carry no Hindi: the PDF font (helvetica) has no Devanagari, so a Hindi literal in the
// generator code would print as garbage (seen on the Rania Balance Sheet). Hindi PDFs (R12) are produced by TRANSLATING
// the English labels at draw time and drawing them through the browser — all Hindi wording lives in
// src/lib/pdfHindiLabels.ts, never in pdf.ts.
// Guard: no Devanagari string literal in src/lib/pdf.ts outside comments.
// Run: node scripts/test-pdf-english-only.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lines = fs.readFileSync(path.join(ROOT, 'src/lib/pdf.ts'), 'utf8').split('\n');
const bad = lines.map((l, i) => [i + 1, l]).filter(([, l]) => /[ऀ-ॿ]/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
let fail = 0;
if (bad.length) { fail = 1; for (const [n, l] of bad) console.error(`  ✗ pdf.ts:${n} Hindi text in a PDF: ${l.trim().slice(0, 100)}`); }
console.log(`PDF generators Hindi-free: ${bad.length ? 0 : 1} passed, ${fail} failed`);
if (fail) process.exit(1);
