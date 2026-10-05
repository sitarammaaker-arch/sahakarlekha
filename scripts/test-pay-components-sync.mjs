// The payroll component lists that must agree with each other. The Payroll page lets an admin ADD a component to an employee
// (ADDABLE_COMPONENTS / FIXED_COMPONENTS in src/pages/Payroll.tsx); the pay-employee Edge Function only accepts codes it has in
// COMPONENTS — a code the page offers but the server does not know is a 400 "unknown component", and a fixed component added
// without an amount makes the calc refuse the whole run. Two hand-kept lists drift, so this reads both sources and compares.
//
// Also pins the Professional Tax decision: PT is MANUAL (a fixed amount), never a slab formula — no state's PT slab is verified
// (lib/professionalTax.ts PT_SLAB_SOURCES is empty, RM-22 decision A) — and the ledger books it to the PT payable head.
//
// Run: node scripts/test-pay-components-sync.mjs   (npm run test:pay-components-sync)

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(pathResolve(HERE, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const ui = read('src/pages/Payroll.tsx');
const srv = read('supabase/functions/pay-employee/index.ts');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };

// ── the server's COMPONENTS (explicit entries) + the TDS family it adds in a loop ─────────────────────────────────────
const block = srv.slice(srv.indexOf('const COMPONENTS: Record<'), srv.indexOf('\n};', srv.indexOf('const COMPONENTS: Record<')));
const server = {};
for (const m of block.matchAll(/^ {2}([A-Z][A-Z_]*):\s*\{\s*kind:\s*'([a-z_]+)',\s*method:\s*'([a-z_]+)',\s*formula:\s*([^,]+),/gm)) {
  server[m[1]] = { kind: m[2], method: m[3], formula: m[4].trim() };
}
const tdsFamily = ['TDS', 'TDS_NOHRA', 'TDS_DEP', 'TDS_CONSOL', 'TDS_STIPEND'];   // added by `for (… of Object.entries(TDS_FORMULAS))`
ok(/for \(const \[code, formula\] of Object\.entries\(TDS_FORMULAS/.test(srv), 'the server adds the TDS family from TDS_FORMULAS');
for (const c of tdsFamily) server[c] = server[c] || { kind: 'deduction', method: 'formula', formula: '(TDS_FORMULAS)' };
console.log(`\n(server COMPONENTS parsed: ${Object.keys(server).length} codes)`);

// ── the page's lists ──────────────────────────────────────────────────────────────────────────────────────────────────
const addBlock = ui.slice(ui.indexOf('const ADDABLE_COMPONENTS = ['), ui.indexOf('];', ui.indexOf('const ADDABLE_COMPONENTS = [')));
const addable = [...addBlock.matchAll(/\{\s*code:\s*'([A-Z_]+)'/g)].map((m) => m[1]);
const fixedUi = [...(ui.match(/const FIXED_COMPONENTS = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);

console.log('\n1. every component the page offers is one the server accepts');
ok(addable.length > 10, `parsed ${addable.length} addable components from the page`);
const unknown = addable.filter((c) => !server[c]);
ok(unknown.length === 0, 'no addable code is unknown to the server' + (unknown.length ? ' — unknown: ' + unknown.join(', ') : ''));
ok(new Set(addable).size === addable.length, 'no component is listed twice');

console.log('\n2. a component with a FIXED method needs an amount — the page must ask for one, and ONLY for those');
const serverFixed = Object.keys(server).filter((c) => server[c].method === 'fixed').sort();
ok(JSON.stringify([...fixedUi].sort()) === JSON.stringify(serverFixed), `the page's FIXED_COMPONENTS = the server's fixed components [${serverFixed.join(', ')}]`);

console.log('\n3. Professional Tax is MANUAL — never a slab formula, and booked to the PT payable head');
ok(!!server.PT, 'the server knows PT');
ok(server.PT && server.PT.kind === 'deduction', 'PT is a deduction');
ok(server.PT && server.PT.method === 'fixed' && server.PT.formula === 'null', 'PT is a FIXED amount with NO formula (no state slab is verified — nothing may auto-fill)');
ok(addable.includes('PT') && fixedUi.includes('PT'), 'the page offers PT and asks for its amount');
// CODE, not comments: no import of the PT slab module and no call to its functions
ok(!/from\s+['"][^'"]*professionalTax['"]/.test(srv) && !/\b(professionalTax|professionalTaxForState|ptAutoFill)\s*\(/.test(srv), 'pay-employee neither imports nor calls any PT slab function');
{
  const R = await import(pathToFileURL(pathResolve(HERE, '..', 'src/lib/pay/posting/runPosting.ts')).href);
  ok(R.bucketOf('PT', 'deduction') === 'pt', 'the ledger builder classes PT as the pt bucket');
  const heads = { salaryExpense: '5201', salaryPayable: '2103', ptPayable: '2207' };
  const lines = [{ code: 'BASIC', kind: 'earning', amountMinor: 3000000 }, { code: 'PT', kind: 'deduction', amountMinor: 20000 }];
  const okRun = R.buildRunAccrual(lines, 2980000, heads, () => 'x');
  ok(okRun.ok && okRun.legs.some((l) => l.accountId === '2207' && l.drCr === 'Cr' && l.amountMinor === 20000), 'a run with PT credits the PT payable head (₹200)');
  const noHead = R.buildRunAccrual(lines, 2980000, { salaryExpense: '5201', salaryPayable: '2103' }, () => 'x');
  ok(!noHead.ok && noHead.code === 'PAY-POST-HEAD' && noHead.missingHeads.includes('professional_tax.payable'), 'with no PT payable head mapped, the posting is REFUSED (not mis-booked)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
