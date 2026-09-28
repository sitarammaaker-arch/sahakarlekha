#!/usr/bin/env node
// M1-4c · seed public.account_roles from the reviewed role proposal (RM-05, needs migration 074).
//
// READS only (read-only transaction on the linked project, or the local db-harness) and writes a
// reviewed forward SQL + undo. It seeds ONLY the certain matches of proposeRoleMap
// (src/lib/accounting/roles.ts): basis 'matched' (exactly one candidate) or 'preferred_id' (the
// conventional id among look-alikes). Never seeded: 'ambiguous', 'missing', or a role whose proposal
// flagged an id collision without a match. Societies without settings (ghost tenants) are skipped.
// A review list (CSV) is written next to the SQL: society, role, account, basis — every row the SQL
// inserts — plus what was left out and why.
//
// Usage: node scripts/m1-4c-seed-roles.mjs --out <path-without-ext> [--source linked|harness] [--workdir <dir>]
// The files hold society and account names/ids — keep them out of git (this repo is public).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve as pathResolve } from 'node:path';
import { CHART_SQL, proposalsBySociety } from './m1-3-role-proposal.mjs';

export const SEEDED_BY = 'seed (M1-4c)';
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

/** PURE. Which proposals are seeded, and why the rest are not. */
export function selectSeeds(societies) {
  const seeds = [];
  const skipped = [];
  for (const s of societies) {
    if (!s.societyType) { skipped.push({ society: s.societyName || s.societyId, role: '*', reason: 'no society settings (ghost tenant)' }); continue; }
    for (const p of s.proposals) {
      if ((p.basis === 'matched' || p.basis === 'preferred_id') && p.accountId) {
        seeds.push({ societyId: s.societyId, societyName: s.societyName, role: p.role, accountId: p.accountId, accountName: p.accountName, basis: p.basis });
      } else {
        skipped.push({ society: s.societyName || s.societyId, role: p.role, reason: p.basis + (p.idCollision ? ` (id ${p.idCollision.id} is "${p.idCollision.name}")` : '') });
      }
    }
  }
  return { seeds, skipped };
}

/** PURE. Forward SQL: one transaction; refuses if a seeded society already has any role; post-check. */
export function buildSeedSql({ runAt, seeds }) {
  const socs = [...new Set(seeds.map((x) => x.societyId))];
  const rows = seeds.map((x) => `(${q(x.societyId)}, ${q(x.role)}, ${q(x.accountId)}, ${q(SEEDED_BY)})`).join(',\n');
  return `-- M1-4c account_roles SEED · ${seeds.length} roles for ${socs.length} societies · generated ${runAt}
-- Only certain matches (matched / preferred_id). ONE transaction; refuses if any of these societies already has roles.
begin;

do $chk$
declare n int;
begin
  select count(*) into n from public.account_roles where society_id in (${socs.map(q).join(', ') || "''"});
  if n > 0 then raise exception 'm1-4c: % roles already exist for these societies — nothing changed', n; end if;
end $chk$;

insert into public.account_roles (society_id, role, account_id, updated_by) values
${rows};

do $chk$
declare n int;
begin
  select count(*) into n from public.account_roles where updated_by = ${q(SEEDED_BY)};
  if n <> ${seeds.length} then raise exception 'm1-4c: post-check failed (% seeded) — rolled back', n; end if;
end $chk$;

commit;
`;
}

export function buildSeedUndoSql({ runAt }) {
  return `-- M1-4c account_roles SEED · UNDO · for the seed generated ${runAt}
begin;
delete from public.account_roles where updated_by = ${q(SEEDED_BY)};
commit;
`;
}

const csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const out = arg('--out'); const source = arg('--source', 'linked');
  if (!out) { console.error('usage: --out <path-without-ext> [--source linked|harness] [--workdir <dir>]'); process.exit(2); }
  let rows;
  if (source === 'harness') {
    const { harnessClient } = await import('./db-harness/lib.mjs');
    const c = harnessClient(); await c.connect();
    try { await c.query('begin transaction read only'); rows = (await c.query(CHART_SQL)).rows; await c.query('rollback'); } finally { await c.end(); }
  } else {
    const { runReadOnlyQuery } = await import('./rm02-diagnostics.mjs');
    rows = runReadOnlyQuery(CHART_SQL, arg('--workdir'));
  }
  const { seeds, skipped } = selectSeeds(proposalsBySociety(rows));
  const runAt = new Date().toISOString();
  const socs = new Set(seeds.map((x) => x.societyId));
  console.log(`m1-4c: ${seeds.length} roles to seed for ${socs.size} societies; ${skipped.length} left out (${source})`);
  const reasons = skipped.reduce((m, x) => { const k = x.reason.split(' ')[0]; m[k] = (m[k] || 0) + 1; return m; }, {});
  console.log(`  left out by reason: ${Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  writeFileSync(`${out}.sql`, buildSeedSql({ runAt, seeds }));
  writeFileSync(`${out}.undo.sql`, buildSeedUndoSql({ runAt }));
  writeFileSync(`${out}.review.csv`, csv(seeds, ['societyName', 'role', 'accountId', 'accountName', 'basis']));
  writeFileSync(`${out}.skipped.csv`, csv(skipped, ['society', 'role', 'reason']));
  console.log(`  wrote ${out}.sql, .undo.sql, .review.csv, .skipped.csv`);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
