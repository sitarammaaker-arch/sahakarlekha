// pay-apply.mjs — apply payroll SQL files to a target Postgres/Supabase, each in its own
// transaction (a failing file rolls back cleanly and stops the run). Used for staging
// deploy + verification + rollback of the payroll schema (supabase/migrations/payroll/*).
//
// Connection: reads DATABASE_URL from the environment, or from a gitignored
// .env.staging.local at the repo root (never commit that file).
//
// Usage:
//   node scripts/pay-apply.mjs supabase/migrations/payroll/1*.sql          # apply 100..113 (shell-sorted)
//   node scripts/pay-apply.mjs supabase/migrations/payroll/VERIFICATION.sql
//   node scripts/pay-apply.mjs supabase/migrations/payroll/999_pay_rollback_all.sql
//
// A file that manages its own transaction (e.g. VERIFICATION.sql, which does begin;…rollback;)
// is detected and run as-is rather than being wrapped.

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

function loadDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.resolve(process.cwd(), '.env.staging.local');
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim();
  }
  return '';
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node scripts/pay-apply.mjs <file.sql> [more.sql ...]');
  process.exit(64);
}
const url = loadDbUrl();
if (!url) {
  console.log('SKIP  pay-apply — no DATABASE_URL (set it, or create a gitignored .env.staging.local).');
  process.exit(0);
}

// self-managed = the file opens its own transaction (don't wrap it in begin/commit)
const selfManaged = (sql) => /^\s*begin\s*;/im.test(sql) && /\brollback\s*;/im.test(sql);

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  query_timeout: 180000,
});

try {
  await client.connect();
  for (const f of files) {
    const sql = fs.readFileSync(f, 'utf8');
    const base = path.basename(f);
    try {
      if (selfManaged(sql)) {
        await client.query(sql);
        console.log('  ✓ ran   ', base, '(self-managed transaction)');
      } else {
        await client.query('begin');
        await client.query(sql);
        await client.query('commit');
        console.log('  ✓ applied', base);
      }
    } catch (e) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      console.error('  ✗ FAILED', base, '::', e.message);
      if (e.position) {
        const p = Number(e.position);
        console.error('    near:', JSON.stringify(sql.slice(Math.max(0, p - 90), p + 90)));
      }
      await client.end();
      process.exit(2);
    }
  }
  await client.end();
  console.log(`ALL OK (${files.length} file(s))`);
} catch (e) {
  console.error('CONNECT/RUN ERROR:', e.message);
  process.exit(3);
}
