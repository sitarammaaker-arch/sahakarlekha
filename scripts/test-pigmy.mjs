// Pigmy daily collection (Deposits module). Imports the REAL src/lib/pigmy.ts via the '@/'
// loader — so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-pigmy.mjs
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

const { pigmyAgents, pigmyAccountsForAgent, collectionTotal } = await import(abs('../src/lib/pigmy.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const accts = [
  { id: '1', depositType: 'PIGMY', status: 'active', agent: 'Ravi' },
  { id: '2', depositType: 'PIGMY', status: 'active', agent: 'Ravi' },
  { id: '3', depositType: 'PIGMY', status: 'active', agent: 'Sita' },
  { id: '4', depositType: 'PIGMY', status: 'closed', agent: 'Ravi' },   // closed → excluded
  { id: '5', depositType: 'SB',    status: 'active', agent: 'Ravi' },   // not pigmy → excluded
  { id: '6', depositType: 'PIGMY', status: 'active', agent: '' },       // no agent → excluded
];

// 1. Agents: distinct active-pigmy agents, sorted, dedup, excludes closed/non-pigmy/blank.
ok(JSON.stringify(pigmyAgents(accts)) === JSON.stringify(['Ravi', 'Sita']), 'agents = [Ravi, Sita]');
ok(pigmyAgents([]).length === 0, 'no accounts → no agents');

// 2. Accounts for an agent: only that agent's active pigmy accounts.
ok(pigmyAccountsForAgent(accts, 'Ravi').map(a => a.id).join(',') === '1,2', "Ravi's active pigmy = [1,2] (closed 4 excluded)");
ok(pigmyAccountsForAgent(accts, 'Sita').map(a => a.id).join(',') === '3', "Sita's = [3]");
ok(pigmyAccountsForAgent(accts, 'Unknown').length === 0, 'unknown agent → none');

// 3. Collection total: sums positive entries, ignores blank/zero/negative.
ok(collectionTotal(['100', '50', '']) === 150, 'sums positive, ignores blank');
ok(collectionTotal([100, 0, -20, undefined, '25']) === 125, 'ignores zero/negative/undefined');
ok(collectionTotal([]) === 0, 'empty batch = 0');
ok(collectionTotal(['10.10', '10.15']) === 20.25, 'rounds to 2dp');

console.log(`\nPigmy (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
