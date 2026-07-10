// Export Registry descriptor schema (T-05) — mirrors the PURE logic of
// src/lib/export/registry.types.ts, as scripts/test-nav.mjs mirrors navVisibility.
// Run: node scripts/test-export-registry.mjs   (npm run test:export-registry)
//
// This guards the four invariants the whole data-portability subsystem rests on:
//   1. minRole is compared by RANK, never by string literal (survives ECR-06's 17 roles).
//   2. The dependsOn graph is acyclic — a cycle must be detected, not silently ordered.
//   3. topoOrder puts dependencies before dependents (restore insert order).
//   4. Custody policy invariants: derived⇒replay, evidence⇒sidecar, exclude⇒not exportable.

// ── Mirror of src/lib/export/registry.types.ts ────────────────────────────────
const ROLE_RANK = { viewer: 0, accountant: 1, admin: 2 };

function roleAtLeast(actual, required) {
  const a = ROLE_RANK[actual], r = ROLE_RANK[required];
  if (a === undefined || r === undefined) return false;   // fail closed
  return a >= r;
}

function findCycle(entities) {
  const deps = new Map(entities.map(e => [e.key, e.dependsOn]));
  const state = new Map();
  const path = [];
  const visit = (key) => {
    if (state.get(key) === 'done') return null;
    if (state.get(key) === 'visiting') return [...path.slice(path.indexOf(key)), key];
    state.set(key, 'visiting');
    path.push(key);
    for (const dep of deps.get(key) ?? []) {
      if (!deps.has(dep)) continue;
      const c = visit(dep);
      if (c) return c;
    }
    path.pop();
    state.set(key, 'done');
    return null;
  };
  for (const e of entities) { const c = visit(e.key); if (c) return c; }
  return null;
}

function topoOrder(entities) {
  const cycle = findCycle(entities);
  if (cycle) throw new Error(`Export registry has a dependency cycle: ${cycle.join(' → ')}`);
  const deps = new Map(entities.map(e => [e.key, e.dependsOn]));
  const seen = new Set();
  const order = [];
  const visit = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const dep of deps.get(key) ?? []) if (deps.has(dep)) visit(dep);
    order.push(key);
  };
  for (const e of entities) visit(e.key);
  return order;
}

const BACKUP_POLICIES = ['full', 'replay', 'sidecar', 'exclude'];

function validateRegistry(entities) {
  const problems = [];
  const push = (entity, problem) => problems.push({ entity, problem });
  const keys = new Set(), tables = new Set();

  for (const e of entities) {
    if (keys.has(e.key)) push(e.key, 'duplicate entity key');
    keys.add(e.key);
    if (tables.has(e.table)) push(e.key, `duplicate table "${e.table}" — declared by another entity`);
    tables.add(e.table);

    if (!BACKUP_POLICIES.includes(e.backupPolicy)) push(e.key, `unknown backupPolicy "${e.backupPolicy}"`);
    if (ROLE_RANK[e.minRole] === undefined) push(e.key, `unknown minRole "${e.minRole}"`);
    if (e.columns.length === 0) push(e.key, 'no columns declared');
    if (e.naturalKey.length === 0) push(e.key, 'no naturalKey declared (needed for merge-restore)');

    const colKeys = new Set();
    for (const c of e.columns) {
      if (colKeys.has(c.key)) push(e.key, `duplicate column "${c.key}"`);
      colKeys.add(c.key);
    }
    for (const nk of e.naturalKey) if (!colKeys.has(nk)) push(e.key, `naturalKey "${nk}" is not a declared column`);
    if (e.softDeleteField && !colKeys.has(e.softDeleteField)) push(e.key, `softDeleteField "${e.softDeleteField}" is not a declared column`);

    if (e.backupPolicy === 'exclude' && e.formats.length > 0) push(e.key, 'backupPolicy "exclude" but formats are declared — it would be exportable');
    if (e.nature === 'evidence' && e.backupPolicy !== 'sidecar') push(e.key, 'nature "evidence" must carry backupPolicy "sidecar"');
    if (e.nature === 'derived' && e.backupPolicy !== 'replay') push(e.key, 'nature "derived" must carry backupPolicy "replay"');
    if (e.pdfGenerator && !e.formats.includes('pdf')) push(e.key, 'pdfGenerator declared but "pdf" is not in formats');
  }

  for (const e of entities) {
    for (const dep of e.dependsOn) {
      if (dep === e.key) push(e.key, 'depends on itself');
      else if (!keys.has(dep)) push(e.key, `dependsOn "${dep}" is not a declared entity`);
    }
  }

  const cycle = findCycle(entities);
  if (cycle) push(cycle[0], `dependency cycle: ${cycle.join(' → ')}`);
  return problems;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const col = (key, over = {}) => ({ key, header: key, headerHi: key, type: 'string', piiClass: 'none', defaultVisible: true, ...over });

/** A minimal valid entity; override any field to build a failing case. */
const ent = (key, over = {}) => ({
  key, table: over.table ?? key, domain: 'core', label: key, labelHi: key,
  minRole: 'viewer', columns: [col('id'), col('name')], scope: 'society',
  nature: 'master', dependsOn: [], naturalKey: ['id'], formats: ['csv'],
  backupPolicy: 'full', ...over,
});

// ── 1. roleAtLeast: rank comparison, fail-closed ──────────────────────────────
ok(roleAtLeast('admin', 'viewer'), 'admin meets viewer');
ok(roleAtLeast('accountant', 'accountant'), 'equal rank passes');
ok(!roleAtLeast('viewer', 'accountant'), 'viewer does not meet accountant');
ok(!roleAtLeast('viewer', 'admin'), 'viewer does not meet admin');
// The ECR-06 guard: an unrecognised role must be DENIED, never allowed through.
ok(!roleAtLeast('auditor', 'viewer'), 'unknown role fails closed (does not meet even viewer)');
ok(!roleAtLeast('admin', 'superadmin'), 'unknown required role fails closed');
ok(Object.keys(ROLE_RANK).length === 3, 'ROLE_RANK is the single place role order is encoded');

// ── 2. Cycle detection ────────────────────────────────────────────────────────
ok(findCycle([ent('a'), ent('b', { dependsOn: ['a'] })]) === null, 'acyclic graph → no cycle');

const selfLoop = [ent('a', { dependsOn: ['a'] })];
ok(findCycle(selfLoop) !== null, 'self-dependency is a cycle');

const twoCycle = [ent('a', { dependsOn: ['b'] }), ent('b', { dependsOn: ['a'] })];
const c2 = findCycle(twoCycle);
ok(c2 !== null && c2.length >= 2, 'a → b → a detected');

const threeCycle = [ent('a', { dependsOn: ['b'] }), ent('b', { dependsOn: ['c'] }), ent('c', { dependsOn: ['a'] })];
const c3 = findCycle(threeCycle);
ok(c3 !== null, 'a → b → c → a detected');
// Guard the deref: if findCycle regresses to null this must report a failure, not crash.
ok(c3 !== null && c3[0] === c3[c3.length - 1], 'reported cycle path starts and ends on the same entity');

// A diamond is NOT a cycle — the naive "already visited" check would wrongly flag it.
const diamond = [ent('a'), ent('b', { dependsOn: ['a'] }), ent('c', { dependsOn: ['a'] }), ent('d', { dependsOn: ['b', 'c'] })];
ok(findCycle(diamond) === null, 'diamond dependency is not a cycle');

// Unknown deps are ignored by findCycle (validateRegistry reports them separately).
ok(findCycle([ent('a', { dependsOn: ['ghost'] })]) === null, 'unresolved dep does not crash cycle detection');

// ── 3. topoOrder: dependencies first ──────────────────────────────────────────
const order = topoOrder(diamond);
ok(order.indexOf('a') < order.indexOf('b'), 'dependency a precedes dependent b');
ok(order.indexOf('b') < order.indexOf('d') && order.indexOf('c') < order.indexOf('d'), 'both parents precede d');
ok(order.length === 4 && new Set(order).size === 4, 'every entity appears exactly once');

// Declaration order must not change the result's validity.
const reversed = topoOrder([...diamond].reverse());
ok(reversed.indexOf('a') < reversed.indexOf('d'), 'order is dependency-driven, not declaration-driven');

let threw = false;
try { topoOrder(twoCycle); } catch { threw = true; }
ok(threw, 'topoOrder THROWS on a cycle rather than emitting a plausible-but-wrong order');

// ── 4. validateRegistry: structural invariants ────────────────────────────────
ok(validateRegistry([ent('a'), ent('b', { dependsOn: ['a'] })]).length === 0, 'a valid registry reports no problems');

const has = (problems, needle) => problems.some(p => p.problem.includes(needle));

ok(has(validateRegistry([ent('a'), ent('a')]), 'duplicate entity key'), 'duplicate key caught');
ok(has(validateRegistry([ent('a'), ent('b', { table: 'a' })]), 'duplicate table'), 'two entities on one table caught');
ok(has(validateRegistry([ent('a', { dependsOn: ['ghost'] })]), 'is not a declared entity'), 'unresolved dependsOn caught');
ok(has(validateRegistry([ent('a', { dependsOn: ['a'] })]), 'depends on itself'), 'self-dependency caught');
ok(has(validateRegistry(twoCycle), 'dependency cycle'), 'cycle surfaced through validateRegistry');
ok(has(validateRegistry([ent('a', { columns: [] })]), 'no columns'), 'empty columns caught');
ok(has(validateRegistry([ent('a', { naturalKey: [] })]), 'no naturalKey'), 'missing naturalKey caught');
ok(has(validateRegistry([ent('a', { naturalKey: ['ghost'] })]), 'is not a declared column'), 'naturalKey must reference a real column');
ok(has(validateRegistry([ent('a', { softDeleteField: 'isDeleted' })]), 'softDeleteField'), 'softDeleteField must reference a real column');
ok(has(validateRegistry([ent('a', { columns: [col('id'), col('id')] })]), 'duplicate column'), 'duplicate column caught');
ok(has(validateRegistry([ent('a', { minRole: 'auditor' })]), 'unknown minRole'), 'unknown minRole caught');
ok(has(validateRegistry([ent('a', { backupPolicy: 'archive' })]), 'unknown backupPolicy'), 'unknown backupPolicy caught');
ok(has(validateRegistry([ent('a', { pdfGenerator: 'gen', formats: ['csv'] })]), 'pdfGenerator declared'), 'pdfGenerator without pdf format caught');

// The three custody invariants — the heart of the design.
ok(has(validateRegistry([ent('a', { backupPolicy: 'exclude', formats: ['csv'] })]), 'would be exportable'),
  'EXCLUDE entity must not be exportable (secrets never leave)');
ok(validateRegistry([ent('a', { backupPolicy: 'exclude', formats: [] })]).length === 0,
  'exclude + no formats is valid');
ok(has(validateRegistry([ent('a', { nature: 'evidence', backupPolicy: 'full' })]), 'must carry backupPolicy "sidecar"'),
  'EVIDENCE must be sidecar (audit_log is never restored — restoring it would forge history)');
ok(has(validateRegistry([ent('a', { nature: 'derived', backupPolicy: 'full' })]), 'must carry backupPolicy "replay"'),
  'DERIVED must be replay (voucher_entries is regenerated, never restored — RULE 2)');
ok(validateRegistry([ent('a', { nature: 'derived', backupPolicy: 'replay' })]).length === 0, 'derived + replay is valid');
ok(validateRegistry([ent('a', { nature: 'evidence', backupPolicy: 'sidecar' })]).length === 0, 'evidence + sidecar is valid');

// All problems are reported at once, not one per run.
ok(validateRegistry([ent('a', { columns: [], naturalKey: [] })]).length >= 2, 'every problem is reported, not just the first');

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 (T-06) — the REAL registry, checked against the REAL schema.
//
// Above this line everything is a mirror + fixtures. Below, we import the actual
// TypeScript declarations and assert every declared column exists in
// supabase-tables.sql. FAIL-CLOSED: if the import fails we exit 1 rather than
// skipping, so a broken registry can never pass silently.
// ══════════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel));

// Resolve the codebase's extensionless relative TS imports (same in-file loader as
// scripts/test-capability-consistency.mjs — no extra files, no dependencies).
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

let REGISTRY, backupEntities, restorableEntities;
try {
  ({ REGISTRY, backupEntities, restorableEntities } = await import(abs('../src/lib/export/registry.ts').href));
} catch (e) {
  console.error('\nFAIL    Could not import the real export registry.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  console.error('        Requires Node with native TypeScript support (>= 23.6, or >= 22.6 with');
  console.error('        --experimental-strip-types). Refusing to skip. Failing closed.');
  process.exit(1);
}
if (!Array.isArray(REGISTRY) || REGISTRY.length === 0) {
  console.error('\nFAIL    REGISTRY is empty or not an array.');
  process.exit(1);
}

// ── Parse supabase-tables.sql into table → Set<column> ────────────────────────
// Column names are anchored on the TYPE keyword that follows them, not on line starts:
// several housing tables pack multiple columns onto one line
// (e.g. `"complaintNo" text, "flatId" text, "flatNo" text,`). A first-token-per-line
// parser silently misses all but the first, and would then report real columns as missing.
const SQL_TYPES = 'text|numeric|boolean|jsonb|json|timestamptz|timestamp|integer|int|bigint|uuid|date|serial';

function parseSchema(sql) {
  const tables = new Map();
  // create table if not exists X ( ...body... );
  // ANCHORED TO LINE START (m flag). Without it, a SQL *comment* that merely quotes the
  // phrase "create table if not exists suppliers (...)" is parsed as a real statement:
  // the body capture then runs to the next `\n);`, swallowing whole tables. That is not
  // hypothetical — a T-12 comment did exactly this.
  const createRe = /^create table if not exists\s+(\w+)\s*\(([\s\S]*?)\n\);/gim;
  for (const m of sql.matchAll(createRe)) {
    const [, table, body] = m;
    const cols = tables.get(table) ?? new Set();
    const stripped = body.replace(/--[^\n]*/g, '');   // drop trailing comments
    const colRe = new RegExp(`(?:^|,)\\s*"?([A-Za-z_][A-Za-z0-9_]*)"?\\s+(?:${SQL_TYPES})\\b`, 'gi');
    for (const cm of stripped.matchAll(colRe)) {
      const name = cm[1];
      if (['primary', 'foreign', 'unique', 'check', 'constraint'].includes(name.toLowerCase())) continue;
      cols.add(name);
    }
    tables.set(table, cols);
  }
  // alter table X add column if not exists "col"
  const alterRe = /alter table\s+(?:public\.)?(\w+)\s+add column if not exists\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi;
  for (const m of sql.matchAll(alterRe)) {
    const [, table, col] = m;
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table).add(col);
  }
  return tables;
}

const schema = parseSchema(
  readFileSync(pathResolve(HERE, '../supabase-tables.sql'), 'utf8') +
  '\n' +
  readFileSync(pathResolve(HERE, '../MIGRATIONS.sql'), 'utf8')
);

// ── 5. The real registry is structurally valid ────────────────────────────────
const realProblems = validateRegistry(REGISTRY);
if (realProblems.length) for (const p of realProblems) console.error(`    → ${p.entity}: ${p.problem}`);
ok(realProblems.length === 0, `REGISTRY has no structural problems (${realProblems.length} found)`);
ok(findCycle(REGISTRY) === null, 'REGISTRY dependency graph is acyclic');

// ── 6. Every declared table and column exists in the real schema ──────────────
for (const e of REGISTRY) {
  const cols = schema.get(e.table);
  ok(!!cols, `[${e.key}] table "${e.table}" exists in supabase-tables.sql`);
  if (!cols) continue;
  const missing = e.columns.map(c => c.key).filter(k => !cols.has(k));
  ok(missing.length === 0, `[${e.key}] all declared columns exist (missing: ${missing.join(', ') || 'none'})`);
}

// ── 7. society_id is tenant scoping, never declared as exportable data ────────
// EXCEPTION: the two procurement counter tables use society_id as their PRIMARY KEY —
// one row per society, no surrogate id. There it is identity, not scoping.
const SOCIETY_ID_PK_TABLES = new Set([
  'procurement_jform_counters', 'procurement_settlement_counters',
  'tds_challan_links',   // primary key (society_id, "entryId") — no surrogate id
]);
for (const e of REGISTRY) {
  const declaresIt = e.columns.some(c => c.key === 'society_id');
  if (SOCIETY_ID_PK_TABLES.has(e.table)) {
    ok(declaresIt, `[${e.key}] declares society_id (it is the table's primary key)`);
  } else {
    ok(!declaresIt, `[${e.key}] does not declare society_id as a column`);
  }
}

// ── 8a. COVERAGE: every table in the schema is declared exactly once ─────────
// T-12 wrote DDL for the last three orphans (recoverables, kachi_aarat_entries,
// p7_entries) and declared them, so this is now a strict bijection. The build-time
// gate lives in scripts/test-schema-drift.mjs; this is the semantic version of it.
const T12_ADOPTED = ['recoverables', 'kachi_aarat_entries', 'p7_entries'];
const sqlTables = [...schema.keys()].sort();
const declaredTables = new Set(REGISTRY.map(e => e.table));
const undeclared = sqlTables.filter(t => !declaredTables.has(t));
const phantom = [...declaredTables].filter(t => !schema.has(t));
if (undeclared.length) console.error(`    → undeclared tables: ${undeclared.join(', ')}`);
if (phantom.length) console.error(`    → declared but absent from SQL: ${phantom.join(', ')}`);
ok(undeclared.length === 0, `every table in supabase-tables.sql is declared (${undeclared.length} undeclared)`);
ok(phantom.length === 0, `no entity declares a table that does not exist (${phantom.length} phantom)`);
ok(declaredTables.size === sqlTables.length, `registry covers all ${sqlTables.length} tables (declared ${declaredTables.size})`);
for (const t of T12_ADOPTED) {
  ok(schema.has(t), `${t} now has DDL in supabase-tables.sql (T-12)`);
  ok(declaredTables.has(t), `${t} is declared in the registry`);
}

// T-12: `suppliers` and `customers` were each declared TWICE, with disagreeing bodies.
// The second `create table if not exists` was a no-op, so a reader could not tell which
// definition was live. Pin the dedupe so nobody re-adds one.
const rawSql = readFileSync(pathResolve(HERE, '../supabase-tables.sql'), 'utf8');
for (const t of ['suppliers', 'customers']) {
  // Line-anchored: comments that quote the phrase must not count as declarations.
  const n = [...rawSql.matchAll(new RegExp(`^create table if not exists\\s+${t}\\s*\\(`, 'gim'))].length;
  ok(n === 1, `${t} is declared exactly once in supabase-tables.sql (found ${n})`);
}
// The surviving definition is STEP 6's: `name not null`, and customers keeps `gstNo`.
ok(/create table if not exists suppliers[\s\S]*?name text not null/i.test(rawSql), 'the surviving suppliers definition keeps `name text not null`');
ok(/create table if not exists customers[\s\S]*?"gstNo" text/i.test(rawSql), 'the surviving customers definition keeps `gstNo`');

// ── 8. Coverage so far: core + member (T-06) and inventory + trade (T-07) ─────
const keys = REGISTRY.map(e => e.key).sort();
const EXPECTED = [
  // T-06 core + member
  'account', 'member', 'society', 'voucher', 'voucher_entry',
  // T-07 inventory
  'branch', 'godown', 'stock_item', 'stock_movement',
  // T-07 trade
  'customer', 'hsn', 'purchase', 'purchase_return', 'sale', 'sales_return', 'supplier',
  // T-08 lending + deposits
  'loan', 'kcc_loan', 'deposit_account', 'deposit_transaction',
  // T-08 payroll + labour
  'employee', 'salary_record', 'worker', 'department', 'work_order',
  'department_bill', 'worker_advance', 'muster_entry', 'pf_esi_run',
  // T-09 procurement engine
  'procurement_farmer', 'procurement_lot', 'procurement_event', 'procurement_quality_test',
  'procurement_moisture_record', 'procurement_jform', 'procurement_financial_intent',
  'procurement_posting_request', 'procurement_posting_rule_result', 'procurement_settlement',
  'procurement_jform_counter', 'procurement_settlement_counter',
  // T-10 dairy
  'dairy_rate_chart', 'milk_entry', 'dairy_settlement', 'dairy_dispatch',
  'dairy_input_issue', 'dairy_distribution',
  // T-10 housing
  'housing_building', 'housing_flat', 'housing_charge_head', 'maintenance_bill',
  'housing_fund_investment', 'housing_complaint', 'housing_parking', 'housing_transfer',
  'housing_insurance', 'housing_amc', 'housing_document',
  // T-11 marketing masters
  'procurement_crop', 'procurement_variety', 'procurement_season', 'procurement_agency',
  'procurement_centre', 'procurement_msp_rate', 'procurement_deduction_rule',
  'procurement_quality_spec', 'procurement_bardana_type', 'marketing_transporter',
  // T-11 consumer
  'consumer_price_list', 'consumer_patronage_run', 'consumer_purchase_order',
  // T-11 assets / compliance / governance
  'asset', 'bank_reconciliation', 'tds_entry', 'tds_challan', 'tds_challan_link',
  'eway_bill', 'compliance_filing', 'budget', 'audit_objection', 'meeting', 'election',
  // T-11 evidence + system
  'audit_log', 'guide_certificate',
  'societies', 'society_user', 'society_capability', 'platform_admin',
  'user_mfa', 'user_mfa_recovery',
  // T-12 — the three tables that had no DDL until now
  'recoverable', 'kachi_aarat_entry', 'p7_entry',
].sort();
ok(keys.join(',') === EXPECTED.join(','), `declares exactly the expected ${EXPECTED.length} tables (got ${keys.length}: ${keys.join(',')})`);

// ── 9. THE CUSTODY RULES, on the real data ───────────────────────────────────
const ve = REGISTRY.find(e => e.key === 'voucher_entry');
ok(ve.nature === 'derived' && ve.backupPolicy === 'replay',
  'voucher_entry is derived ⇒ replay (regenerated by the posting engine, never restored — RULE 2)');
ok(!restorableEntities().some(e => e.key === 'voucher_entry'),
  'voucher_entry is NOT in the restore insert plan');
ok(backupEntities().some(e => e.key === 'voucher_entry'),
  'voucher_entry IS still exported, as a replay checksum');

// ── 10. Restore ordering: dependencies before dependents ─────────────────────
const realOrder = topoOrder(REGISTRY);
ok(realOrder.indexOf('society') < realOrder.indexOf('account'), 'society restores before accounts');
ok(realOrder.indexOf('account') < realOrder.indexOf('voucher'), 'accounts restore before vouchers');
ok(realOrder.indexOf('member') < realOrder.indexOf('voucher'), 'members restore before vouchers');
ok(realOrder.indexOf('voucher') < realOrder.indexOf('voucher_entry'), 'vouchers precede their derived entries');

// ── 11. Soft-delete + PII declarations ───────────────────────────────────────
ok(REGISTRY.find(e => e.key === 'voucher').softDeleteField === 'isDeleted', 'vouchers are soft-deleted (RULE 5)');
ok(REGISTRY.find(e => e.key === 'member').softDeleteField === 'isDeleted', 'members are soft-deleted (RULE 5)');
ok(!REGISTRY.find(e => e.key === 'account').softDeleteField, 'accounts have no soft-delete column (they are hard-deleted, guarded by H10)');

// Every key that lib/auditLog.ts masks must be classified as PII wherever it is declared.
const AUDIT_PII_KEYS = ['phone', 'nomineePhone', 'pan', 'entityPan', 'deducteePan', 'aadhaar', 'aadhaarNo', 'password'];
for (const e of REGISTRY) {
  for (const c of e.columns) {
    if (AUDIT_PII_KEYS.includes(c.key)) {
      ok(c.piiClass !== 'none', `[${e.key}.${c.key}] is masked by auditLog PII_KEYS ⇒ must not be piiClass 'none'`);
    }
  }
}
const m = REGISTRY.find(e => e.key === 'member');
ok(m.columns.find(c => c.key === 'aadhaar').piiClass === 'identity', 'member.aadhaar classified as identity PII');
ok(m.columns.find(c => c.key === 'address').piiClass === 'contact', 'member.address classified as contact PII');
ok(m.columns.filter(c => c.piiClass !== 'none').length >= 6, 'member declares its PII surface (>= 6 sensitive columns)');

// ── 11b. T-07: inventory + trade invariants ──────────────────────────────────
const byKey = (k) => REGISTRY.find(e => e.key === k);

// hsn_master carries society_id ⇒ it is per-society, not global reference data.
ok(byKey('hsn').scope === 'society', 'hsn_master is society-scoped (the table has a society_id column)');
ok(backupEntities().some(e => e.key === 'hsn'), 'hsn_master is included in a society backup');

// stock_items.currentStock is a CACHE (RULE 2). It must never be a default CSV column.
const cur = byKey('stock_item').columns.find(c => c.key === 'currentStock');
ok(cur && cur.defaultVisible === false, 'stock_item.currentStock (cached) is hidden by default — RULE 2');
ok(byKey('stock_item').columns.some(c => c.key === 'openingStock'), 'stock_item declares openingStock (the canonical base of the stock formula)');

// Bank details gate suppliers/customers behind `accountant`.
for (const k of ['supplier', 'customer']) {
  ok(byKey(k).minRole === 'accountant', `${k} requires accountant (carries bank account + IFSC + PAN)`);
  ok(!roleAtLeast('viewer', byKey(k).minRole), `viewer cannot export ${k}`);
  const fin = byKey(k).columns.filter(c => c.piiClass === 'financial').map(c => c.key);
  ok(fin.includes('accountNo') && fin.includes('ifsc'), `${k} classifies bank columns as financial PII (${fin.length} found)`);
}
// …while the registers that reference them stay viewer-exportable.
ok(roleAtLeast('viewer', byKey('sale').minRole) && roleAtLeast('viewer', byKey('purchase').minRole),
  'sale/purchase registers remain viewer-exportable');

// Every trade transaction is soft-deleted (RULE 5) and restores in dependency order.
for (const k of ['sale', 'purchase', 'sales_return', 'purchase_return']) {
  ok(byKey(k).softDeleteField === 'isDeleted', `${k} is soft-deleted (RULE 5)`);
}
ok(realOrder.indexOf('voucher') < realOrder.indexOf('sale'), 'vouchers restore before the sales that reference them');
ok(realOrder.indexOf('sale') < realOrder.indexOf('sales_return'), 'sales restore before their returns');
ok(realOrder.indexOf('purchase') < realOrder.indexOf('purchase_return'), 'purchases restore before their returns');
ok(realOrder.indexOf('branch') < realOrder.indexOf('godown'), 'branches restore before godowns');
ok(realOrder.indexOf('stock_item') < realOrder.indexOf('stock_movement'), 'stock items restore before their movements');
ok(realOrder.indexOf('supplier') < realOrder.indexOf('purchase'), 'suppliers restore before purchases');
ok(realOrder.indexOf('customer') < realOrder.indexOf('sale'), 'customers restore before sales');

// Capability gating: domain modules must be hidden, not empty, for societies without them.
ok(byKey('godown').capability === 'warehousing', 'godowns require the warehousing capability');
ok(byKey('hsn').capability === 'gst', 'hsn_master requires the gst capability');
for (const k of ['stock_item', 'stock_movement', 'sale', 'purchase']) {
  ok(byKey(k).capability === 'inventory_sales', `${k} requires the inventory_sales capability`);
}
// Core accounting is never capability-gated — every society has a ledger.
for (const k of ['society', 'account', 'voucher', 'voucher_entry', 'member']) {
  ok(!byKey(k).capability, `${k} is not capability-gated`);
}

// ── 11c. T-08: lending, deposits, payroll, labour invariants ─────────────────

// `recoverables` is read/written by DataContext but has NO DDL in the repo. It must NOT
// be declared until T-12 writes its schema — a declaration would force the schema check
// to accept a table it cannot verify.
// (T-08 deferred `recoverables` because it had no DDL. T-12 wrote its schema and declared
// it; the adoption is now asserted in §8a and §11g.)
ok(!!byKey('recoverable'), 'recoverables is declared (T-12 wrote its DDL)');
ok(schema.has('recoverables'), 'recoverables now has DDL in supabase-tables.sql');

// Identity + payments datasets require accountant; the registers that cite them do not.
for (const k of ['employee', 'worker']) {
  ok(byKey(k).minRole === 'accountant', `${k} requires accountant (PAN / UAN / bank details)`);
  ok(!roleAtLeast('viewer', byKey(k).minRole), `viewer cannot export ${k}`);
}
ok(byKey('worker').columns.find(c => c.key === 'aadhaar').piiClass === 'identity', 'worker.aadhaar classified as identity PII');
ok(byKey('worker').columns.find(c => c.key === 'bankAccountNo').piiClass === 'financial', 'worker.bankAccountNo classified as financial PII');
ok(byKey('employee').columns.find(c => c.key === 'bankAccount').piiClass === 'financial', 'employee.bankAccount classified as financial PII');
for (const k of ['muster_entry', 'department_bill', 'worker_advance', 'work_order']) {
  ok(roleAtLeast('viewer', byKey(k).minRole), `${k} register stays viewer-exportable`);
}
ok(byKey('salary_record').minRole === 'accountant', 'salary records require accountant');

// Cached running totals must never be default CSV columns (RULE 2).
const cached = [
  ['loan', 'repaidAmount'],
  ['kcc_loan', 'outstandingAmount'],
  ['deposit_account', 'balance'],
];
for (const [k, col] of cached) {
  const cd = byKey(k).columns.find(c => c.key === col);
  ok(cd && cd.defaultVisible === false, `${k}.${col} is a cached total, hidden by default — RULE 2`);
}

// Capability gating mirrors moduleCatalog.ts exactly.
for (const k of ['loan', 'kcc_loan', 'deposit_account', 'deposit_transaction']) {
  ok(byKey(k).capability === 'lending', `${k} requires the lending capability (as moduleCatalog gates Deposits/KCC)`);
}
for (const k of ['worker', 'department', 'work_order', 'department_bill', 'worker_advance', 'muster_entry']) {
  ok(byKey(k).capability === 'labour', `${k} requires the labour capability`);
}
ok(byKey('pf_esi_run').capability === 'pf_esi', 'pf_esi_runs requires the pf_esi capability');
// Payroll is universal — moduleCatalog gates `salary` on U (no capability).
ok(!byKey('employee').capability && !byKey('salary_record').capability, 'employees + salary records are not capability-gated (every society runs payroll)');

// Soft-delete coverage: ECR-02 made loans and employees soft-deletable.
for (const k of ['loan', 'employee', 'worker', 'department', 'work_order', 'department_bill', 'worker_advance', 'muster_entry', 'pf_esi_run']) {
  ok(byKey(k).softDeleteField === 'isDeleted', `${k} is soft-deleted (RULE 5)`);
}

// Restore ordering across the new domains.
ok(realOrder.indexOf('member') < realOrder.indexOf('loan'), 'members restore before loans');
ok(realOrder.indexOf('deposit_account') < realOrder.indexOf('deposit_transaction'), 'deposit accounts restore before their transactions');
ok(realOrder.indexOf('employee') < realOrder.indexOf('salary_record'), 'employees restore before salary records');
ok(realOrder.indexOf('worker') < realOrder.indexOf('worker_advance'), 'workers restore before their advances');
ok(realOrder.indexOf('department') < realOrder.indexOf('work_order'), 'departments restore before work orders');
ok(realOrder.indexOf('work_order') < realOrder.indexOf('department_bill'), 'work orders restore before department bills');
ok(realOrder.indexOf('work_order') < realOrder.indexOf('muster_entry'), 'work orders restore before muster entries');

// ── 11d. T-09: procurement engine invariants ─────────────────────────────────

// THE DEVIATION, pinned. The roadmap classified posting_rule_results as `replay`.
// It carries `profile` (the versioned rule that ran) and `legs` (what that rule produced).
// Replaying it under today's profile can yield legs that contradict the vouchers it sits
// beside — and the restore would "assert" the contradiction and pass. A trace you
// regenerate is not a trace. It is exported and restored verbatim.
const prr = byKey('procurement_posting_rule_result');
ok(prr.backupPolicy === 'full', 'posting_rule_results is FULL, not replay (versioned rule output, not a pure projection)');
ok(prr.nature === 'transaction', 'posting_rule_results is a transaction, not derived');
ok(restorableEntities().some(e => e.key === 'procurement_posting_rule_result'), 'posting_rule_results IS restored verbatim');
ok(prr.columns.some(c => c.key === 'profile'), 'posting_rule_results declares `profile` — the reason it cannot be replayed');

// voucher_entries remains the ONLY replay entity. If a second one appears, it must be
// justified against the same test: is it a pure projection, or a versioned engine output?
const replayKeys = REGISTRY.filter(e => e.backupPolicy === 'replay').map(e => e.key);
ok(replayKeys.join(',') === 'voucher_entry', `voucher_entry is the only replay entity (got: ${replayKeys.join(',') || 'none'})`);

// The SSOT trace: Payment → EngineVoucher → PostingRuleResult → jformId. Every hop must
// survive a backup, or the farmer-payment audit trail cannot be reconstructed.
const traceChain = [
  'procurement_lot', 'procurement_jform', 'procurement_financial_intent',
  'procurement_posting_request', 'procurement_posting_rule_result', 'procurement_settlement',
];
for (const k of traceChain) {
  ok(backupEntities().some(e => e.key === k), `[trace] ${k} is included in a society backup`);
  ok(restorableEntities().some(e => e.key === k), `[trace] ${k} is restorable`);
}
ok(byKey('procurement_settlement').columns.some(c => c.key === 'engineVoucherId'), 'settlements keep the engineVoucherId link (SSOT trace, not a denormalized jformId)');

// Counters: losing them silently re-issues statutory document numbers.
for (const k of ['procurement_jform_counter', 'procurement_settlement_counter']) {
  ok(byKey(k).backupPolicy === 'full', `${k} is backed up (else J-Form / settlement numbering restarts at 1)`);
  ok(byKey(k).naturalKey.join(',') === 'society_id', `${k} keys on society_id (its primary key)`);
  ok(byKey(k).minRole === 'admin', `${k} is admin-only`);
  ok(byKey(k).nature === 'system', `${k} is system-nature`);
}

// The whole engine is gated on procurement_msp, and the money-side tables on accountant.
for (const e of REGISTRY.filter(e => e.domain === 'procurement')) {
  ok(e.capability === 'procurement_msp', `${e.key} requires the procurement_msp capability`);
}
for (const k of ['procurement_financial_intent', 'procurement_posting_request', 'procurement_posting_rule_result', 'procurement_settlement', 'procurement_event']) {
  ok(!roleAtLeast('viewer', byKey(k).minRole), `viewer cannot export ${k} (ledger-side engine state)`);
}
ok(byKey('procurement_farmer').columns.find(c => c.key === 'mobile').piiClass === 'contact', 'farmer.mobile classified as contact PII');
ok(byKey('procurement_settlement').softDeleteField === 'isDeleted', 'settlements are soft-deleted (RULE 5)');

// Restore ordering follows the engine pipeline.
ok(realOrder.indexOf('procurement_farmer') < realOrder.indexOf('procurement_lot'), 'farmers restore before lots');
ok(realOrder.indexOf('procurement_lot') < realOrder.indexOf('procurement_jform'), 'lots restore before J-Forms');
ok(realOrder.indexOf('procurement_jform') < realOrder.indexOf('procurement_financial_intent'), 'J-Forms restore before financial intents');
ok(realOrder.indexOf('procurement_financial_intent') < realOrder.indexOf('procurement_posting_request'), 'intents restore before posting requests');
ok(realOrder.indexOf('procurement_posting_request') < realOrder.indexOf('procurement_posting_rule_result'), 'posting requests restore before their rule results');
ok(realOrder.indexOf('voucher') < realOrder.indexOf('procurement_settlement'), 'vouchers restore before the settlements that cite them');

// ── 11e. T-10: dairy + housing invariants ────────────────────────────────────

// The schema parser must see columns packed several-per-line (housing tables do this).
// If it regresses to first-token-per-line, these declared columns vanish from `schema`
// and the "all declared columns exist" checks above go red. Pin the parser directly.
ok(schema.get('housing_complaints').has('flatId') && schema.get('housing_complaints').has('memberId'),
  'schema parser reads multiple columns declared on one line (housing_complaints.flatId/memberId)');
ok(schema.get('housing_parking').has('vehicleNo'), 'schema parser reads packed columns (housing_parking.vehicleNo)');
ok(schema.get('housing_flats').has('buildingId'), 'schema parser picks up ALTER-added columns (housing_flats.buildingId)');
ok(schema.get('dairy_settlements').has('from') && schema.get('dairy_settlements').has('to'),
  'schema parser reads quoted reserved-word columns (dairy_settlements."from"/"to")');

// Capability gating mirrors moduleCatalog.ts.
for (const e of REGISTRY.filter(e => e.domain === 'dairy')) {
  ok(e.capability === 'dairy_collection', `${e.key} requires the dairy_collection capability`);
}
for (const e of REGISTRY.filter(e => e.domain === 'housing')) {
  ok(e.capability === 'housing', `${e.key} requires the housing capability`);
}

// Housing tables are uniformly soft-deleted (RULE 5).
for (const e of REGISTRY.filter(e => e.domain === 'housing')) {
  ok(e.softDeleteField === 'isDeleted', `${e.key} is soft-deleted (RULE 5)`);
}

// The flat-level nomination block must be classified, or a redacted Share & Nomination
// Register would leak the nominee's phone. `nomineePhone` is masked by auditLog PII_KEYS.
const hf = byKey('housing_flat');
ok(hf.columns.find(c => c.key === 'nomineePhone').piiClass === 'contact', 'housing_flat.nomineePhone classified as contact PII');
ok(hf.columns.find(c => c.key === 'nomineeName').piiClass === 'contact', 'housing_flat.nomineeName classified as contact PII');
ok(hf.columns.some(c => c.key === 'shareCertNo'), 'housing_flat carries the share block (Share & Nomination Register)');

// Money-side dairy/housing entities are accountant-only; the day-to-day registers are not.
for (const k of ['dairy_settlement', 'dairy_distribution', 'housing_fund_investment', 'housing_transfer']) {
  ok(!roleAtLeast('viewer', byKey(k).minRole), `viewer cannot export ${k} (money-side)`);
}
for (const k of ['milk_entry', 'maintenance_bill', 'housing_complaint', 'housing_parking']) {
  ok(roleAtLeast('viewer', byKey(k).minRole), `${k} stays viewer-exportable`);
}

// Cached running totals stay hidden by default (RULE 2).
for (const [k, col] of [['dairy_settlement', 'amountPaid'], ['dairy_distribution', 'amountPaid'],
                        ['dairy_dispatch', 'amountReceived'], ['maintenance_bill', 'paidAmount']]) {
  const cd = byKey(k).columns.find(c => c.key === col);
  ok(cd && cd.defaultVisible === false, `${k}.${col} is a cached total, hidden by default — RULE 2`);
}

// Restore ordering across the two domains.
ok(realOrder.indexOf('dairy_rate_chart') < realOrder.indexOf('milk_entry'), 'rate charts restore before milk entries');
ok(realOrder.indexOf('member') < realOrder.indexOf('dairy_settlement'), 'members restore before dairy settlements');
ok(realOrder.indexOf('housing_building') < realOrder.indexOf('housing_flat'), 'buildings restore before flats');
for (const k of ['maintenance_bill', 'housing_complaint', 'housing_parking', 'housing_transfer']) {
  ok(realOrder.indexOf('housing_flat') < realOrder.indexOf(k), `flats restore before ${k}`);
}
ok(realOrder.indexOf('account') < realOrder.indexOf('housing_charge_head'), 'accounts restore before charge heads');

// ── 11f. T-11: the custody classes, on the real registry ─────────────────────

// EVIDENCE — exported for custody, never restored. Writing rows back into a WORM log
// would forge a non-repudiable trail (blueprint P4).
//
// NOTE the two-part shape. Asserting only over `filter(nature === 'evidence')` is a trap:
// flip audit_log's nature and it drops out of the list, so every per-entity check below
// silently stops running and one lone assertion fails. The guard must name the entities
// it protects, by KEY, independent of the field being sabotaged.
const EVIDENCE_KEYS = ['audit_log', 'guide_certificate'];
const evidenceKeys = REGISTRY.filter(e => e.nature === 'evidence').map(e => e.key).sort();
ok(evidenceKeys.join(',') === EVIDENCE_KEYS.join(','), `evidence entities are exactly audit_log + guide_certificate (got: ${evidenceKeys.join(',') || 'none'})`);
for (const k of EVIDENCE_KEYS) {
  ok(byKey(k).nature === 'evidence', `${k} is nature 'evidence'`);
  ok(byKey(k).backupPolicy === 'sidecar', `${k} is sidecar`);
  ok(backupEntities().some(e => e.key === k), `${k} IS exported (custody)`);
  ok(!restorableEntities().some(e => e.key === k), `${k} is NEVER restored (restoring it would forge history)`);
  ok(byKey(k).minRole === 'admin', `${k} is admin-only`);
}

// EXCLUDE — secrets, credentials, entitlement, cross-tenant registries. These leave in
// no format, ever. `formats: []` is what makes them unreachable from every export path.
const excludeKeys = REGISTRY.filter(e => e.backupPolicy === 'exclude').map(e => e.key).sort();
const EXPECTED_EXCLUDE = ['platform_admin', 'societies', 'society_capability', 'society_user', 'user_mfa', 'user_mfa_recovery'];
ok(excludeKeys.join(',') === EXPECTED_EXCLUDE.join(','), `excluded entities are exactly the 6 secret/cross-tenant tables (got: ${excludeKeys.join(',')})`);
for (const k of excludeKeys) {
  ok(byKey(k).formats.length === 0, `${k} declares no formats — unreachable from every export path`);
  ok(!backupEntities().some(e => e.key === k), `${k} is never exported`);
  ok(!restorableEntities().some(e => e.key === k), `${k} is never restored`);
}
// The three things that must never appear in an export, by column name.
ok(byKey('society_user').columns.some(c => c.key === 'password'), 'society_users carries `password` — hence exclude');
ok(byKey('user_mfa').columns.some(c => c.key === 'secret'), 'user_mfa carries `secret` — hence exclude');
ok(byKey('user_mfa_recovery').columns.some(c => c.key === 'code_hash'), 'user_mfa_recovery carries `code_hash` — hence exclude');
// Entitlement is server-controlled (capabilities.ts SOURCE TRUST MODEL): a restorable
// capabilities table would let a society re-grant itself paid capabilities.
ok(byKey('society_capability').backupPolicy === 'exclude', 'society_capabilities is excluded (entitlement is server-controlled, not society data)');

// The four policies now all appear, and every entity carries exactly one.
const policies = new Set(REGISTRY.map(e => e.backupPolicy));
ok(policies.size === 4, `all four custody policies are in use (got: ${[...policies].sort().join(', ')})`);

// TDS `deducteePan` is masked by auditLog PII_KEYS — the generic PII check above covers
// it, but pin the classification explicitly since a leak here is a statutory problem.
ok(byKey('tds_entry').columns.find(c => c.key === 'deducteePan').piiClass === 'identity', 'tds_entry.deducteePan classified as identity PII');

// Composite-key table with no surrogate id.
ok(byKey('tds_challan_link').naturalKey.join(',') === 'society_id,entryId', 'tds_challan_links keys on (society_id, entryId)');

// Capability gating for the last batch.
for (const e of REGISTRY.filter(e => e.domain === 'consumer')) {
  ok(e.capability === 'pos_billing', `${e.key} requires the pos_billing capability`);
}
for (const k of ['tds_entry', 'tds_challan', 'tds_challan_link']) ok(byKey(k).capability === 'tds', `${k} requires the tds capability`);
ok(byKey('eway_bill').capability === 'gst', 'eway_bills requires the gst capability');
ok(byKey('marketing_transporter').capability === 'transport', 'transporters require the transport capability');
// moduleCatalog gates assets / budgets / meetings / elections / bank recon on U.
for (const k of ['asset', 'budget', 'meeting', 'election', 'bank_reconciliation', 'compliance_filing', 'audit_objection']) {
  ok(!byKey(k).capability, `${k} is not capability-gated (moduleCatalog gates its module on U)`);
}

// Restore ordering for the masters the procurement engine consumes.
ok(realOrder.indexOf('procurement_crop') < realOrder.indexOf('procurement_variety'), 'crops restore before varieties');
ok(realOrder.indexOf('procurement_agency') < realOrder.indexOf('procurement_centre'), 'agencies restore before centres');
ok(realOrder.indexOf('procurement_crop') < realOrder.indexOf('procurement_msp_rate'), 'crops restore before MSP rates');
ok(realOrder.indexOf('tds_challan') < realOrder.indexOf('tds_entry'), 'challans restore before the TDS entries that cite them');
ok(realOrder.indexOf('tds_entry') < realOrder.indexOf('tds_challan_link'), 'TDS entries restore before challan links');
ok(realOrder.indexOf('stock_item') < realOrder.indexOf('consumer_price_list'), 'stock items restore before price lists');
ok(realOrder.indexOf('voucher') < realOrder.indexOf('asset'), 'vouchers restore before the assets that cite acquisition vouchers');

// ── 11g. T-12: the three adopted tables ──────────────────────────────────────
for (const k of ['recoverable', 'kachi_aarat_entry', 'p7_entry']) {
  ok(byKey(k).capability === 'haryana_compliance', `${k} requires haryana_compliance (as moduleCatalog gates its module)`);
  ok(byKey(k).backupPolicy === 'full', `${k} is backed up`);
  // DataContext hard-deletes all three. Declaring softDeleteField would tell the exporter
  // to filter on a flag nothing ever sets. Pinned so nobody "fixes" it without fixing the
  // delete path first.
  ok(!byKey(k).softDeleteField, `${k} declares NO softDeleteField — DataContext hard-deletes it (RULE 5 gap, not papered over)`);
}
ok(byKey('recoverable').columns.some(c => c.key === 'isDeleted'), 'recoverables still declares its (unused) isDeleted column for row fidelity');
ok(!byKey('p7_entry').columns.some(c => c.key === 'isDeleted'), 'p7_entries has no isDeleted column at all');

// ── 12. society_settings is admin-only (approval matrix, plan, signatories) ───
ok(REGISTRY.find(e => e.key === 'society').minRole === 'admin', 'society settings export requires admin');
ok(roleAtLeast('admin', REGISTRY.find(e => e.key === 'society').minRole), 'admin can export society settings');
ok(!roleAtLeast('accountant', REGISTRY.find(e => e.key === 'society').minRole), 'accountant cannot export society settings');

console.log(`\nExport registry (pure + real, ${REGISTRY.length} entities): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
