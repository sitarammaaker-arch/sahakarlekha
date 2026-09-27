// RM-31 · helpers for tests that run against the local db-harness cluster.
//
// Every helper runs inside ONE transaction that is always rolled back, so a test can insert
// fixtures (e.g. a society_users row for a synthetic login) and exercise RLS as that user without
// leaving anything behind — even in the throwaway cluster.

import pg from 'pg';
import { assertLocalTarget, readState } from './harness.mjs';

export function harnessClient() {
  const state = readState();
  if (!state) throw new Error('db-harness: no cluster — run `node scripts/db-harness/harness.mjs up --dump <file>` first');
  const { host, port } = assertLocalTarget('localhost', state.port);
  return new pg.Client({ host, port, user: 'postgres', database: 'harness' });
}

/**
 * Run `fn(tx)` inside a transaction that is rolled back afterwards.
 * tx.as(claims)   → switch to the `authenticated` role with these JWT claims (auth.jwt()).
 * tx.asAnon()     → switch to the `anon` role with no claims.
 * tx.asOwner()    → back to the table owner (RLS bypassed) for fixtures / ground truth.
 * tx.attempt(sql, params) → run under a savepoint; returns { ok, rows, error } instead of throwing.
 */
export async function inRollback(fn) {
  const client = harnessClient();
  await client.connect();
  try {
    await client.query('begin');
    const tx = {
      query: (sql, params) => client.query(sql, params),
      async as(claims) {
        await client.query('reset role');
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'authenticated', ...claims })]);
        await client.query('set local role authenticated');
      },
      async asAnon() {
        await client.query('reset role');
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'anon' })]);
        await client.query('set local role anon');
      },
      async asOwner() {
        await client.query('reset role');
        await client.query("select set_config('request.jwt.claims', '', true)");
      },
      async attempt(sql, params) {
        await client.query('savepoint harness_attempt');
        try {
          const r = await client.query(sql, params);
          await client.query('release savepoint harness_attempt');
          return { ok: true, rows: r.rows, rowCount: r.rowCount };
        } catch (error) {
          await client.query('rollback to savepoint harness_attempt');
          return { ok: false, error };
        }
      },
    };
    return await fn(tx);
  } finally {
    await client.query('rollback').catch(() => {});
    await client.end();
  }
}
