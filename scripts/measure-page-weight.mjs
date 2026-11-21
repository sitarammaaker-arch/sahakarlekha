// PERF-02: what a page downloads on first open = its chunk + every chunk it imports STATICALLY (dynamic import()
// calls are not followed: they load on demand). Reads the built dist/ (run `vite build` first).
// Usage: node scripts/measure-page-weight.mjs Vouchers [CashBook ...]
// Prints the gzip total per page and whether the PDF (jspdf) or Excel (xlsx) vendor chunk is in that closure.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'dist', 'assets');

export function staticClosure(start, read = (f) => readFileSync(join(ASSETS, f), 'utf8')) {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    const src = read(f);
    // static: `import ... from"./x.js"` and bare `import"./x.js"` — never `import("./x.js")`
    for (const m of src.matchAll(/(?:from\s*|import\s*)"\.\/([^"]+\.js)"/g)) walk(m[1]);
  };
  walk(start);
  return [...seen];
}

export function vendorChunk(files, prefix) {
  return files.some((f) => f.startsWith(prefix + '-') && /^[a-z]+-[A-Za-z0-9_-]{8}\.js$/.test(f) && readFileSync(join(ASSETS, f)).length > 300_000);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const all = readdirSync(ASSETS);
  for (const page of process.argv.slice(2)) {
    const chunk = all.find((f) => f.startsWith(page + '-') && f.endsWith('.js'));
    if (!chunk) { console.log(`${page}: no chunk`); continue; }
    const files = staticClosure(chunk);
    const gz = files.reduce((s, f) => s + gzipSync(readFileSync(join(ASSETS, f))).length, 0);
    console.log(`${page}: ${(gz / 1024).toFixed(0)} KB gzip in ${files.length} chunks · pdf vendor: ${vendorChunk(files, 'pdf') ? 'YES' : 'no'} · xlsx vendor: ${vendorChunk(files, 'xlsx') ? 'YES' : 'no'}`);
  }
}
