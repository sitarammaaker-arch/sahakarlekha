// Register of Members (Rule 22) PDF — founder's Rania print 2026-10-18: name over "Reg. No.", shuffled order,
// grand total on every page, "FORM — 1" heading, 9999999999 printed as a phone.
// Run: node scripts/test-form1-pdf.mjs   (npm run test:form1-pdf)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'src/pages/Form1MemberList.tsx'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

ok(!/[\x00-\x08]/.test(src), 'no control characters in the source');

// 1. natural member-number order
ok(src.includes("a.memberId.localeCompare(b.memberId, 'en', { numeric: true, sensitivity: 'base' })"), 'natural sort in the page');
const ids = ['100', '11', 'M924', '2', '110', '101', 'M925', '13'];
const sorted = [...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
ok(sorted.join() === '2,11,13,100,101,110,M924,M925', `2,11,13,100… not 100,101,11 (got ${sorted})`);

// 2. dummy phones print as —
const fn = src.match(/const realPhone = \(p\?: string\) => \{\n\s*const d = \(p \|\| ''\)\.replace\((\/.+?\/g), ''\);\n\s*return !d \|\| (\/.+?\/)\.test\(d\)/);
ok(!!fn, 'realPhone helper present');
if (fn) {
  const strip = eval(fn[1]), dummy = eval(fn[2]);
  const realPhone = p => { const d = (p || '').replace(strip, ''); return !d || dummy.test(d) ? '—' : p; };
  ok(realPhone('9999999999') === '—' && realPhone('0000000000') === '—' && realPhone('') === '—', 'repeated-digit / empty → —');
  ok(realPhone('09467918545') === '09467918545' && realPhone('98965 84585') === '98965 84585', 'real numbers kept');
}
ok(src.includes('    realPhone(m.phone),'), 'register row uses realPhone');

// 3. grand total only on the last page, right-aligned under its column
ok(src.includes("showFoot: 'lastPage'"), 'total row on the last page only');
ok(src.includes("{ content: totalShareCapital.toLocaleString('en-IN'), styles: { halign: 'right' } }"), 'total right-aligned');

// 4. heading = r.22 register, society name wraps on its own line
ok(!src.includes("doc.text('FORM — 1'") && !src.includes('FORM — 1 : REGISTER'), 'no "FORM — 1" heading');
ok(src.includes("'[Rule 22, Haryana Co-operative Societies Rules, 1989]'") && src.includes('isHaryana(society.state)'), 'Haryana subtitle cites r.22');
ok(src.includes('doc.splitTextToSize(`Society: ${society.name}`, pageW - marginL * 2)') && !src.includes('marginL + 90'), 'name on its own line, no fixed-offset overlap');
ok(src.includes("registerReportIdentity(doc, 'F1', society, 'Register of Members (Rule 22)')"), 'Report ID code F1 unchanged');

console.log(`form1-pdf: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
