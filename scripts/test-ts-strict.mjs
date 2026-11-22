// TEST-04 (product audit 2026-11-17): the app is type-checked in STRICT mode (`npm run typecheck`, run by CI).
// Before 2026-11-22: strict, strictNullChecks and noImplicitAny were all off — a null that a screen did not handle,
// or a callback typed `any`, compiled silently. Turning them on found 150 errors: 126 were one helper's generic bound
// (lazyWithRetry in App.tsx); the rest were real gaps (a voucher form that would crash on a template of a type it had
// no config for, a null price read as 0 by Math.min, a header read without a null check, …), each fixed.
// This test keeps the switches on and the escape hatches from growing.
// Run: node scripts/test-ts-strict.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const cfg = JSON.parse(read('tsconfig.app.json').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
const o = cfg.compilerOptions;
ok(o.strict === true, 'tsconfig.app.json: "strict": true');
ok(o.noImplicitAny !== false, 'noImplicitAny is not switched back off');
for (const f of ['strictNullChecks', 'strictFunctionTypes', 'strictBindCallApply', 'strictPropertyInitialization', 'useUnknownInCatchVariables', 'noImplicitThis', 'alwaysStrict']) {
  ok(o[f] !== false, `${f} is not switched off under strict`);
}
ok(JSON.parse(read('package.json')).scripts.typecheck === 'tsc --noEmit -p tsconfig.app.json', 'npm run typecheck checks the app config');
ok(/npm run typecheck|tsc --noEmit -p tsconfig\.app\.json/.test(read('.github/workflows/ci.yml')), 'CI runs the type check');

// formulas.js stays JS (the prerender imports it); its .d.ts must declare every export
const js = read('src/lib/calculators/formulas.js');
const dts = read('src/lib/calculators/formulas.d.ts');
const exportsJs = [...js.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
const missing = exportsJs.filter((n) => !new RegExp(`export function ${n}\\(`).test(dts));
ok(exportsJs.length >= 13 && missing.length === 0, `formulas.d.ts declares every formulas.js export (missing: ${missing.join(', ') || 'none'})`);

// escape hatches may only shrink: `as unknown as` (164 on 2026-11-22) and @ts-ignore / @ts-nocheck (none)
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n)) files.push(p); } };
walk(join(ROOT, 'src'));
let casts = 0, ignores = [];
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  casts += (s.match(/as unknown as/g) || []).length;
  if (/@ts-(ignore|nocheck)/.test(s)) ignores.push(f.replace(ROOT, '').replace(/\\/g, '/'));
}
ok(casts <= 164, `"as unknown as" casts do not grow (now ${casts}, ceiling 164 — lower the ceiling when you remove some)`);
ok(ignores.length === 0, `no @ts-ignore / @ts-nocheck in src (${ignores.join(', ')})`);

console.log(`TEST-04 strict TypeScript: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
