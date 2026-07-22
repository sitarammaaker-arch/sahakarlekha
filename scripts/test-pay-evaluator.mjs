// SFL evaluator (Phase-6 §5/§8). Proves number + money arithmetic (paise), the type-safe money
// algebra, percent, comparison/equality, short-circuit and/or/??/if, null-safe access, calls to
// whitelisted functions, and the runtime/type/ref/security refusals. Imports real .ts.
//
// Run: node scripts/test-pay-evaluator.mjs   (npm run test:pay-evaluator)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ex, px, lx;
try {
  ex = await import(abs('../src/lib/pay/formula/evaluator.ts'));
  px = await import(abs('../src/lib/pay/formula/parser.ts'));
  lx = await import(abs('../src/lib/pay/formula/lexer.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { evaluate, makeMoney } = ex;
const { parseExpression } = px;
const { tokenize } = lx;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

const env = {
  vars: {
    basic: makeMoney(100000, 'INR'), // ₹1000.00
    hra: makeMoney(40000, 'INR'),
    usd: makeMoney(100, 'USD'),
    attendance: { paidDays: 30, lopDays: 0 },
    list: [10, 20, 30],
    nothing: null,
  },
  fns: { min: (a, b) => (a < b ? a : b), max: (a, b) => (a > b ? a : b) },
};
const ev = (src, e = env) => evaluate(parseExpression(tokenize(src)), e);
const money = (v, minor, cur = 'INR') => v && v.kind === 'money' && v.minor === minor && v.currency === cur;

// 1. number arithmetic + precedence
ok(ev('1 + 2 * 3') === 7, '1 + 2 * 3 = 7');
ok(ev('(1 + 2) * 3') === 9, '(1 + 2) * 3 = 9');
ok(ev('-5') === -5 && ev('not true') === false, 'unary - and not');

// 2. money arithmetic (paise)
ok(money(ev('basic + hra'), 140000), 'Money + Money → Money (paise added)');
ok(money(ev('basic - hra'), 60000), 'Money - Money → Money');
ok(money(ev('basic * 2'), 200000), 'Money * number → Money');
ok(money(ev('basic / 2'), 50000), 'Money / number → Money');
ok(ev('basic / hra') === 2.5, 'Money / Money → number ratio (2.5)');

// 3. type-safe money algebra
throws(() => ev('basic + 5'), /PAY-DSL-TYPE-010/, 'Money + number refused (no implicit coercion)');
throws(() => ev('basic + usd'), /PAY-DSL-TYPE-011/, 'currency mismatch refused');
throws(() => ev('basic * hra'), /PAY-DSL-TYPE-012/, 'Money * Money refused');

// 4. percent
ok(money(ev('basic * 40%'), 40000), 'Money * 40% → 40% of Money');
ok(ev('100 * 40%') === 40, 'number * 40% → 40');

// 5. comparison / equality
ok(ev('1 < 2') === true && ev('2 <= 2') === true, 'numeric comparison');
ok(ev('basic == basic') === true && ev('basic != hra') === true, 'money equality');
ok(ev('basic > hra') === true, 'money comparison');

// 6. short-circuit (right side would throw if evaluated)
ok(ev('false and unknownVar') === false, "'and' short-circuits (right not evaluated)");
ok(ev('true or unknownVar') === true, "'or' short-circuits");
ok(ev('3 ?? unknownVar') === 3, "'??' short-circuits when left non-null");
ok(ev('nothing ?? 5') === 5, "'??' falls through on null");
ok(ev('if true then 1 else unknownVar') === 1, "'if' does not evaluate the untaken branch");

// 7. member / index / null-safe
ok(ev('attendance.paidDays') === 30, 'member access');
ok(ev('nothing?.x') === null, 'null-safe member on null → null');
throws(() => ev('nothing.x'), /PAY-DSL-RUN-052/, 'non-null-safe member on null refused');
ok(ev('list[1]') === 20, 'index access');

// 8. calls (whitelisted only)
ok(ev('min(3, 5)') === 3 && ev('max(3, 5)') === 5, 'whitelisted function calls');
throws(() => ev('foo(1)'), /PAY-DSL-SEC-060/, 'unknown/non-whitelisted function refused');

// 9. refs + runtime errors
throws(() => ev('unknownVar'), /PAY-DSL-REF-020/, 'unknown variable refused');
throws(() => ev('1 / 0'), /PAY-DSL-RUN-050/, 'divide by zero refused');

// 10. list / map values
ok(JSON.stringify(ev('[1, 2, 3]')) === JSON.stringify([1, 2, 3]), 'list literal evaluates');
ok(JSON.stringify(ev('{ a: 1, b: 2 }')) === JSON.stringify({ a: 1, b: 2 }), 'map literal evaluates');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay evaluator — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
