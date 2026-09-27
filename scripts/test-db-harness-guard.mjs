#!/usr/bin/env node
// RM-31 · the DB harness must only ever touch a LOCAL throwaway cluster.
//
// Pure checks (no database needed, safe in CI): the target guard refuses remote hosts and the
// default Postgres port, the harness sources carry no remote connection string, and every
// helper connection goes through the guard.
//
// Run: node scripts/test-db-harness-guard.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { assertLocalTarget, DEFAULT_PORT, SUPABASE_ROLES } from './db-harness/harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const refuses = (h, p) => { try { assertLocalTarget(h, p); return false; } catch { return true; } };

console.log('Target guard');
ok('allows localhost on the harness port', !refuses('localhost', DEFAULT_PORT));
ok('allows 127.0.0.1', !refuses('127.0.0.1', 55433));
ok('refuses a Supabase host', refuses('aws-1-ap-northeast-1.pooler.supabase.com', 55432));
ok('refuses db.<ref>.supabase.co', refuses('db.rwffxupenwdtrmyabytk.supabase.co', 55432));
ok('refuses any other hostname', refuses('example.com', 55432));
ok('refuses the default port 5432 (a real local server may live there)', refuses('localhost', 5432));
ok('refuses a privileged / invalid port', refuses('localhost', 80) && refuses('localhost', 'x') && refuses('localhost', 70000));
ok('default port is not 5432', DEFAULT_PORT !== 5432);

console.log('Roles');
for (const r of ['anon', 'authenticated', 'service_role', 'authenticator']) ok(`creates Supabase role ${r}`, SUPABASE_ROLES.includes(r));

console.log('Sources');
const files = ['harness.mjs', 'lib.mjs', 'smoke.mjs'].map((f) => [f, readFileSync(pathResolve(HERE, 'db-harness', f), 'utf8')]);
for (const [f, src] of files) {
  ok(`${f} has no remote connection string`, !/supabase\.(co|com)|postgres(ql)?:\/\//i.test(src));
  ok(`${f} reads no DATABASE_URL / PG* env for the target`, !/process\.env\.(DATABASE_URL|PGHOST|PGPORT|SUPABASE_DB)/.test(src));
}
const lib = files.find(([f]) => f === 'lib.mjs')[1];
ok('lib.mjs connects only through assertLocalTarget', /assertLocalTarget\('localhost', state\.port\)/.test(lib) && (lib.match(/new pg\.Client/g) || []).length === 1);
ok('lib.mjs always rolls back', /finally[\s\S]*rollback/.test(lib));
const harness = files.find(([f]) => f === 'harness.mjs')[1];
const hostArgs = harness.match(/'-h',\s*'[^']*'/g) || [];
ok('psql/pg_restore calls use localhost only',
  hostArgs.length > 0 && hostArgs.every((a) => a.endsWith("'localhost'")) && hostArgs.length === (harness.match(/'-h',/g) || []).length);

console.log(`\ndb-harness guard: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
