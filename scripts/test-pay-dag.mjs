// SFL dependency DAG (Phase-6 §7). Proves dependency extraction from the AST (a Call's callee is NOT
// a dependency; bindings are local), topological compilation (dependencies before dependents), and
// cycle detection (PAY-DSL-DEP-CYCLE with the path). This plan is the ExecutionContext's formulaPlan
// slice — the calc kernel's evaluation order. Imports real .ts.
//
// Run: node scripts/test-pay-dag.mjs   (npm run test:pay-dag)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let dg, px, lx;
try {
  dg = await import(abs('../src/lib/pay/formula/dag.ts'));
  px = await import(abs('../src/lib/pay/formula/parser.ts'));
  lx = await import(abs('../src/lib/pay/formula/lexer.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { extractDeps, formulaDeps, compilePlan } = dg;
const { parseExpression, parseFormula } = px;
const { tokenize } = lx;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

const deps = (src) => extractDeps(parseExpression(tokenize(src))).sort();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// index of a name in an order array
const idx = (order, name) => order.indexOf(name);

// 1. dependency extraction from an expression
ok(eq(deps('BASIC * 40%'), ['BASIC']), 'component ref is a dependency');
ok(eq(deps('BASIC + HRA'), ['BASIC', 'HRA']), 'both operands');
ok(eq(deps('da_rate() * BASIC'), ['BASIC']), "a Call's callee (function) is NOT a dependency");
ok(eq(deps('min(A, B)'), ['A', 'B']), 'call arguments ARE dependencies');
ok(eq(deps('attendance.paidDays + BASIC'), ['BASIC', 'attendance']), 'member root is the dependency, not the field');
ok(eq(deps('if flag then A else B'), ['A', 'B', 'flag']), 'if branches + condition');
ok(eq(deps('42'), []), 'a literal has no dependencies');

// 2. formula dependencies exclude local bindings
const f1 = parseFormula(tokenize('formula "GROSS" :: Money let base = BASIC in base + DA'));
ok(eq(formulaDeps(f1).sort(), ['BASIC', 'DA']), 'binding names are local (base excluded); externals kept');
const f2 = parseFormula(tokenize('formula "X" :: Money let a = BASIC let b = a in b + HRA'));
ok(eq(formulaDeps(f2).sort(), ['BASIC', 'HRA']), 'chained bindings: only true externals remain (a references only local + BASIC)');

// 3. topological compilation — dependencies before dependents
const nodes = [
  { name: 'GROSS', deps: ['BASIC', 'DA', 'HRA'] },
  { name: 'DA', deps: ['BASIC'] },
  { name: 'HRA', deps: ['BASIC'] },
  { name: 'NET', deps: ['GROSS', 'PF'] },
  { name: 'PF', deps: ['BASIC'] },
];
const plan = compilePlan(nodes);
ok(plan.order.length === 5, 'all 5 nodes ordered');
ok(idx(plan.order, 'DA') < idx(plan.order, 'GROSS'), 'DA before GROSS');
ok(idx(plan.order, 'HRA') < idx(plan.order, 'GROSS'), 'HRA before GROSS');
ok(idx(plan.order, 'GROSS') < idx(plan.order, 'NET') && idx(plan.order, 'PF') < idx(plan.order, 'NET'), 'GROSS + PF before NET');
ok(eq(plan.deps['NET'], ['GROSS', 'PF']), 'dependency edges preserved in the plan');

// 4. external inputs (BASIC is not a node) do not appear in the order
ok(!plan.order.includes('BASIC'), 'external input BASIC not ordered as a node');

// 5. cycle detection
throws(() => compilePlan([{ name: 'A', deps: ['B'] }, { name: 'B', deps: ['A'] }]), /PAY-DSL-DEP-CYCLE/, 'two-node cycle A↔B detected');
throws(() => compilePlan([{ name: 'A', deps: ['A'] }]), /PAY-DSL-DEP-CYCLE/, 'self-cycle detected');
throws(() => compilePlan([{ name: 'A', deps: ['B'] }, { name: 'B', deps: ['C'] }, { name: 'C', deps: ['A'] }]), /PAY-DSL-DEP-CYCLE/, 'three-node cycle detected');
// the error names the offending path
try { compilePlan([{ name: 'A', deps: ['B'] }, { name: 'B', deps: ['A'] }]); } catch (e) { ok(/A → B → A|B → A → B/.test(e.message), 'cycle error names the path'); }

// 6. duplicate node names rejected
throws(() => compilePlan([{ name: 'A', deps: [] }, { name: 'A', deps: [] }]), /PAY-DSL-DEP-DUP/, 'duplicate node name rejected');

// 7. empty + single-node plans
ok(eq(compilePlan([]).order, []), 'empty plan');
ok(eq(compilePlan([{ name: 'A', deps: ['BASIC'] }]).order, ['A']), 'single node with only external deps');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay dag — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
