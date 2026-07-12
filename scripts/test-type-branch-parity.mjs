// T-14 — retiring operational societyType branches is behaviour-preserving.
//
// T-14 replaces three operational `societyType === X` branches with CAPABILITY checks:
//   • DataContext stock defaults:  `=== 'consumer'`  →  has('pos_billing')
//   • DairyDataContext seed guard:  `!== 'dairy'`     →  has('dairy_collection')
//   • ConsumerDataContext seed:     `!== 'consumer'`  →  has('pos_billing')
//
// The swap is safe ONLY IF, for the society types that could hold real data (the 8 original
// types, pre-T-13), the capability is granted to EXACTLY that one type. This test enforces
// that invariant — so a future template edit that breaks it (e.g. granting pos_billing to
// another original type) fails here loudly, before it silently changes stock-account defaults.
//
// Run: node scripts/test-type-branch-parity.mjs   (npm run test:type-branch-parity)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let stc;
try {
  stc = await import(abs('../src/lib/navigation/societyTypeCapabilities.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import societyTypeCapabilities.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const CAPS = stc.SOCIETY_TYPE_CAPABILITIES;
// The types that existed before T-13 added producer/multistate/multipurpose — i.e. the ones
// that can hold pre-existing societies whose behaviour must not change.
const ORIGINAL = ['marketing_processing', 'pacs', 'consumer', 'labour', 'dairy', 'housing', 'sugar', 'other'];

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const typesWith = (cap) => ORIGINAL.filter((t) => CAPS[t].includes(cap));

// ── The behaviour-preserving invariant ───────────────────────────────────────
const withPos = typesWith('pos_billing');
ok(withPos.length === 1 && withPos[0] === 'consumer',
  `among original types, pos_billing is granted to EXACTLY 'consumer' (got: ${withPos.join(',') || 'none'}) — so has('pos_billing') === (type === 'consumer')`);

const withDairy = typesWith('dairy_collection');
ok(withDairy.length === 1 && withDairy[0] === 'dairy',
  `among original types, dairy_collection is granted to EXACTLY 'dairy' (got: ${withDairy.join(',') || 'none'}) — so has('dairy_collection') === (type === 'dairy')`);

// Sanity: the caps the swap depends on actually exist somewhere.
ok(Object.values(CAPS).some((v) => v.includes('pos_billing')), 'pos_billing exists in the templates');
ok(Object.values(CAPS).some((v) => v.includes('dairy_collection')), 'dairy_collection exists in the templates');

console.log(`\nT-14 type-branch parity: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
