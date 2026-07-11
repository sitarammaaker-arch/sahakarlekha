// Schema-drift detector (T-12 / gap EXP-15) — the BUILD GATE.
//
// WHAT IT GUARANTEES
// Every table in supabase-tables.sql is declared exactly once in the Export Registry,
// and every table the Registry declares exists in the SQL. Nothing can be added to the
// database and silently omitted from backups (that omission was 83% of the schema when
// the audit was written), and nothing can be declared that does not exist.
//
// WHY THIS IS TEXT-BASED, NOT AN IMPORT
// scripts/test-export-registry.mjs imports the real TypeScript registry and asserts far
// more (columns, PII, custody policies, DAG order). It needs Node's type stripping
// (>= 23.6, or >= 22.6 with --experimental-strip-types). This script is wired into
// `npm run build`, which also runs on Vercel, whose Node version we do not pin. So it
// reads only text: `table:` literals from the entity files, `create table` statements
// from the SQL. Dumb, dependency-free, and impossible to break with a Node upgrade.
//
// The two scripts must agree on the table count. If they ever disagree, one of them is
// lying — run `npm run test:export-registry` for the semantic version.
//
// Run: node scripts/test-schema-drift.mjs   (npm run test:drift)

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const ENTITIES_DIR = join(ROOT, 'src', 'lib', 'export', 'entities');

/**
 * Tables the registry deliberately does not declare.
 * Every entry needs a written reason. An empty list is the goal; it is empty today.
 */
const KNOWN_EXCLUSIONS = Object.freeze({
  // T-03: server-side numbering authority — an operational counter, not user data, and not
  // yet wired into any write (the cutover pairs with the event ledger, T-06). It will be
  // DECLARED in the Export Registry when it goes live, so a restore preserves the last-issued
  // number and can never re-issue an existing one. Excluded only while it is dormant.
  document_sequences: 'server-side numbering authority (T-03); dormant until the T-06 cutover, then registered for backup',
  // T-10: per-society declared activities (Activities layer). Dormant until the resolver
  // reads it (T-11) and the cutover wires writes (T-12); it will be DECLARED in the Export
  // Registry then, so a society's declared activities are backed up. Excluded while dormant.
  society_activities: 'Activities-layer join (T-10); dormant until the T-11/T-12 wiring, then registered for backup',
  // T-06: the append-only event journal (system of record). Dormant until the dual-write
  // cutover (T-06 live / T-09); it becomes the AUTHORITATIVE store and will be registered for
  // backup then (and existing tables become its projections). Excluded while dormant.
  ledger_events: 'append-only event journal (T-06); dormant until the dual-write cutover, then the backup master',
});

let fail = 0;
const bad = (msg) => { fail++; console.error('  ✗ ' + msg); };

// ── 1. Tables declared in SQL ────────────────────────────────────────────────
// Line-anchored: a comment quoting "create table if not exists foo (" is not a statement.
const sqlText = readFileSync(join(ROOT, 'supabase-tables.sql'), 'utf8');
const sqlCreates = [...sqlText.matchAll(/^create table if not exists\s+(?:public\.)?(\w+)\s*\(/gim)].map(m => m[1]);

const sqlTables = new Set(sqlCreates);
const sqlDupes = sqlCreates.filter((t, i) => sqlCreates.indexOf(t) !== i);
if (sqlDupes.length) {
  // A second `create table if not exists` is a silent no-op whose body can disagree with
  // the first. Nobody reading the file can tell which definition is live. (T-12 removed
  // exactly two of these: suppliers and customers.)
  bad(`supabase-tables.sql declares these tables more than once: ${[...new Set(sqlDupes)].join(', ')}`);
}

// ── 2. Tables declared in the Export Registry ────────────────────────────────
const entityFiles = readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.ts'));
if (entityFiles.length === 0) bad('no entity files found under src/lib/export/entities/');

const registryTables = [];
for (const f of entityFiles) {
  const src = readFileSync(join(ENTITIES_DIR, f), 'utf8');
  // Match `table: 'x',` only in real code — skip commented-out lines.
  for (const line of src.split('\n')) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    const m = line.match(/^\s*table:\s*'([a-z_][a-z0-9_]*)'\s*,/i);
    if (m) registryTables.push({ table: m[1], file: f });
  }
}

const registrySet = new Set(registryTables.map(r => r.table));
const registryDupes = registryTables
  .map(r => r.table)
  .filter((t, i, a) => a.indexOf(t) !== i);
if (registryDupes.length) {
  bad(`two entities declare the same table: ${[...new Set(registryDupes)].join(', ')}`);
}

// ── 3. The bijection ─────────────────────────────────────────────────────────
const excluded = new Set(Object.keys(KNOWN_EXCLUSIONS));

const undeclared = [...sqlTables].filter(t => !registrySet.has(t) && !excluded.has(t)).sort();
for (const t of undeclared) {
  bad(`table "${t}" exists in supabase-tables.sql but no entity declares it — it would be ` +
      `silently missing from every backup. Declare it in src/lib/export/entities/, or add ` +
      `it to KNOWN_EXCLUSIONS with a written reason.`);
}

const phantom = [...registrySet].filter(t => !sqlTables.has(t)).sort();
for (const t of phantom) {
  const where = registryTables.find(r => r.table === t)?.file ?? '?';
  bad(`entity in ${where} declares table "${t}", which does not exist in supabase-tables.sql`);
}

for (const t of excluded) {
  if (!sqlTables.has(t)) bad(`KNOWN_EXCLUSIONS lists "${t}", which is not a real table — remove it`);
}

// ── 4. Report ────────────────────────────────────────────────────────────────
const n = sqlTables.size;
if (fail === 0) {
  console.log(`\n[schema-drift] ✓ ${registrySet.size}/${n} tables declared, 0 drift ` +
              `(${entityFiles.length} entity files, ${excluded.size} known exclusions).`);
} else {
  console.error(`\n[schema-drift] ${fail} problem(s). SQL tables: ${n}, declared: ${registrySet.size}.`);
  console.error('[schema-drift] The Export Registry is the single source of truth for what gets');
  console.error('[schema-drift] backed up. Drift here means data loss later.');
}
process.exit(fail > 0 ? 1 : 0);
