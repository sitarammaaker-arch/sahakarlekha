// SFL type checker (Phase-6 §3/§10). Proves the money-safety class is caught at COMPILE time
// (Money+number → TYPE-010 before evaluation), Money*Money/logical/comparison/arg-type rules,
// Unknown permissiveness, and formula annotation checking. Imports real .ts.
//
// Run: node scripts/test-pay-typecheck.mjs   (npm run test:pay-typecheck)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let tc, px, lx;
try {
  tc = await import(abs('../src/lib/pay/formula/typeChecker.ts'));
  px = await import(abs('../src/lib/pay/formula/parser.ts'));
  lx = await import(abs('../src/lib/pay/formula/lexer.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { checkType, checkFormula } = tc;
const { parseExpression, parseFormula } = px;
const { tokenize } = lx;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

const env = {
  vars: { basic: 'Money', hra: 'Money', usd: 'Money', n: 'Number', flag: 'Boolean', attendance: 'Map' },
  fns: { min: { params: ['Number', 'Number'], ret: 'Number' }, roundM: { params: ['Money'], ret: 'Money' } },
};
const ct = (src) => checkType(parseExpression(tokenize(src)), env);

// 1. literal types
ok(ct('1') === 'Number' && ct('40%') === 'Percentage' && ct('"x"') === 'String', 'number/percent/string types');
ok(ct('@2026-04-01') === 'Date' && ct('30d') === 'Duration' && ct('true') === 'Boolean' && ct('null') === 'Null', 'date/duration/bool/null types');
ok(ct('basic') === 'Money' && ct('n') === 'Number', 'variable types from env');

// 2. arithmetic
ok(ct('basic + hra') === 'Money', 'Money + Money → Money');
ok(ct('1 + 2') === 'Number', 'Number + Number → Number');
ok(ct('basic * 2') === 'Money' && ct('basic * 40%') === 'Money', 'Money * Number/Percentage → Money');
ok(ct('basic / hra') === 'Number', 'Money / Money → Number');

// 3. money-safety caught at COMPILE (the flagship)
throws(() => ct('basic + 5'), /PAY-DSL-TYPE-010/, 'Money + number → TYPE-010 at compile time');
throws(() => ct('basic - n'), /PAY-DSL-TYPE-010/, 'Money - number → TYPE-010');
throws(() => ct('basic * hra'), /PAY-DSL-TYPE-012/, 'Money * Money rejected');

// 4. logical / comparison
ok(ct('flag and true') === 'Boolean', 'Boolean and Boolean → Boolean');
throws(() => ct('n and true'), /PAY-DSL-TYPE-013/, 'Number and Boolean rejected');
ok(ct('1 < 2') === 'Boolean' && ct('basic > hra') === 'Boolean', 'numeric + money comparison → Boolean');
throws(() => ct('n < basic'), /PAY-DSL-TYPE-012/, 'Number < Money rejected');

// 5. if / coalesce
ok(ct('if flag then basic else hra') === 'Money', 'if with matching branches → branch type');
ok(ct('if flag then 1 else "x"') === 'Unknown', 'if with differing branches → Unknown');
throws(() => ct('if n then 1 else 2'), /PAY-DSL-TYPE-013/, 'non-Boolean if-condition rejected');
ok(ct('null ?? 5') === 'Number' && ct('basic ?? hra') === 'Money', 'coalesce type');

// 6. Unknown is permissive (member result composes without a false positive)
ok(ct('attendance.paidDays') === 'Unknown', 'member access → Unknown');
ok(ct('attendance.paidDays + 1') === 'Unknown', 'Unknown + Number → Unknown (no false TYPE error)');

// 7. calls
ok(ct('min(1, 2)') === 'Number', 'function return type');
throws(() => ct('min(1)'), /PAY-DSL-TYPE-014/, 'wrong arg count rejected');
throws(() => ct('min(1, basic)'), /PAY-DSL-TYPE-015/, 'wrong arg type (Money for Number) rejected');
throws(() => ct('foo(1)'), /PAY-DSL-SEC-060/, 'unknown function rejected');
ok(ct('roundM(basic)') === 'Money', 'roundM(Money) → Money');

// 8. refs
throws(() => ct('nope'), /PAY-DSL-REF-020/, 'undeclared variable rejected');

// 9. formula annotation
const okF = parseFormula(tokenize('formula "hra" :: Money let x = basic in x * 40%'));
ok(checkFormula(okF, env) === 'Money', 'formula body type matches :: Money annotation');
const badF = parseFormula(tokenize('formula "bad" :: Money let x = 1 in x + 2'));
throws(() => checkFormula(badF, env), /PAY-DSL-TYPE-016/, 'formula body (Number) vs :: Money mismatch rejected');
const bindF = parseFormula(tokenize('formula "b" :: Money let base = basic in base + hra'));
ok(checkFormula(bindF, env) === 'Money', 'later expressions see earlier binding types');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay typecheck — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
