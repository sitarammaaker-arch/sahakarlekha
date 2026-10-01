#!/usr/bin/env node
// Phase-2 A6 · tenant isolation across EVERY public table that has a society_id column, on the
// restored backup. As an admin of society S1 (a real JWT-claims session) against a second real society
// S2, for each table:
//   read    — no S2 row and no row of any other society is visible
//   update  — updating S2 rows touches 0 rows
//   delete  — deleting S2 rows touches 0 rows
//   insert  — inserting a copy of an S2 row (fresh id) is refused
//   move    — re-pointing an own row to S2 is refused
// and neither anon nor a signed-in stranger (no society_users row) sees any row of a tenant table. Everything runs in one rolled-back transaction.
// A write refused for a reason OTHER than RLS (a NOT NULL / check / trigger error) is reported as
// "inconclusive", never as a pass.
//
// Run: node scripts/db-harness/tests/a6-tenant-isolation.mjs

import { inRollback } from '../lib.mjs';

let pass = 0, fail = 0;
const inconclusive = [];
const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) pass++; else { fail++; failures.push(`${name}${extra ? ` — ${extra}` : ''}`); }
};
// Deny-all tables (no client grant at all) refuse with "permission denied" — that IS isolation.
const denied = (r) => !r.ok && /permission denied/i.test(r.error.message);
// Public INSERT by design (client error reports, the public feedback/review form); clients can never
// READ them (asserted below), so a foreign society_id there pollutes a log but leaks nothing (P3).
const PUBLIC_INSERT = new Set(['error_log', 'feedback']);
const rlsDenied = (r) => !r.ok && (r.error.code === '42501' || /row-level security/i.test(r.error.message));

await inRollback(async (tx) => {
  const tables = (await tx.query(`
    select c.table_name t, c.data_type ty,
           exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.table_name and k.column_name = 'id') has_id,
           (select data_type from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.table_name and k.column_name = 'id') id_ty
      from information_schema.columns c
      join pg_class cl on cl.relname = c.table_name and cl.relnamespace = 'public'::regnamespace and cl.relkind = 'r'
     where c.table_schema = 'public' and c.column_name = 'society_id'
     order by 1`)).rows;
  const socs = (await tx.query(`select society_id::text s from public.vouchers where society_id::text ~ '^[0-9a-f-]{36}$' group by 1 order by count(*) desc limit 2`)).rows.map((r) => r.s);
  const [S1, S2] = socs;
  const U = 'a6-admin@harness.test';
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, 'admin', 'A6', true)`, [S1, U]);
  const asU = () => tx.as({ email: U, user_role: 'admin' });
  const q = (t) => `public."${t}"`;
  let covered = 0;

  for (const { t, ty, has_id, id_ty } of tables) {
    await tx.asOwner();
    const n2 = Number((await tx.query(`select count(*) n from ${q(t)} where society_id::text = $1`, [S2])).rows[0].n);
    const own = (await tx.query(`select ctid::text c from ${q(t)} where society_id::text = $1 limit 1`, [S1])).rows[0]?.c;
    const sample = (await tx.query(`select to_jsonb(x) j from ${q(t)} x where society_id::text = $1 limit 1`, [S2])).rows[0]?.j;
    covered++;

    await asU();
    const foreign = await tx.attempt(`select count(*) n from ${q(t)} where society_id::text <> $1`, [S1]);
    ok(`${t}: read — no other society's rows`, denied(foreign) || (foreign.ok && Number(foreign.rows[0].n) === 0), foreign.ok ? `${foreign.rows[0].n} visible` : foreign.error.message);
    if (PUBLIC_INSERT.has(t)) {
      await asU();
      const all = await tx.attempt(`select count(*) n from ${q(t)}`);
      ok(`${t}: public-insert table is not client-readable`, denied(all) || (all.ok && Number(all.rows[0].n) === 0), all.ok ? `${all.rows[0].n} rows readable` : '');
    }

    if (n2 > 0) {
      await asU();
      const up = await tx.attempt(`update ${q(t)} set society_id = society_id where society_id::text = $1`, [S2]);
      ok(`${t}: update S2 rows touches 0`, !up.ok || up.rowCount === 0, `${up.rowCount} rows updated`);
      await asU();
      const del = await tx.attempt(`delete from ${q(t)} where society_id::text = $1`, [S2]);
      ok(`${t}: delete S2 rows touches 0`, !del.ok || del.rowCount === 0, `${del.rowCount} rows deleted`);
    }

    if (sample) {
      if (has_id) sample.id = id_ty === 'uuid' ? crypto.randomUUID() : (/int/.test(id_ty) ? undefined : `a6-${crypto.randomUUID()}`);
      if (sample.id === undefined) delete sample.id;
      await asU();
      const ins = await tx.attempt(`insert into ${q(t)} select * from jsonb_populate_record(null::${q(t)}, $1::jsonb)`, [JSON.stringify(sample)]);
      if (PUBLIC_INSERT.has(t)) { /* by design — see PUBLIC_INSERT */ }
      else if (rlsDenied(ins) || denied(ins)) ok(`${t}: insert into S2 refused`, true);
      else if (ins.ok) ok(`${t}: insert into S2 refused`, false, 'INSERTED a row for another society');
      else inconclusive.push(`${t} insert: ${ins.error.message.slice(0, 90)}`);
    }

    if (own) {
      await asU();
      const mv = await tx.attempt(`update ${q(t)} set society_id = $1::${ty === 'uuid' ? 'uuid' : 'text'} where ctid = $2::tid`, [S2, own]);
      if (rlsDenied(mv) || denied(mv) || (mv.ok && mv.rowCount === 0)) ok(`${t}: move own row to S2 refused`, true);
      else if (mv.ok) ok(`${t}: move own row to S2 refused`, false, 'MOVED an own row into another society');
      else inconclusive.push(`${t} move: ${mv.error.message.slice(0, 90)}`);
    }

    await tx.as({ email: 'a6-stranger@members.harness.test' });   // signed in, but no society_users row
    const st = await tx.attempt(`select count(*) n from ${q(t)}`);
    ok(`${t}: a signed-in stranger sees nothing`, denied(st) || (st.ok && Number(st.rows[0].n) === 0), st.ok ? `${st.rows[0].n} rows` : st.error.message);

    await tx.asAnon();
    const an = await tx.attempt(`select count(*) n from ${q(t)}`);
    ok(`${t}: anon sees nothing`, !an.ok || Number(an.rows[0].n) === 0, an.ok ? `${an.rows[0].n} rows` : '');
  }
  // Platform tables (no society_id): neither anon nor a signed-in stranger may change them.
  const platformWrites = [
    `insert into public.platform_admins (email, name) values ('a6-evil@x.in', 'E')`, `update public.platform_admins set is_active = true`, `delete from public.platform_admins`,
    `insert into public.societies (id, name) values (gen_random_uuid(), 'A6 Evil')`, `update public.societies set name = name`, `delete from public.societies`,
    `update public.rls_policy_backup set policy_name = policy_name`, `delete from public.rls_policy_backup`,
    `update public.guide_certificates set holder_name = 'X'`, `delete from public.guide_certificates`,
    `update public.leads set email = email`, `delete from public.leads`,
    `update public.catalog_versions set source = source`, `delete from public.catalog_versions`,
    `update public.blog_post_views set views = views + 1000`, `delete from public.blog_post_views`,
    `select * from public.user_mfa`, `select * from public.user_mfa_recovery`, `select * from public.mfa_verified_sessions`, `select * from public.app_migrations`,
  ];
  for (const sql of platformWrites) for (const [who, fn] of [['anon', () => tx.asAnon()], ['stranger', () => tx.as({ email: 'a6-stranger@members.harness.test' })]]) {
    await fn();
    const r = await tx.attempt(sql);
    ok(`${who}: ${sql.slice(0, 60)}`, !r.ok || r.rowCount === 0, `${r.rowCount} rows`);
  }

  console.log(`tables with society_id: ${covered} (S1 ${S1.slice(0, 8)}…, S2 ${S2.slice(0, 8)}…)`);
});

for (const f of failures) console.log(`  ✗ ${f}`);
if (inconclusive.length) { console.log(`\ninconclusive (refused, but not by RLS — review): ${inconclusive.length}`); for (const i of inconclusive) console.log(`  ? ${i}`); }
console.log(`\nA6 tenant isolation: ${pass} passed, ${fail} failed, ${inconclusive.length} inconclusive`);
process.exit(fail ? 1 : 0);
