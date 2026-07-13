// Error reporting seam (production-audit P0) — the pure buildErrorRecord shaping.
// Imports the REAL src/lib/errorReporting.ts via an '@/'-resolving loader that STUBS
// @/lib/supabase (buildErrorRecord is pure; reportError's insert is the I/O, not tested here).
//
// Run: node scripts/test-error-reporting.mjs   (npm run test:error-reporting)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      const SB = pathToFileURL(PR(SRC, 'lib', 'supabase.ts')).href;
      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SB, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
      export async function load(u, c, n) { if (u === SB) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' }; return n(u, c); }
    `),
);

const { buildErrorRecord } = await import(abs('../src/lib/errorReporting.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const NOW = '2026-07-13T00:00:00.000Z';

// ── an Error object: message + stack + injected context/url/now ───────────────
const r1 = buildErrorRecord('supabase-save', new Error('boom'), { voucherId: 'V1' }, NOW, 'http://x/vouchers');
ok(r1.source === 'supabase-save' && r1.message === 'boom', 'Error → source + message');
ok(typeof r1.stack === 'string' && r1.stack.includes('Error'), 'stack captured as a string');
ok(JSON.stringify(r1.context) === JSON.stringify({ voucherId: 'V1' }), 'context passed through');
ok(r1.url === 'http://x/vouchers' && r1.created_at === NOW, 'url + injected now used');
ok(typeof r1.id === 'string' && r1.id.length > 0, 'id is a non-empty string');

// ── a plain string / a non-error value / null ────────────────────────────────
ok(buildErrorRecord('s', 'plain failure').message === 'plain failure', 'string error → message, no stack');
ok(buildErrorRecord('s', 'plain failure').stack === null, 'string error has null stack');
ok(buildErrorRecord('s', null).message === 'Unknown error', 'null error → "Unknown error"');
ok(buildErrorRecord('s', { message: 42 }).message === '42', 'non-string message coerced');

// ── truncation guards (one huge error can't bloat the row) ───────────────────
ok(buildErrorRecord('s', 'x'.repeat(5000)).message.length === 2000, 'message clipped to 2000');
ok(buildErrorRecord('x'.repeat(500), 'e').source.length === 100, 'source clipped to 100');
const big = new Error('e'); big.stack = 's'.repeat(20000);
ok(buildErrorRecord('s', big).stack.length === 8000, 'stack clipped to 8000');

// ── defaults ─────────────────────────────────────────────────────────────────
const r2 = buildErrorRecord('', 'e', undefined, NOW);
ok(r2.source === 'unknown' && r2.context === null && r2.url === null, 'empty source → "unknown"; missing context/url → null');

console.log(`\nError reporting (buildErrorRecord): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
