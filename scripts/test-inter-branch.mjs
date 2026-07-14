// Inter-branch accounting (ECR-17 Phase 2). Imports the REAL src/lib/interBranch.ts via
// the '@/' loader — so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-inter-branch.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { buildInterBranchTransfer, legsBalanced, controlNet } = await import(abs('../src/lib/interBranch.ts'));

const r2 = (n) => Math.round(n * 100) / 100;
// Net movement of a cash/bank account across both legs (test-only fixture helper).
function acctNet(t, id) { let net = 0; for (const leg of [t.from, t.to]) for (const l of leg.lines) if (l.accountId === id) net += l.type === 'Dr' ? l.amount : -l.amount; return r2(net); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const t = buildInterBranchTransfer({ fromBranchId: 'A', toBranchId: 'B', amount: 5000, fromAccountId: '3301', toAccountId: '3301' });

// 1. From branch: Dr Control / Cr Cash.
ok(t.from.branchId === 'A' && t.from.lines[0].accountId === '2110' && t.from.lines[0].type === 'Dr' && t.from.lines[1].accountId === '3301' && t.from.lines[1].type === 'Cr', 'from leg: Dr Control / Cr Cash, branch A');
// 2. To branch: Dr Cash / Cr Control.
ok(t.to.branchId === 'B' && t.to.lines[0].accountId === '3301' && t.to.lines[0].type === 'Dr' && t.to.lines[1].accountId === '2110' && t.to.lines[1].type === 'Cr', 'to leg: Dr Cash / Cr Control, branch B');
// 3. Each leg balances.
ok(legsBalanced(t), 'each leg balances (Dr = Cr)');
// 4. Control nets to zero consolidated.
ok(controlNet(t) === 0, 'inter-branch control nets to zero');
// 5. Cash nets to zero consolidated (transfer within the society).
ok(acctNet(t, '3301') === 0, 'consolidated cash unchanged (nets to zero)');
// 6. Different modes: from bank, to cash → each account moves but control still nets zero.
const t2 = buildInterBranchTransfer({ fromBranchId: 'A', toBranchId: 'B', amount: 1000, fromAccountId: '3302', toAccountId: '3301' });
ok(controlNet(t2) === 0 && legsBalanced(t2), 'cross-mode transfer: legs balance + control net zero');
ok(acctNet(t2, '3302') === -1000 && acctNet(t2, '3301') === 1000, 'bank −1000, cash +1000 (real movement, total assets unchanged)');
// 7. Rounding.
ok(buildInterBranchTransfer({ fromBranchId: 'A', toBranchId: 'B', amount: 100.005, fromAccountId: 'x', toAccountId: 'x' }).from.lines[0].amount === 100.01, 'amount rounded to paise');

console.log(`\nInter-branch (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
