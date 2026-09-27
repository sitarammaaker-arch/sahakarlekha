#!/usr/bin/env node
// RM-02 · per-society pre-flight diagnostic runner (Phase-3 S0 gate, M1-0).
//
// READ-ONLY. Runs scripts/rm02/diagnostics.sql against the Supabase project this checkout is
// linked to (`supabase link`), inside `begin transaction read only; …; rollback;`, and writes
// the per-society rows to a JSON file. It never writes to the database: the SQL is checked for
// write keywords before it is sent, and the transaction itself is read-only.
//
// Usage (from a checkout that is `supabase link`ed):
//   node scripts/rm02-diagnostics.mjs --out <file.json> [--workdir <linked checkout>]
// The output holds society names and counts — keep it out of git.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SQL_PATH = pathResolve(HERE, 'rm02/diagnostics.sql');

const WRITE_WORDS = /\b(insert|update|delete|merge|upsert|alter|drop|truncate|create|grant|revoke|comment|vacuum|copy|call|do|execute|lock|refresh|reindex|cluster|set|reset|begin|commit|rollback|savepoint)\b/i;

/** Strip SQL comments and string literals so keywords inside them don't count. */
export function sqlCode(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
}

/** Throws unless `sql` is a single read-only WITH/SELECT statement; returns it without comments. */
export function assertReadOnlySql(sql) {
  const code = sqlCode(sql).trim().replace(/;\s*$/, '');
  if (!/^(with|select)\b/i.test(code)) throw new Error('RM-02: SQL must start with WITH or SELECT');
  if (code.includes(';')) throw new Error('RM-02: SQL must be a single statement');
  const hit = code.match(WRITE_WORDS);
  if (hit) throw new Error(`RM-02: refused — non-read keyword "${hit[0]}"`);
  return sql.replace(/--[^\n]*/g, '').trim().replace(/;\s*$/, '');
}

export function wrapReadOnly(code) {
  return `begin transaction read only; ${code}; rollback;`;
}

function main() {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : null;
  if (!out) {
    console.error('usage: node scripts/rm02-diagnostics.mjs --out <file.json>');
    process.exit(2);
  }
  const w = process.argv.indexOf('--workdir');
  const workdir = w > 0 ? ['--workdir', process.argv[w + 1]] : [];
  const query = assertReadOnlySql(readFileSync(SQL_PATH, 'utf8'));
  // Passed as a file: the query is longer than the Windows command-line limit.
  const dir = mkdtempSync(pathResolve(tmpdir(), 'rm02-'));
  const file = pathResolve(dir, 'query.sql');
  writeFileSync(file, wrapReadOnly(query));
  let raw;
  try {
    raw = execFileSync(
      'npx', ['--no-install', 'supabase', 'db', 'query', '--linked', ...workdir, '--file', file, '-o', 'json'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'inherit'] },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const parsed = JSON.parse(raw.slice(raw.indexOf('{')));
  const rows = parsed.rows || [];
  writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), rows }, null, 2));

  const flag = (r) => [
    !r.fy_label_valid && 'FY label',
    r.fy_prev_equals_current && 'prev FY = FY',
    r.vouchers_outside_fy > 0 && `${r.vouchers_outside_fy} FY के बाहर`,
    r.vouchers_before_2000 > 0 && `${r.vouchers_before_2000} पुरानी तारीख़`,
    r.auto_member_with_other_posting > 0 && `${r.auto_member_with_other_posting} auto voucher + दूसरी posting`,
    r.auto_member_dup_member_kinds > 0 && `${r.auto_member_dup_member_kinds} auto-duplicate`,
    Number(r.share_register) !== Number(r.gl_share_capital) && `share register ${r.share_register} ≠ GL 1102 (${r.acc_1102_name || 'account नहीं'}) ${r.gl_share_capital}`,
    r.unbalanced_vouchers > 0 && `${r.unbalanced_vouchers} unbalanced`,
    r.orphan_leg_vouchers > 0 && `${r.orphan_leg_vouchers} orphan leg`,
    r.live_without_posting > 0 && `${r.live_without_posting} journal नहीं`,
    r.cancelled_with_live_posting > 0 && `${r.cancelled_with_live_posting} cancel-drift`,
    r.dup_account_groups > 0 && `${r.dup_account_groups} duplicate account groups`,
  ].filter(Boolean).join(', ') || '—';
  console.log(`RM-02: ${rows.length} societies → ${out}`);
  for (const r of rows) console.log(`  ${String(r.society_name || r.society_id).slice(0, 40).padEnd(40)} ${String(r.vouchers_live).padStart(5)} vouchers · ${flag(r)}`);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
