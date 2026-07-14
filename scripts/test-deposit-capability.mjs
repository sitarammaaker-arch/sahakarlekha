// Deposit-module capability gating (T-13 / CAP-1) — imports the REAL navigation libs via the '@/'
// loader and proves the deposits module gates on `deposit_ledger` (its own capability), NOT the
// borrowed `lending`. Empty-diff across the 11 default type templates was proven at ship time (same
// set holds both caps); this suite guards the SEMANTICS so the two capabilities can diverge safely.
// Run: node scripts/test-deposit-capability.mjs
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

const { MODULE_CATALOG } = await import(abs('../src/lib/navigation/moduleCatalog.ts'));
const { isModuleVisible } = await import(abs('../src/lib/navigation/navVisibility.ts'));
const { resolveCapabilities } = await import(abs('../src/lib/navigation/capabilityResolver.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const deposits = MODULE_CATALOG.find((m) => m.id === 'deposits');
const ctx = (societyType, rows = []) => ({
  societyType,
  capabilities: resolveCapabilities(societyType, rows, undefined, undefined),
  hasRole: () => true,
  superAdminShowAll: false,
});
const grant = (capability) => [{ capability, mode: 'grant', source: 'plan' }];

// 1. The module gates on its OWN capability now, not the borrowed 'lending'.
ok(!!deposits, 'deposits module exists in the catalog');
ok(JSON.stringify(deposits.requiredCapabilities) === JSON.stringify(['deposit_ledger']), 'deposits requires exactly [deposit_ledger] (not [lending])');

// 2. A society entitled to deposit_ledger by its type template sees the module; one not entitled doesn't.
ok(isModuleVisible(deposits, ctx('pacs')), 'PACS (template has deposit_ledger) sees deposits');
ok(!isModuleVisible(deposits, ctx('dairy')), 'dairy (template lacks deposit_ledger) does not see deposits');

// 3. THE FIX'S VALUE — a deposit-only entitlement (deposit_ledger granted, no lending) now shows the
//    module. Under the old [lending] gating it would have been wrongly hidden.
ok(isModuleVisible(deposits, ctx('dairy', grant('deposit_ledger'))), 'dairy + deposit_ledger grant → deposits visible (was hidden under lending-gating)');

// 4. CORRECTNESS the other way — a lending-only entitlement no longer leaks the deposits module
//    (a credit society without deposits should not see a deposits register).
ok(!isModuleVisible(deposits, ctx('housing', grant('lending'))), 'housing + lending grant (no deposit_ledger) → deposits NOT visible');

// 5. Empty-diff basis (informational guard): across all 11 default templates, the set of types that
//    see /deposits is unchanged from the old lending-gating. A divergence here means a template
//    deliberately split the two caps — expected once deposits and credit are modelled independently.
const TYPES = ['marketing_processing','pacs','consumer','labour','dairy','housing','sugar','producer','multistate','multipurpose','other'];
const shipTimeParity = TYPES.every((t) => {
  const caps = resolveCapabilities(t, [], undefined, undefined);
  return caps.has('deposit_ledger') === caps.has('lending');
});
ok(shipTimeParity, 'ship-time empty-diff: every default template holds deposit_ledger iff it holds lending');

console.log(`\nDeposit capability gating (T-13): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
