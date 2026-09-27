#!/usr/bin/env node
// M1-2 · static guard on migrations 072 (app_migrations) and 073 (financial_years). CI-safe.
//
// The behavioural test runs against a restored backup (scripts/db-harness/tests/m1-2-financial-years.mjs);
// this one pins the properties that make the pair safe to run in production:
// additive only, self-recording in app_migrations, tenant read-only RLS, and a down for each.
//
// Run: node scripts/test-m1-2-financial-years.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG = (f) => pathResolve(HERE, '../supabase/migrations', f);
const code = (f) => readFileSync(MIG(f), 'utf8').replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''").toLowerCase();

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

const up72 = code('072_app_migrations.sql');
const up73 = code('073_financial_years.sql');
const raw73 = readFileSync(MIG('073_financial_years.sql'), 'utf8');

console.log('Files');
for (const f of ['072_app_migrations.sql', '072_app_migrations_down.sql', '073_financial_years.sql', '073_financial_years_down.sql']) ok(`${f} exists`, existsSync(MIG(f)));

console.log('Additive only (no existing table or row changed)');
// Privilege statements name verbs (revoke … delete, truncate) without running them.
const noPriv = (src) => src.replace(/\b(revoke|grant)\b[^;]*;/g, ' ');
for (const [name, full] of [['072', up72], ['073', up73]]) {
  const src = noPriv(full);
  ok(`${name}: wrapped in begin … commit`, /^\s*begin;[\s\S]*commit;\s*$/.test(full));
  ok(`${name}: no UPDATE statement`, !/\bupdate\s+(public\.)?\w+\s+set\b/.test(src));
  ok(`${name}: no DELETE / TRUNCATE`, !/\bdelete\s+from\b|\btruncate\b/.test(src));
  ok(`${name}: no DROP TABLE / DROP COLUMN`, !/\bdrop\s+(table|column)\b/.test(src));
  const alters = [...src.matchAll(/alter\s+table\s+(?:public\.)?(\w+)/g)].map((m) => m[1]);
  ok(`${name}: ALTER TABLE only on its own new table`, alters.every((t) => t === (name === '072' ? 'app_migrations' : 'financial_years')));
  const inserts = [...src.matchAll(/insert\s+into\s+(?:public\.)?(\w+)/g)].map((m) => m[1]);
  ok(`${name}: INSERTs only into new tables`, inserts.every((t) => ['app_migrations', 'financial_years'].includes(t)));
}

console.log('Self-recording');
ok("072 records version '072'", /insert into public\.app_migrations \(version, name\) values \('072'/.test(readFileSync(MIG('072_app_migrations.sql'), 'utf8')));
ok("073 records version '073' as its last statement", /insert into public\.app_migrations \(version, name\) values \('073'[^;]*;\s*commit;\s*$/.test(raw73));
ok('both are re-runnable (if not exists / on conflict do nothing)', /create table if not exists/.test(up72) && /create table if not exists/.test(up73) && (up73.match(/on conflict/g) || []).length >= 2);

console.log('financial_years design (Phase-3 A-4)');
for (const col of ['society_id', 'fy_label', 'start_date', 'end_date', 'status', 'period_lock_date', 'closed_at', 'closed_by',
  'close_authority', 'audited_at', 'audited_by', 'audit_reference', 'previous_fy_id', 'net_result_minor', 'opening_event_id']) {
  ok(`column ${col}`, new RegExp(`\\n\\s+${col}\\s`).test(raw73));
}
ok("status limited to open/closing/closed/audited", /status in \('open', 'closing', 'closed', 'audited'\)/.test(raw73));
ok('unique (society_id, fy_label)', /unique \(society_id, fy_label\)/.test(up73));
ok('no-overlap exclusion constraint', /exclude using gist/.test(up73));
ok('one open + one closing FY per society', /financial_years_one_open[\s\S]*where status = ''/.test(up73) && /financial_years_one_closing/.test(up73));
ok('backfill uses the label, not financialYearStart', /"financialYear"/.test(raw73) && !/"financialYearStart"\s*(::|,|\))/.test(raw73.replace(/--[^\n]*/g, '')));

console.log('RLS');
ok('072: RLS on, no policy, no grant to anon/authenticated', /enable row level security/.test(up72) && !/create policy/.test(up72) && /revoke all on public\.app_migrations from anon, authenticated/.test(up72));
ok('073: RLS on', /alter table public\.financial_years enable row level security/.test(up73));
ok('073: exactly one policy, and it is SELECT', (up73.match(/create policy/g) || []).length === 1 && /for select using/.test(up73));
ok('073: tenant predicate via get_current_society_id()', /society_id::text = get_current_society_id\(\)/.test(up73));
ok('073: writes revoked from anon/authenticated', /revoke insert, update, delete, truncate on public\.financial_years from anon, authenticated/.test(up73));

console.log('Downs');
const d73 = code('073_financial_years_down.sql');
const d72 = code('072_app_migrations_down.sql');
ok('073 down drops only financial_years and its 073 record', /drop table if exists public\.financial_years/.test(d73) && !/drop table if exists public\.(?!financial_years)/.test(d73));
ok('072 down drops only app_migrations', /drop table if exists public\.app_migrations/.test(d72) && (d72.match(/drop table/g) || []).length === 1);

console.log(`\nM1-2 static: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
