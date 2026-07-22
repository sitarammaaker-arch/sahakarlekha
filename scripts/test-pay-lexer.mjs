// SFL lexer (Phase-6 §2). Proves tokenization of numbers/percent/duration/date/string/idents/
// keywords/operators/punct, comment + whitespace skipping, and syntax-error refusals. Imports the
// real .ts via Node 24 type-stripping.
//
// Run: node scripts/test-pay-lexer.mjs   (npm run test:pay-lexer)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/pay/formula/lexer.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { tokenize, KEYWORDS } = m;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };
// tokens without eof, as "kind:value"
const kv = (src) => tokenize(src).filter((t) => t.kind !== 'eof').map((t) => `${t.kind}:${t.value}`);
const kinds = (src) => tokenize(src).map((t) => t.kind);

// 1. numbers / percent / duration
ok(JSON.stringify(kv('12 12.5')) === JSON.stringify(['number:12', 'number:12.5']), 'integers + decimals');
ok(JSON.stringify(kv('40%')) === JSON.stringify(['percent:40']), 'percent literal');
ok(JSON.stringify(kv('30d 3m 2y')) === JSON.stringify(['duration:30d', 'duration:3m', 'duration:2y']), 'duration literals');
ok(JSON.stringify(kv('30days')) === JSON.stringify(['number:30', 'ident:days']), "30days → number + ident (not a duration)");

// 2. date + string
ok(JSON.stringify(kv('@2026-04-01')) === JSON.stringify(['date:2026-04-01']), 'date literal (@ stripped)');
ok(JSON.stringify(kv('"hi" \'x\'')) === JSON.stringify(['string:hi', 'string:x']), 'double + single quoted strings');

// 3. identifiers, keywords, member access
ok(JSON.stringify(kv('BASIC attendance')) === JSON.stringify(['ident:BASIC', 'ident:attendance']), 'identifiers');
ok(JSON.stringify(kv('attendance.paidDays')) === JSON.stringify(['ident:attendance', 'punct:.', 'ident:paidDays']), 'member access → ident . ident');
for (const k of ['formula', 'let', 'in', 'if', 'then', 'else', 'and', 'or', 'not', 'null', 'true', 'false']) {
  ok(tokenize(k)[0].kind === 'keyword', `keyword: ${k}`);
}
ok(KEYWORDS.has('let') && !KEYWORDS.has('BASIC'), 'KEYWORDS set');

// 4. operators + the = and :: fix
ok(JSON.stringify(kv('== != <= >= ?? ?. .. ::')) === JSON.stringify(['op:==', 'op:!=', 'op:<=', 'op:>=', 'op:??', 'op:?.', 'op:..', 'op:::']), 'multi-char operators (incl. ::)');
ok(JSON.stringify(kv('+ - * / < >')) === JSON.stringify(['op:+', 'op:-', 'op:*', 'op:/', 'op:<', 'op:>']), 'single-char operators');
ok(JSON.stringify(kv('let x = 1')) === JSON.stringify(['keyword:let', 'ident:x', 'punct:=', 'number:1']), "binding '=' tokenizes");
ok(JSON.stringify(kv('x :: Money')) === JSON.stringify(['ident:x', 'op:::', 'ident:Money']), 'type annotation ::');

// 5. punctuation + a fuller expression
ok(JSON.stringify(kv('( ) [ ] { } , :')) === JSON.stringify(['punct:(', 'punct:)', 'punct:[', 'punct:]', 'punct:{', 'punct:}', 'punct:,', 'punct::']), 'punctuation');
ok(JSON.stringify(kv('min(BASIC * 40%, cap)')) ===
   JSON.stringify(['ident:min', 'punct:(', 'ident:BASIC', 'op:*', 'percent:40', 'punct:,', 'ident:cap', 'punct:)']), 'a fuller expression');

// 6. comments + whitespace skipped; range '..' vs member '.'
ok(JSON.stringify(kv('1  # this is ignored\n + 2')) === JSON.stringify(['number:1', 'op:+', 'number:2']), 'line comment + whitespace skipped');
ok(JSON.stringify(kv('1..10')) === JSON.stringify(['number:1', 'op:..', 'number:10']), "range '..' beats member '.'");

// 7. eof + errors
ok(kinds('1')[kinds('1').length - 1] === 'eof', 'stream ends with eof');
throws(() => tokenize('1 $ 2'), /PAY-DSL-SYN-001/, "unknown character '$' refused");
throws(() => tokenize('"unterminated'), /PAY-DSL-SYN-004/, 'unterminated string refused');
throws(() => tokenize('@'), /PAY-DSL-SYN-001/, "bare '@' refused");

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay lexer — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
