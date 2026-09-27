#!/usr/bin/env node
// RM-31 · DB integration harness (Phase-3 S1, M1-1).
//
// Builds a THROWAWAY local Postgres from a production backup (pg_dump custom format), so
// migrations and RLS can be tested against the real schema, policies and data — never against
// production. Everything here is local: the target is refused unless it is localhost on a
// non-default port, and the cluster lives in a temp directory that `down` deletes.
//
//   node scripts/db-harness/harness.mjs up --dump <file.dump> [--dir <dir>] [--port 55432]
//   node scripts/db-harness/harness.mjs apply <migration.sql> [...]   (each file in one transaction)
//   node scripts/db-harness/harness.mjs smoke                         (RLS / tenant self-test)
//   node scripts/db-harness/harness.mjs down
//
// The backup holds real tenant data: keep it and the cluster directory out of git (this repo is
// public). Requires PostgreSQL client + server binaries (initdb, pg_ctl, pg_restore, psql):
// PG_BIN overrides the directory; on Windows it defaults to C:\Program Files\PostgreSQL\18\bin.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve as pathResolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PORT = 55432;
const STATE_FILE = pathResolve(tmpdir(), 'sahakarlekha-db-harness.json');

/** Supabase roles the production dump's grants and policies refer to. */
export const SUPABASE_ROLES = [
  'anon', 'authenticated', 'service_role', 'authenticator', 'supabase_admin',
  'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user', 'pgbouncer',
  'supabase_realtime_admin', 'supabase_read_only_user', 'supabase_replication_admin',
];

/** The harness only ever talks to a local throwaway cluster. */
export function assertLocalTarget(host, port) {
  if (!['localhost', '127.0.0.1', '::1'].includes(String(host))) {
    throw new Error(`db-harness: refused — host "${host}" is not local`);
  }
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1024 || p > 65535) throw new Error(`db-harness: refused — bad port ${port}`);
  if (p === 5432) throw new Error('db-harness: refused — 5432 is the default Postgres port (a real server may live there)');
  return { host: String(host), port: p };
}

export function pgBin(tool) {
  const dir = process.env.PG_BIN || (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\18\\bin' : '');
  const exe = process.platform === 'win32' ? `${tool}.exe` : tool;
  return dir ? join(dir, exe) : exe;
}

export function readState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : null;
}

function run(tool, args, opts = {}) {
  return execFileSync(pgBin(tool), args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
}

function psql(state, sql, db = 'harness') {
  assertLocalTarget('localhost', state.port);
  return run('psql', ['-h', 'localhost', '-p', String(state.port), '-U', 'postgres', '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-At', '-c', sql]);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}

function up() {
  const dump = arg('--dump');
  if (!dump || !existsSync(dump)) throw new Error('db-harness up: --dump <file.dump> is required');
  if (readState()) throw new Error('db-harness: a cluster is already up — run `down` first');
  const { port } = assertLocalTarget('localhost', arg('--port', DEFAULT_PORT));
  const dir = pathResolve(arg('--dir', join(tmpdir(), `sahakarlekha-db-harness-${port}`)));
  if (existsSync(dir)) throw new Error(`db-harness: ${dir} already exists — remove it or pass --dir`);
  mkdirSync(dir, { recursive: true });
  const state = { port, dir, data: join(dir, 'data'), dump: pathResolve(dump), startedAt: new Date().toISOString() };

  console.log(`db-harness: initdb → ${state.data}`);
  run('initdb', ['-D', state.data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale'], { stdio: 'ignore' });
  run('pg_ctl', ['-D', state.data, '-o', `-p ${port} -c listen_addresses=localhost`, '-l', join(dir, 'postgres.log'), '-w', 'start'], { stdio: 'ignore' });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  psql(state, 'create database harness', 'postgres');
  for (const r of SUPABASE_ROLES) {
    const attrs = r === 'service_role' ? ' bypassrls' : r === 'authenticator' ? ' login noinherit' : '';
    psql(state, `create role ${r}${attrs}`, 'postgres');
  }
  psql(state, 'grant anon, authenticated, service_role to authenticator', 'postgres');
  psql(state, 'create schema extensions; create extension if not exists "uuid-ossp" schema extensions; create extension if not exists pgcrypto schema extensions;');

  console.log('db-harness: pg_restore (owner → postgres, grants kept) …');
  let log = '';
  try {
    run('pg_restore', ['-h', 'localhost', '-p', String(port), '-U', 'postgres', '-d', 'harness', '--no-owner', state.dump], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    log = String(e.stderr || '');
  }
  writeFileSync(join(dir, 'restore.log'), log);
  const errors = (log.match(/error:/g) || []).length;
  const tables = Number(psql(state, "select count(*) from information_schema.tables where table_schema in ('public','auth','storage') and table_type = 'BASE TABLE'").trim());
  console.log(`db-harness: up on localhost:${port} — ${tables} tables, ${errors} restore error(s) (see ${join(dir, 'restore.log')})`);
}

function apply(files) {
  const state = readState();
  if (!state) throw new Error('db-harness: no cluster — run `up` first');
  if (!files.length) throw new Error('db-harness apply: pass one or more .sql files');
  for (const f of files) {
    assertLocalTarget('localhost', state.port);
    run('psql', ['-h', 'localhost', '-p', String(state.port), '-U', 'postgres', '-d', 'harness',
      '-v', 'ON_ERROR_STOP=1', '-X', '-q', '--single-transaction', '-f', pathResolve(f)], { stdio: 'inherit' });
    console.log(`db-harness: applied ${f}`);
  }
}

function down() {
  const state = readState();
  if (!state) { console.log('db-harness: nothing to stop'); return; }
  try { run('pg_ctl', ['-D', state.data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' }); } catch { /* already stopped */ }
  rmSync(state.dir, { recursive: true, force: true });
  rmSync(STATE_FILE, { force: true });
  console.log(`db-harness: stopped and removed ${state.dir}`);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'up') return up();
  if (cmd === 'apply') return apply(process.argv.slice(3).filter(a => !a.startsWith('--')));
  if (cmd === 'down') return down();
  if (cmd === 'smoke') return (await import('./smoke.mjs')).smoke();
  console.error('usage: harness.mjs up --dump <file> | apply <sql...> | smoke | down');
  process.exit(2);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

export const HERE = dirname(fileURLToPath(import.meta.url));
