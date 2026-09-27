// Domain account provisioning (RM-05, deferred from RM-01). Imports the REAL
// src/lib/domainAccounts/provisioning.ts and the consumer/dairy resolvers via the '@/' loader.
// Run: node scripts/test-domain-account-provisioning.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
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

const { DOMAIN_ACCOUNT_SPECS, planMissingDomainAccounts, diagnoseDomainAccounts } = await import(abs('../src/lib/domainAccounts/provisioning.ts'));
const C = await import(abs('../src/lib/consumer/accounts.ts'));
const D = await import(abs('../src/lib/dairy/accounts.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const acc = (id, name, extra = {}) => ({ id, name, nameHi: name, type: 'asset', openingBalance: 0, openingBalanceType: 'debit', isGroup: false, ...extra });
const CONSUMER = new Set(['pos_billing']);
const DAIRY = new Set(['dairy_collection']);
const BOTH = new Set(['pos_billing', 'dairy_collection']);
const base = [acc('3301', 'Cash'), acc('3300', 'Current Assets', { isGroup: true })];
const materialise = (specs, prefix) => specs.map((s, i) => ({ ...s.template, id: `${prefix}-${i}` }));

// 1. Catalog = exactly what the removed seeders created (6 consumer + 5 dairy), unique keys.
{
  ok(DOMAIN_ACCOUNT_SPECS.filter(s => s.capability === 'pos_billing').length === 6, '6 consumer specs');
  ok(DOMAIN_ACCOUNT_SPECS.filter(s => s.capability === 'dairy_collection').length === 5, '5 dairy specs');
  ok(new Set(DOMAIN_ACCOUNT_SPECS.map(s => s.key)).size === DOMAIN_ACCOUNT_SPECS.length, 'spec keys unique');
  ok(DOMAIN_ACCOUNT_SPECS.every(s => s.template.openingBalance === 0 && !s.template.isGroup), 'templates: zero opening, ledger (not group)');
}

// 2. Planner is capability-scoped.
{
  ok(planMissingDomainAccounts(base, new Set()).length === 0, 'no capability → nothing planned');
  const c = planMissingDomainAccounts(base, CONSUMER);
  ok(c.length === 6 && c.every(s => s.capability === 'pos_billing'), 'consumer → 6 consumer specs');
  ok(planMissingDomainAccounts(base, DAIRY).length === 5, 'dairy → 5 dairy specs');
  ok(planMissingDomainAccounts(base, BOTH).length === 11, 'both → 11');
}

// 3. Idempotent: every created template is found by its own resolver → a second plan is empty.
{
  const first = planMissingDomainAccounts(base, BOTH);
  const after = [...base, ...materialise(first, 'new')];
  ok(planMissingDomainAccounts(after, BOTH).length === 0, 'after provisioning, nothing left to plan');
  for (const s of DOMAIN_ACCOUNT_SPECS) ok(s.resolve(materialise([s], 'x')) === 'x-0', `resolver finds its own template: ${s.key}`);
}

// 4. A hand-made / renamed / template-id account counts as present (no duplicate created).
{
  const byName = [...base, acc('u1', 'Member Purchase Receivable')];
  ok(!planMissingDomainAccounts(byName, CONSUMER).some(s => s.key === 'consumer.memberReceivable'), 'consumer: exact-name match honoured');
  const bySub = [...base, acc('u2', 'Udhaar Wasuli', { subtype: C.REBATE_PAYABLE_SUBTYPE })];
  ok(!planMissingDomainAccounts(bySub, CONSUMER).some(s => s.key === 'consumer.rebatePayable'), 'consumer: renamed but subtype match honoured');
  const byTplId = [...base, acc(D.DAIRY_ACCOUNT_IDS.bonusPayable, 'Something else')];
  ok(!planMissingDomainAccounts(byTplId, DAIRY).some(s => s.key === 'dairy.bonusPayable'), 'dairy: template id honoured');
  const hindi = [...base, acc('u3', 'x', { nameHi: 'दुग्ध खरीदी लागत' })];
  ok(!planMissingDomainAccounts(hindi, DAIRY).some(s => s.key === 'dairy.milkProcurement'), 'dairy: Hindi name hint honoured');
}

// 5. matches() is the union of the resolver's passes; the resolver's own pick is unchanged.
{
  const chart = [...base, acc('a', 'Member Purchase Receivable'), acc('b', 'X', { subtype: C.MEMBER_RECEIVABLE_SUBTYPE }), acc('g', 'Member Purchase Receivable', { isGroup: true })];
  const spec = DOMAIN_ACCOUNT_SPECS.find(s => s.key === 'consumer.memberReceivable');
  ok(chart.filter(spec.matches).map(a => a.id).join() === 'a,b', 'candidates = name + subtype hits, groups excluded');
  ok(spec.resolve(chart) === 'b', 'resolver still prefers subtype (unchanged)');
  for (const s of DOMAIN_ACCOUNT_SPECS) {
    ok(materialise([s, s], 'd').filter(s.matches).length === 2, `matches() sees both duplicates: ${s.key}`);
  }
}

// 6. Diagnostic — duplicates, resolved pick, voucher counts, postings split; READ-ONLY.
{
  const t = DOMAIN_ACCOUNT_SPECS.find(s => s.key === 'consumer.patronageDistribution').template;
  const chart = [...base, { ...t, id: 'p1' }, { ...t, id: 'p2' }, { ...t, id: 'p3' }];
  const vouchers = [
    { debitAccountId: 'p1', creditAccountId: '3301' },
    { lines: [{ accountId: 'p2' }, { accountId: '3301' }] },
    { debitAccountId: 'p2', creditAccountId: 'p2' },                    // counted once
    { debitAccountId: 'p3', creditAccountId: '3301', isDeleted: true }, // soft-deleted → ignored
  ];
  const snapChart = JSON.stringify(chart), snapV = JSON.stringify(vouchers);
  const rows = diagnoseDomainAccounts(chart, vouchers, CONSUMER);
  ok(JSON.stringify(chart) === snapChart && JSON.stringify(vouchers) === snapV, 'diagnostic does not mutate input');
  const r = rows.find(x => x.key === 'consumer.patronageDistribution');
  ok(r.status === 'duplicate' && r.candidates.length === 3, 'three seeded copies → duplicate');
  const resolved = r.candidates.filter(c => c.isResolved);
  ok(resolved.length === 1 && resolved[0].id === 'p1', 'exactly one resolved (first match, as the resolver does)');
  const cnt = Object.fromEntries(r.candidates.map(c => [c.id, c.liveVoucherCount]));
  ok(cnt.p1 === 1 && cnt.p2 === 2 && cnt.p3 === 0, 'live voucher counts (once per voucher, deleted ignored)');
  ok(r.postingsSplit === true, 'postings split across p1 and p2');
  ok(rows.find(x => x.key === 'consumer.memberReceivable').status === 'missing', 'missing role reported');
  ok(rows.every(x => x.capability === 'pos_billing'), 'dairy rows omitted when not required and absent');
  ok(rows.filter(x => x.status === 'duplicate').length === 1, 'only the duplicated role flagged');
}

// 7. Diagnostic shows a role that has accounts even when the capability is off.
{
  const t = DOMAIN_ACCOUNT_SPECS.find(s => s.key === 'dairy.bonusPayable').template;
  const rows = diagnoseDomainAccounts([...base, { ...t, id: 'bp' }], [], new Set());
  ok(rows.length === 1 && rows[0].key === 'dairy.bonusPayable' && rows[0].required === false && rows[0].status === 'ok', 'capability off but account present → shown, not required');
}

// 8. Static: no load-time account seeding left in the domain contexts.
{
  for (const f of ['ConsumerDataContext.tsx', 'DairyDataContext.tsx']) {
    const src = readFileSync(pathResolve(SRC, 'contexts', f), 'utf8');
    ok(!/seededRef/.test(src), `${f}: seededRef removed`);
    const effects = src.split('useEffect(').slice(1).map(b => b.slice(0, b.indexOf('}, [')));
    ok(effects.every(b => !/addAccount\s*\(/.test(b)), `${f}: no useEffect calls addAccount`);
  }
  const dairy = readFileSync(pathResolve(SRC, 'contexts', 'DairyDataContext.tsx'), 'utf8');
  ok(!/addAccount\s*\(/.test(dairy), 'DairyDataContext no longer calls addAccount at all');
}

// 9. Static: the provisioning hook re-reads the DB, guards FY-lock/permission, and locks in-flight.
{
  const hook = readFileSync(pathResolve(SRC, 'hooks', 'useDomainAccountProvisioning.ts'), 'utf8');
  ok(/fetchAllPaged<LedgerAccount>\('accounts'/.test(hook), 'hook plans against a fresh DB read');
  ok(/society\.fyLocked/.test(hook), 'hook: FY-lock guard (RULE 6)');
  ok(/can\('config'\)/.test(hook) && /isSuperAdmin/.test(hook), 'hook: permission + super-admin guard');
  ok(/inFlight\.current/.test(hook), 'hook: in-flight lock');
  const iErr = hook.indexOf('if (error)'), iAdd = hook.indexOf('addAccount(spec.template)');
  ok(iErr > 0 && iAdd > iErr, 'hook: DB read error bails before any addAccount');
}

console.log(`domain-account-provisioning: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
