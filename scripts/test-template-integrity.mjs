// Template integrity across EVERY shipped society chart (CMS / PACS / Consumer / Dairy / Housing / Sugar,
// and the labour / other fallbacks), checked on the chart a society actually ends up with
// (template + migrateAccounts). Complements test-chart-integrity.mjs (which pins 4101/5101/3104 only).
//
// Rules checked per chart:
//   unique-id        no id appears twice
//   parent-exists    every parentId points at an account in the chart
//   parent-group     a parent is a group, never a leaf
//   class-parent     a child has the same type (asset/liability/…) as its parent
//   group-children   every group has at least one child
//   normal-balance   openingBalanceType matches the type's natural side, unless a contra subtype
//   core-ids         ACCOUNT_IDS (cash, bank, share capital, admission fee, tds/tcs) exist, are leaves, right type
//   engine-ids       ids the posting engines write to exist with the type they expect
// Cross-chart rule:
//   id-meaning       the same id must not silently mean different things in different charts
//   id-type          the same id must not have a different TYPE in different charts
//
// BASELINE: this test changes no chart. Violations that exist today are listed in KNOWN below so that the
// test fails only on NEW ones (a new template edit that breaks a rule). When a chart is fixed, delete its
// KNOWN line — a KNOWN line that no longer occurs is reported as STALE and also fails, so the list stays honest.
//
// Run:            node scripts/test-template-integrity.mjs
// Regenerate:     node scripts/test-template-integrity.mjs --print   (prints the current violations; review before pasting)
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const S = await import(pathToFileURL(path.join(SRC, 'lib/storage.ts')).href);

const PRINT = process.argv.includes('--print');

// ── Violations that exist today (baseline). Format: `<chart>|<rule>|<detail>` or `*|<rule>|<detail>` ──
const KNOWN = [
  "*|id-meaning|3303-01",   // housing: "Maintenance Receivable — General" (the catch-all under its 3303 head), elsewhere "Sundry Debtors — General"
  "*|id-meaning|1202",
  "*|id-meaning|1204",
  "*|id-meaning|1207",
  "*|id-meaning|1209",
  "*|id-meaning|1210",
  "*|id-meaning|2102",
  "*|id-meaning|2106",
  "*|id-meaning|2107",
  "*|id-meaning|2108",
  "*|id-meaning|2205",
  "*|id-meaning|2207",
  "*|id-meaning|2300",
  "*|id-meaning|2301",
  "*|id-meaning|2304",
  "*|id-meaning|3104",
  "*|id-meaning|3105",
  "*|id-meaning|3106",
  "*|id-meaning|3107",
  "*|id-meaning|3109",
  "*|id-meaning|3110",
  "*|id-meaning|3111",
  "*|id-meaning|3201",
  "*|id-meaning|3202",
  "*|id-meaning|3208",
  "*|id-meaning|3303",
  "*|id-meaning|3304",
  "*|id-meaning|3305",
  "*|id-meaning|3312",
  "*|id-meaning|3316",
  "*|id-meaning|3401",
  "*|id-meaning|3402",
  "*|id-meaning|3403",
  "*|id-meaning|3404",
  "*|id-meaning|3405",
  "*|id-meaning|3406",
  "*|id-meaning|4100",
  "*|id-meaning|4101",
  "*|id-meaning|4102",
  "*|id-meaning|4103",
  "*|id-meaning|4104",
  "*|id-meaning|4105",
  "*|id-meaning|4106",
  "*|id-meaning|4200",
  "*|id-meaning|4201",
  "*|id-meaning|4202",
  "*|id-meaning|4207",
  "*|id-meaning|4301",
  "*|id-meaning|4302",
  "*|id-meaning|4303",
  "*|id-meaning|4400",
  "*|id-meaning|4401",
  "*|id-meaning|4402",
  "*|id-meaning|4403",
  "*|id-meaning|4405",
  "*|id-meaning|5101",
  "*|id-meaning|5102",
  "*|id-meaning|5103",
  "*|id-meaning|5104",
  "*|id-meaning|5105",
  "*|id-meaning|5106",
  "*|id-meaning|5107",
  "*|id-meaning|5108",
  "*|id-meaning|5206",
  "*|id-meaning|5301",
  "*|id-meaning|5302",
  "*|id-meaning|5303",
  "*|id-meaning|5305",
  "*|id-meaning|5306",
  "*|id-meaning|5401",
  "*|id-meaning|5402",
  "*|id-meaning|5404",
  "*|id-meaning|5501",
  "*|id-meaning|5502",
  "*|id-meaning|5503",
  "*|id-meaning|5504",
  "*|id-meaning|5601",
  "dairy|normal-balance|1210(equity/debit)",
  "housing|engine-ids|3403 missing",
];

// Types whose natural opening side is debit; the rest are credit.
const DEBIT_TYPES = new Set(['asset', 'expense']);
// Contra subtypes: allowed to sit on the opposite side to their type.
const CONTRA_SUBTYPES = new Set(['accumulated_dep', 'closing_stock', 'sales_return', 'dividend_distribution', 'patronage_distribution']);
// Contra heads that are intentionally on the opposite side (documented in storage.ts): accumulated depreciation 3108-3112,
// Dividend Distribution 1211 and Patronage Rebate (Appropriation) 4406 are debit-nature equity / credit-nature assets.
// Some templates (dairy / housing / sugar) ship them without a subtype, so they are allowed by id as well.
const CONTRA_IDS = new Set(['3108', '3109', '3110', '3111', '3112', '1211', '4406']);

// Ids the posting engines write to, with the type they expect (src: DataContext / loans / deposits / tax / payroll / close).
const ENGINE_IDS = {
  '3301': 'asset', '3302': 'asset', '1102': 'equity', '4407': 'income', '3307': 'asset',
  '3310': 'asset', '2201': 'liability', '2202': 'liability', '2103': 'liability', '5201': 'expense',
  '2203': 'liability', '2204': 'liability', '2207': 'liability', '2109': 'liability',
  '4101': 'income', '5101': 'expense', '3403': 'asset', '5150': 'expense', '1208': 'equity',
  '1201': 'equity', '1203': 'equity', '1211': 'equity', '3304': 'asset', '4408': 'income', '3313': 'asset',
  '2107': 'liability', '2108': 'liability', '5604': 'expense', '9999': 'liability', '2101': 'liability', '3303': 'asset',
  '4410': 'income', '5406': 'expense',
  '3104': 'asset', '3105': 'asset', '5503': 'expense', '5504': 'expense', '5505': 'expense', '3108': 'asset', '3112': 'asset',
};
// The three PARTY heads are GROUPS in a current chart (every bank / supplier / customer ledger hangs under
// them) and are postable only through their catch-all child — so an engine id that is one of them is valid when
// it is a group WITH that child (same type, directly under it), and still a violation when it is a bare group.
const PARTY_CATCH_ALL = { '3302': '3302-01', '2101': '2101-01', '3303': '3303-01' };
const CORE_IDS = { CASH: 'asset', BANK: 'asset', SHARE_CAP: 'equity', ADM_FEE: 'income', TAX_CREDIT: 'asset' };

const violations = new Set();
const add = (chart, rule, detail) => violations.add(`${chart}|${rule}|${detail}`);

const charts = {};
for (const [type, tpl] of Object.entries(S.SOCIETY_TEMPLATES)) {
  charts[type] = S.migrateAccounts(tpl.map((a) => ({ ...a }))).accounts;
}
// labour / other share the CMS array: check the shared array once, under one name, so the baseline has no twin lines.
const SHARED_WITH_CMS = new Set(Object.entries(S.SOCIETY_TEMPLATES).filter(([t, tpl]) => t !== 'marketing_processing' && tpl === S.SOCIETY_TEMPLATES.marketing_processing).map(([t]) => t));

for (const [type, accounts] of Object.entries(charts)) {
  if (SHARED_WITH_CMS.has(type)) continue;
  const chart = type;
  const byId = new Map();
  for (const a of accounts) {
    if (byId.has(a.id)) add(chart, 'unique-id', a.id);
    byId.set(a.id, a);
  }
  const childCount = new Map();
  for (const a of accounts) {
    if (!a.parentId) continue;
    childCount.set(a.parentId, (childCount.get(a.parentId) ?? 0) + 1);
    const p = byId.get(a.parentId);
    if (!p) { add(chart, 'parent-exists', `${a.id}->${a.parentId}`); continue; }
    if (!p.isGroup) add(chart, 'parent-group', `${a.id}->${a.parentId}(leaf)`);
    if (p.type !== a.type) add(chart, 'class-parent', `${a.id}(${a.type})->${a.parentId}(${p.type})`);
  }
  for (const a of accounts) {
    if (a.isGroup && !childCount.get(a.id)) add(chart, 'group-children', a.id);
    if (!a.isGroup) {
      const natural = DEBIT_TYPES.has(a.type) ? 'debit' : 'credit';
      if (a.openingBalanceType !== natural && !CONTRA_SUBTYPES.has(a.subtype) && !CONTRA_IDS.has(a.id)) add(chart, 'normal-balance', `${a.id}(${a.type}/${a.openingBalanceType})`);
    }
  }
  const hasCatchAll = (id) => {
    const head = byId.get(id), child = byId.get(PARTY_CATCH_ALL[id]);
    return !!(head && child && PARTY_CATCH_ALL[id] && !child.isGroup && child.parentId === id && child.type === head.type);
  };
  for (const [key, expected] of Object.entries(CORE_IDS)) {
    const id = S.ACCOUNT_IDS[key];
    const a = byId.get(id);
    if (!a) add(chart, 'core-ids', `${key}=${id} missing`);
    else if ((a.isGroup && !hasCatchAll(id)) || a.type !== expected) add(chart, 'core-ids', `${key}=${id} is ${a.isGroup ? 'group' : a.type}, expected ${expected}`);
  }
  for (const [id, expected] of Object.entries(ENGINE_IDS)) {
    const a = byId.get(id);
    if (!a) add(chart, 'engine-ids', `${id} missing`);
    else if ((a.isGroup && !hasCatchAll(id)) || a.type !== expected) add(chart, 'engine-ids', `${id} is ${a.isGroup ? 'group' : a.type}, expected ${expected}`);
  }
}

// Cross-chart: same id, different meaning / type.
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const seen = new Map(); // id -> Map(normName -> Set(charts)), plus types
for (const [type, accounts] of Object.entries(charts)) {
  if (SHARED_WITH_CMS.has(type)) continue;
  for (const a of accounts) {
    if (!seen.has(a.id)) seen.set(a.id, { names: new Map(), types: new Map() });
    const e = seen.get(a.id);
    const n = norm(a.name);
    if (!e.names.has(n)) e.names.set(n, new Set());
    e.names.get(n).add(type);
    if (!e.types.has(a.type)) e.types.set(a.type, new Set());
    e.types.get(a.type).add(type);
  }
}
for (const [id, e] of seen) {
  if (e.names.size > 1) add('*', 'id-meaning', id);
  if (e.types.size > 1) add('*', 'id-type', id);
}

const current = [...violations].sort();
if (PRINT) {
  console.log(current.map((v) => `  ${JSON.stringify(v)},`).join('\n'));
  console.log(`// ${current.length} violations across ${Object.keys(charts).length - SHARED_WITH_CMS.size} charts`);
  process.exit(0);
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const known = new Set(KNOWN);
const fresh = current.filter((v) => !known.has(v));
const stale = KNOWN.filter((v) => !violations.has(v));
ok(fresh.length === 0, `no NEW template violations (${fresh.length}):\n      ${fresh.join('\n      ')}`);
ok(stale.length === 0, `no STALE baseline lines — a fixed violation must be deleted from KNOWN (${stale.length}):\n      ${stale.join('\n      ')}`);
ok(new Set(KNOWN).size === KNOWN.length, 'KNOWN has no duplicate lines');
ok(Object.keys(charts).length === 8, `8 society types resolve to a chart (${Object.keys(charts).join(', ')})`);
ok(Object.values(charts).every((c) => c.length > 90), 'every chart has more than 90 accounts');

console.log(`template integrity: ${pass} passed, ${fail} failed (baseline ${KNOWN.length} known violations)`);
process.exitCode = fail ? 1 : 0;   // not process.exit(): it races the register() loader worker on Windows (#670)
