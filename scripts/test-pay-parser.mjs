// SFL parser + AST (Phase-6 §2/§6). Proves literals, precedence, unary, postfix (member/index/
// call), if (mandatory else), list/map, the formula wrapper, and syntax-error refusals.
// Imports the real .ts via Node 24 type-stripping.
//
// Run: node scripts/test-pay-parser.mjs   (npm run test:pay-parser)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let px, lx;
try {
  px = await import(abs('../src/lib/pay/formula/parser.ts'));
  lx = await import(abs('../src/lib/pay/formula/lexer.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { parseExpression, parseFormula } = px;
const { tokenize } = lx;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };
const ast = (src) => parseExpression(tokenize(src));

// 1. literals
ok(JSON.stringify(ast('12')) === JSON.stringify({ type: 'Literal', litType: 'number', value: 12 }), 'number literal');
ok(ast('40%').litType === 'percent' && ast('40%').value === 40, 'percent literal (value 40)');
ok(ast('"hi"').litType === 'string' && ast('"hi"').value === 'hi', 'string literal');
ok(ast('@2026-04-01').litType === 'date', 'date literal');
ok(ast('30d').litType === 'duration' && ast('30d').value === '30d', 'duration literal');
ok(ast('true').value === true && ast('false').value === false && ast('null').value === null, 'bool/null literals');

// 2. var
ok(JSON.stringify(ast('BASIC')) === JSON.stringify({ type: 'Var', name: 'BASIC' }), 'identifier → Var');

// 3. precedence
let e = ast('1 + 2 * 3');
ok(e.type === 'BinOp' && e.op === '+' && e.right.type === 'BinOp' && e.right.op === '*', '* binds tighter than +');
e = ast('a and b or c');
ok(e.op === 'or' && e.left.type === 'BinOp' && e.left.op === 'and', 'and binds tighter than or');
e = ast('(1 + 2) * 3');
ok(e.op === '*' && e.left.type === 'BinOp' && e.left.op === '+', 'parentheses override precedence');

// 4. unary
ok(ast('-x').type === 'UnOp' && ast('-x').op === '-', 'unary minus');
ok(ast('not b').type === 'UnOp' && ast('not b').op === 'not', 'unary not');

// 5. comparison / equality / coalesce
ok(ast('a == b').op === '==' && ast('x <= y').op === '<=', 'equality + comparison');
ok(ast('a ?? b').op === '??', 'coalesce ??');

// 6. if (mandatory else)
e = ast('if c then a else b');
ok(e.type === 'If' && e.cond.name === 'c' && e.then.name === 'a' && e.else.name === 'b', 'if/then/else → If node');
throws(() => ast('if c then a'), /PAY-DSL-SYN-002/, 'if without else refused (totality)');

// 7. postfix: member / nullSafe / index / call / chain
ok(ast('a.b').type === 'Member' && ast('a.b').nullSafe === false, 'member access');
ok(ast('a?.b').type === 'Member' && ast('a?.b').nullSafe === true, 'null-safe member ?.');
ok(ast('a[0]').type === 'Index', 'index access');
e = ast('f(1, 2)');
ok(e.type === 'Call' && e.args.length === 2, 'call with args');
ok(ast('f()').type === 'Call' && ast('f()').args.length === 0, 'call with no args');
e = ast('min(BASIC * 40%, cap).x');
ok(e.type === 'Member' && e.obj.type === 'Call' && e.obj.callee.name === 'min', 'chained call.member');

// 8. list / map
ok(ast('[1, 2, 3]').type === 'List' && ast('[1, 2, 3]').items.length === 3, 'list literal');
e = ast('{ a: 1, b: 2 }');
ok(e.type === 'Map' && e.pairs.length === 2 && e.pairs[0].key === 'a', 'map literal');

// 9. formula wrapper
const f = parseFormula(tokenize('formula "hra" :: Money let base = BASIC in min(base, cap)'));
ok(f.name === 'hra' && f.annotation === 'Money', 'formula name + return type');
ok(f.bindings.length === 1 && f.bindings[0].name === 'base' && f.bindings[0].expr.name === 'BASIC', 'let binding parsed');
ok(f.body.type === 'Call' && f.body.callee.name === 'min', 'formula body');
const f2 = parseFormula(tokenize('formula "x" :: Money let a :: Decimal = 1 in a'));
ok(f2.bindings[0].annotation === 'Decimal', 'binding type annotation ::');

// 10. syntax errors
throws(() => ast('(1 + 2'), /PAY-DSL-SYN-002/, 'unclosed paren refused');
throws(() => ast('1 2'), /PAY-DSL-SYN-002/, 'trailing token refused');
throws(() => ast('* 2'), /PAY-DSL-SYN-003/, 'leading operator refused');
throws(() => ast('a in [1,2]'), /PAY-DSL-SYN-002/, "'in' membership deferred → rejected cleanly");

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay parser — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
