// Capex approval visibility (ECR-15) — imports the REAL src/lib/capexApproval.ts via the '@/' loader.
// Run: node scripts/test-capex-approval.mjs
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

const { capexPendingAssets } = await import(abs('../src/lib/capexApproval.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const pending = new Set(['v-pending-1', 'v-pending-2']);
const assets = [
  { id: 'a', name: 'New Tractor', acquisitionVoucherId: 'v-pending-1' },   // acquisition pending → flagged
  { id: 'b', name: 'Office PC', acquisitionVoucherId: 'v-approved-9' },    // acquisition approved → not flagged
  { id: 'c', name: 'Opening Building' },                                   // no acquisition voucher (register-only) → not
  { id: 'd', name: 'Archived', acquisitionVoucherId: 'v-pending-2', isDeleted: true }, // archived → excluded
  { id: 'e', name: 'New Van', acquisitionVoucherId: 'v-pending-2' },       // acquisition pending → flagged
];

const res = capexPendingAssets(assets, pending);
ok(res.length === 2, 'exactly 2 pending-capex assets (Tractor, Van)');
ok(res.some(r => r.id === 'a') && res.some(r => r.id === 'e'), 'Tractor + Van flagged');
ok(!res.some(r => ['b', 'c', 'd'].includes(r.id)), 'approved / no-voucher / archived not flagged');
ok(capexPendingAssets([], pending).length === 0, 'empty assets → none');
ok(capexPendingAssets(assets, new Set()).length === 0, 'no pending vouchers → none');
ok(capexPendingAssets(null, pending).length === 0, 'null assets → none');

console.log(`\nCapex approval (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
