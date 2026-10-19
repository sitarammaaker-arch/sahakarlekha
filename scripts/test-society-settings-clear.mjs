// society_settings: a field CLEARED with undefined must reach the DB as null (RULE 1).
//
// Bug (2026-10-19): updateSociety upserts the whole row; JSON.stringify drops undefined keys, so period
// unlock (periodLockDate: undefined), the FY unlock request, liability type "not recorded", emptied numeric
// limits … cleared on screen but the DB kept the old value — back after refresh. Guards the pure helper and
// that updateSociety spreads it into the payload.
//
// Run: node scripts/test-society-settings-clear.mjs   (npm run test:society-settings-clear)

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


import { readFileSync } from 'node:fs';
const H = await import(abs('../src/lib/settingsPayload.ts'));
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const out = H.clearedKeysAsNull({ periodLockDate: undefined, periodLockBy: undefined, name: 'X', fyLocked: false, gstin: '', limit: 0 });
ok(JSON.stringify(out) === JSON.stringify({ periodLockDate: null, periodLockBy: null }), 'only undefined keys become null');
ok(JSON.stringify({ a: 1, ...out }).includes('"periodLockDate":null'), 'a cleared key survives JSON as null (undefined would vanish)');
ok(Object.keys(H.clearedKeysAsNull({})).length === 0, 'nothing cleared → nothing added');

const ctx = readFileSync(new URL('../src/contexts/DataContext.tsx', import.meta.url), 'utf8');
ok(/attempt\(\{ id: societyIdRef\.current, society_id: societyIdRef\.current, \.\.\.updated, \.\.\.clearedKeysAsNull\(data\) \}, \[\]\)/.test(ctx), 'updateSociety sends cleared keys as null');

console.log(`\nsociety-settings-clear: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
