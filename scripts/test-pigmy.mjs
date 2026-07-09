// Pigmy daily collection (Deposits module) — mirrors src/lib/pigmy.ts.
// Run: node scripts/test-pigmy.mjs

function pigmyAgents(accounts) {
  const set = new Set();
  for (const a of accounts || []) {
    if (a.depositType === 'PIGMY' && a.status === 'active' && a.agent?.trim()) set.add(a.agent.trim());
  }
  return [...set].sort();
}
function pigmyAccountsForAgent(accounts, agent) {
  return (accounts || []).filter(a => a.depositType === 'PIGMY' && a.status === 'active' && (a.agent ?? '').trim() === agent);
}
function collectionTotal(amounts) {
  const sum = (amounts || []).reduce((s, a) => { const n = Number(a) || 0; return s + (n > 0 ? n : 0); }, 0);
  return Math.round(sum * 100) / 100;
}

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
