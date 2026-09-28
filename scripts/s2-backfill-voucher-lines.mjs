#!/usr/bin/env node
// S2 · back-fill public.voucher_lines from the existing vouchers (RM-04, needs migration 076).
//
// READS only (read-only transaction on the linked project, or the local db-harness) and writes a
// reviewed forward SQL + undo. Lines come from the app's OWN posting rule — getVoucherLines, the
// function reports and voucher_entries use (RULE 2) — amounts in paise via money.toMinor. Each line
// gets the financial year whose dates contain the voucher date. Live, non-pending vouchers only.
// Nothing is written if any voucher is unbalanced in paise or any date has no financial year.
//
// Usage: node scripts/s2-backfill-voucher-lines.mjs --out <path-without-ext> [--society <id>]
//          [--exclude-society <id> ...] [--source linked|harness] [--workdir <linked checkout>]
// The SQL holds society and voucher ids — keep it out of git (this repo is public).

import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));

export const SOURCE = 'backfill';
const q = (s) => (s === null || s === undefined || s === '' ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

/**
 * PURE. Lines for one society's vouchers. `getVoucherLines` / `toMinor` are injected (the app's
 * own implementations in production use; fixtures in tests). `fys` = that society's financial years.
 */
export function buildLines(vouchers, fys, { getVoucherLines, toMinor }) {
  const lines = [];
  const problems = [];
  const fyFor = (d) => fys.find((f) => d >= f.start_date && d <= f.end_date);
  for (const v of vouchers) {
    if (v.isDeleted || v.approvalStatus === 'pending') continue;
    const date = String(v.date || '').slice(0, 10);
    const fy = fyFor(date);
    if (!fy) { problems.push(`${v.voucherNo || v.id}: no financial year contains ${date}`); continue; }
    const legs = getVoucherLines(v);
    let dr = 0, cr = 0;
    const out = legs.map((l, i) => {
      const minor = toMinor(Number(l.amount) || 0);
      if (l.type === 'Dr') dr += minor; else cr += minor;
      return {
        id: `${v.id}-${l.id}`, society_id: String(v.society_id), voucher_id: v.id, fy_id: fy.id, line_no: i + 1,
        account_id: l.accountId, dr_minor: l.type === 'Dr' ? minor : 0, cr_minor: l.type === 'Cr' ? minor : 0,
        narration: l.narration ?? null, work_order_id: v.workOrderId ?? null, cost_centre_id: v.costCentreId ?? null,
        branch_id: v.branchId ?? null, entry_date: date,
      };
    });
    if (out.length === 0) { problems.push(`${v.voucherNo || v.id}: no posting legs`); continue; }
    if (dr !== cr) { problems.push(`${v.voucherNo || v.id}: unbalanced Dr ${dr} ≠ Cr ${cr} paise`); continue; }
    lines.push(...out);
  }
  return { lines, problems };
}

/** PURE. Forward SQL — one transaction; refuses if any planned line exists; post-checks count and balance. */
export function buildBackfillSql({ runAt, lines, scopeLabel }) {
  const n = lines.length;
  const cols = 'id, society_id, voucher_id, fy_id, line_no, account_id, dr_minor, cr_minor, narration, work_order_id, cost_centre_id, branch_id, entry_date, status, source';
  const chunks = [];
  for (let i = 0; i < lines.length; i += 500) {
    const rows = lines.slice(i, i + 500).map((l) => `(${[q(l.id), q(l.society_id), q(l.voucher_id), q(l.fy_id), l.line_no, q(l.account_id), l.dr_minor, l.cr_minor, q(l.narration), q(l.work_order_id), q(l.cost_centre_id), q(l.branch_id), q(l.entry_date), "'posted'", q(SOURCE)].join(', ')})`).join(',\n');
    chunks.push(`insert into public.voucher_lines (${cols}) values\n${rows};`);
  }
  const vids = [...new Set(lines.map((l) => l.voucher_id))];
  return `-- S2 voucher_lines BACKFILL · ${scopeLabel} · ${n} lines for ${vids.length} vouchers · generated ${runAt}
-- ONE transaction; refuses if any planned line already exists; post-checks count, per-voucher balance and FY dates.
begin;

create temporary table s2_vouchers (id text primary key) on commit drop;
insert into s2_vouchers (id) values
  ${vids.map((v) => `(${q(v)})`).join(',\n  ')};

do $chk$
declare n int;
begin
  select count(*) into n from public.voucher_lines l join s2_vouchers t on t.id = l.voucher_id;
  if n > 0 then raise exception 's2-backfill: % lines already exist for the planned vouchers — nothing changed', n; end if;
end $chk$;

${chunks.join('\n\n')}

do $chk$
declare n int; unbalanced int; outside int;
begin
  select count(*) into n from public.voucher_lines l join s2_vouchers t on t.id = l.voucher_id;
  select count(*) into unbalanced from (
    select l.voucher_id from public.voucher_lines l join s2_vouchers t on t.id = l.voucher_id
    group by l.voucher_id having sum(l.dr_minor) <> sum(l.cr_minor)) x;
  select count(*) into outside from public.voucher_lines l join s2_vouchers t on t.id = l.voucher_id
    join public.financial_years f on f.id = l.fy_id where l.entry_date not between f.start_date and f.end_date;
  if n <> ${n} or unbalanced > 0 or outside > 0 then
    raise exception 's2-backfill: post-check failed (lines %, unbalanced vouchers %, lines outside their FY %) — rolled back', n, unbalanced, outside;
  end if;
end $chk$;

commit;
`;
}

export function buildBackfillUndoSql({ runAt, societyId }) {
  return `-- S2 voucher_lines BACKFILL · UNDO · for the forward fix generated ${runAt}
begin;
delete from public.voucher_lines where source = '${SOURCE}'${societyId ? ` and society_id = ${q(societyId)}` : ''};
commit;
`;
}

async function read(sql, source, workdir) {
  if (source === 'harness') {
    const { harnessClient } = await import('./db-harness/lib.mjs');
    const c = harnessClient(); await c.connect();
    try { await c.query('begin transaction read only'); const r = (await c.query(sql)).rows; await c.query('rollback'); return r; } finally { await c.end(); }
  }
  const { runReadOnlyQuery } = await import('./rm02-diagnostics.mjs');
  return runReadOnlyQuery(sql, workdir);
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const out = arg('--out'); const source = arg('--source', 'linked'); const soc = arg('--society');
  if (!out) { console.error('usage: --out <path> [--society <id>] [--exclude-society <id> ...] [--source linked|harness] [--workdir <dir>]'); process.exit(2); }
  const esc = (s) => s.replace(/'/g, "''");
  const f = soc ? ` and society_id::text = '${esc(soc)}'` : '';
  const vouchers = (await read(`select to_jsonb(v) as r from vouchers v where not coalesce(v."isDeleted", false)${f.replace('society_id', 'v.society_id')}`, source, arg('--workdir'))).map((x) => x.r);
  const fyRows = await read(`select id::text, society_id, start_date::text, end_date::text from financial_years where true${f}`, source, arg('--workdir'));
  const { getVoucherLines } = await import(pathToFileURL(pathResolve(SRC, 'lib/voucherUtils.ts')).href);
  const { toMinor } = await import(pathToFileURL(pathResolve(SRC, 'lib/money.ts')).href);

  // --exclude-society <id> (repeatable): a society whose FY row lags its vouchers (076 NOTICE) stays
  // out of S2 until its FY is fixed. Explicit on purpose — problems anywhere else still stop the run.
  const excluded = new Set(process.argv.flatMap((a, i) => (a === '--exclude-society' ? [process.argv[i + 1]] : [])));
  const bySoc = new Map();
  for (const v of vouchers) (bySoc.get(String(v.society_id)) ?? bySoc.set(String(v.society_id), []).get(String(v.society_id))).push(v);
  const all = []; const problems = []; const skipped = [];
  for (const [sid, vs] of bySoc) {
    if (excluded.has(sid)) { skipped.push(`${sid} (${vs.length} vouchers)`); continue; }
    const r = buildLines(vs, fyRows.filter((x) => String(x.society_id) === sid), { getVoucherLines, toMinor });
    all.push(...r.lines); problems.push(...r.problems.map((p) => `[${sid.slice(0, 8)}] ${p}`));
  }
  console.log(`s2-backfill: ${vouchers.length} live vouchers in ${bySoc.size} societies (${source})`);
  if (skipped.length) console.log(`  EXCLUDED (not back-filled): ${skipped.join(', ')}`);
  console.log(`  lines: ${all.length}`);
  if (problems.length) { console.log(`  PROBLEMS (${problems.length}) — no SQL written:`); problems.slice(0, 20).forEach((p) => console.log(`    • ${p}`)); process.exit(1); }
  const runAt = new Date().toISOString();
  writeFileSync(`${out}.sql`, buildBackfillSql({ runAt, lines: all, scopeLabel: soc ? `society ${soc}` : 'all societies' }));
  writeFileSync(`${out}.undo.sql`, buildBackfillUndoSql({ runAt, societyId: soc }));
  console.log(`  wrote ${out}.sql and ${out}.undo.sql`);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
