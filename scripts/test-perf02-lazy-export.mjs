// PERF-02 (product audit 2026-11-17): the PDF library (jspdf, ~257 KB gzip) and SheetJS (~161 KB gzip) were static
// imports of every page that can print or export — the voucher screen downloaded both before any button was pressed.
// Now pages print through lib/pdfLazy and export through lib/exportUtils, which load the library on the first click.
// Measured on the built app (scripts/measure-page-weight.mjs): Vouchers 924 → 458 KB gzip, CashBook 883 → 417.
// Run: node scripts/test-perf02-lazy-export.mjs
import { build } from 'esbuild';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── 1. pdfLazy at runtime: loads once, a failure is told and retried, an error never escapes to the click ──
async function bundlePdfLazy(pdfStub) {
  const out = join(tmpdir(), `pdflazy-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  await build({
    entryPoints: [join(SRC, 'lib/pdfLazy.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent',
    plugins: [{
      name: 'stubs',
      setup(b) {
        b.onResolve({ filter: /^@\/hooks\/use-toast$/ }, () => ({ path: 'toast', namespace: 'stub' }));
        b.onResolve({ filter: /^\.\/pdf$/ }, () => ({ path: 'pdf', namespace: 'stub' }));
        b.onLoad({ filter: /^toast$/, namespace: 'stub' }, () => ({ contents: 'export const toast = (t) => globalThis.__toasts.push(t);', loader: 'js' }));
        b.onLoad({ filter: /^pdf$/, namespace: 'stub' }, () => ({ contents: pdfStub, loader: 'js' }));
      },
    }],
  });
  return import(pathToFileURL(out).href);
}
globalThis.document = { documentElement: { lang: 'hi-IN' } };
const realErr = console.error; console.error = () => {};   // the expected failures log; keep the output clean
{
  globalThis.__toasts = []; globalThis.__loads = 0;
  const L = await bundlePdfLazy(`globalThis.__loads++; export function generateVoucherPDF(i, s, o) { if (i === 'boom') throw new Error('x'); return o && o.output === 'file' ? 'FILE' : undefined; }`);
  ok(L.pdfNow() === null, 'nothing is loaded before the first use');
  const r = await L.generateVoucherPDF({}, {}, { output: 'file' });
  ok(r === 'FILE' && globalThis.__loads === 1, 'the first call loads the module and returns the real result');
  await L.generateVoucherPDF({}, {}, {});
  ok(globalThis.__loads === 1 && L.pdfNow() !== null, 'later calls reuse it; pdfNow() is now synchronous (the WhatsApp share path)');
  const bad = await L.generateVoucherPDF('boom', {}, {});
  ok(bad === null && globalThis.__toasts.length === 1 && globalThis.__toasts[0].variant === 'destructive', 'an error while making the PDF: resolves null + one destructive toast (no unhandled rejection)');
  ok(/PDF नहीं बन पाई/.test(globalThis.__toasts[0].title), 'the toast is Hindi first');
}
{
  globalThis.__toasts = [];
  const L = await bundlePdfLazy(`throw new Error('chunk gone');`);
  const r = await L.generateVoucherPDF({}, {}, {});
  ok(r === null && globalThis.__toasts.length === 1 && /refresh/i.test(globalThis.__toasts[0].description), 'a failed load (offline / replaced chunk): null + a toast that says to refresh');
}

// ── 2. exportUtils: no value import of xlsx; downloadExcel loads it and reports a failure ──
{
  const eu = read('src/lib/exportUtils.ts');
  ok(!/^import \* as XLSX from 'xlsx';/m.test(eu) && /^import type \* as XLSXTypes from 'xlsx';/m.test(eu), 'exportUtils imports only the TYPES of xlsx (the library loads on demand)');
  ok(/export async function downloadExcel\(sheets: Sheet\[\], filename: string, meta\?: ExportMeta\): Promise<boolean>/.test(eu), 'downloadExcel is async and resolves true / false');
  ok(eu.includes("notifyExportFailed?.('load'); return false;") && eu.includes("notifyExportFailed?.('build'); return false;"), 'a failed load or build is reported, not swallowed');
  ok(read('src/main.tsx').includes('setExportFailureNotifier((detail) =>'), 'the app registers the destructive toast for a failed Excel export');
  const E = await import(pathToFileURL(join(SRC, 'lib/exportUtils.ts')).href);
  const X = await E.loadXlsx();
  ok(typeof X.utils?.book_new === 'function' && (await E.loadXlsx()) === X, 'loadXlsx resolves the real SheetJS once and reuses it');
  ok(E.buildWorkbook([{ name: 'S', headers: ['A'], rows: [['x']] }]).SheetNames[0] === 'S', 'buildWorkbook works once loaded (pure, still synchronous)');
}

// ── 3. no page pulls the libraries back in statically ──
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n)) files.push(p); } };
walk(SRC);
{
  const xlsxValue = files.filter((f) => /^import (?!type)[^;]*from 'xlsx';/m.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
  ok(xlsxValue.length === 0, `no file imports xlsx as a value (load it with loadXlsx): ${xlsxValue.join(', ')}`);
  const lazyUsers = files.filter((f) => readFileSync(f, 'utf8').includes("from '@/lib/pdfLazy'"));
  ok(lazyUsers.length >= 30, `the print-only pages use pdfLazy (${lazyUsers.length})`);
  const mixed = lazyUsers.filter((f) => /from '(@\/lib\/pdf|jspdf)'/.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
  ok(mixed.length === 0, `no pdfLazy page also imports @/lib/pdf or jspdf statically (that would undo it): ${mixed.join(', ')}`);
  for (const page of ['Vouchers', 'CashBook', 'DayBook', 'Ledger', 'TrialBalance', 'SaleManagement', 'Members']) {
    const s = readFileSync(join(SRC, 'pages', `${page}.tsx`), 'utf8');
    ok(!/from '(@\/lib\/pdf|jspdf|jspdf-autotable|xlsx)'/.test(s), `${page}: no static PDF / Excel library import`);
  }
  const share = read('src/components/WhatsAppShareButton.tsx');
  ok(share.includes('onOpenChange={(open) => { if (open) void preloadPdf().catch(() => {}); }}') && share.includes('if (!pdfNow()) await preloadPdf();'), 'WhatsApp share preloads the PDF module when its menu opens (Safari: no download between the tap and share)');
  for (const f of ['src/pages/Vouchers.tsx', 'src/pages/SaleManagement.tsx', 'src/pages/MaintenanceBilling.tsx']) {
    ok(/const pdf = pdfNow\(\);\n\s+if \(!pdf\) throw new Error\('PDF module not loaded yet'\);/.test(read(f)), `${f.split('/').pop()}: the share-file path builds synchronously from the loaded module`);
  }
  ok(read('src/pages/PurchaseManagement.tsx').includes('.then((r) => { if (r !== null) toast({ title: `Purchase Record:'), 'a success message waits for the PDF (no "done" before it exists)');
}

// ── 4. the measuring tool's closure walk (static imports only) ──
{
  const { staticClosure } = await import('./measure-page-weight.mjs');
  const fake = { 'a.js': 'import{x}from"./b.js";import"./c.js";const l=()=>import("./pdf-HEAVY123.js");', 'b.js': 'export const x=1;', 'c.js': 'import{y}from"./b.js";' };
  const got = staticClosure('a.js', (f) => fake[f]).sort().join(',');
  ok(got === 'a.js,b.js,c.js', `the page weight counts static imports and skips dynamic import() (${got})`);
}

console.error = realErr;
console.log(`PERF-02 lazy export libraries: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
