#!/usr/bin/env node
// Align the stock_items.currentStock CACHE with the canonical quantity (RULE 2, approved 2026-09-30).
//
// currentStock is only a denormalised cache — every screen derives quantity with the app's ONE formula,
// computeStockMap(items, reconcileMovements(movements, sales, purchases)) (src/lib/stockUtils.ts). The
// cache drifted (e.g. Rania "Gurh 500 Gram": cache 195, canonical 1 — prod, 2026-09-30) because the old
// incremental ± updates lose information. This computes the canonical quantity with THOSE app functions
// and sets the cache to it. Nothing else changes: no movement, no document, no voucher.
//
// READS only (read-only transaction on the linked project, or the local db-harness) and writes:
//   <out>.sql       one self-checking transaction; logs every changed item's old cache to data_fix_log
//   <out>.undo.sql  puts exactly the logged old values back
//
// Usage: node scripts/heal-stock-cache.mjs --out <path-without-ext> [--fix <id>] [--source linked|harness] [--workdir <dir>]
// The SQL holds society and item ids — keep it out of git (this repo is public).

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
const { computeStockMap, reconcileMovements } = await import(pathToFileURL(pathResolve(SRC, 'lib/stockUtils.ts')).href);

export let FIX = 'stock-cache-reconcile';
export function setFix(id) { if (!/^[a-z0-9-]+$/.test(id)) throw new Error('fix id: lowercase letters, digits and dashes only'); FIX = id; }
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
/** Quantities to 6 decimals — the JS sum of fractional qtys leaves float noise (0.045000000000015916). */
const q6 = (x) => Math.round(num(x) * 1e6) / 1e6;
const same = (a, b) => q6(a) === q6(b);

/**
 * PURE. Per society: canonical quantity with the app's own functions; returns the items whose cache differs.
 * rows: { items, movements, sales, purchases } each an array of DB rows (society_id on every row).
 */
export function planStockCache({ items, movements, sales, purchases }) {
  const bySoc = (arr) => { const m = new Map(); for (const r of arr) { const k = String(r.society_id); (m.get(k) ?? m.set(k, []).get(k)).push(r); } return m; };
  const I = bySoc(items), M = bySoc(movements), S = bySoc(sales), P = bySoc(purchases);
  const changes = [];
  for (const [sid, its] of I) {
    const norm = its.map((i) => ({ ...i, openingStock: num(i.openingStock) }));
    const mv = (M.get(sid) ?? []).map((m) => ({ ...m, qty: num(m.qty) }));
    const sl = (S.get(sid) ?? []).map((s) => ({ ...s, items: (Array.isArray(s.items) ? s.items : []).map((x) => ({ ...x, qty: num(x.qty) })) }));
    const pu = (P.get(sid) ?? []).map((p) => ({ ...p, items: (Array.isArray(p.items) ? p.items : []).map((x) => ({ ...x, qty: num(x.qty) })) }));
    const canon = computeStockMap(norm, reconcileMovements(mv, sl, pu));
    for (const i of its) {
      const want = q6(canon[i.id] ?? Math.max(0, num(i.openingStock)));
      if (!same(i.currentStock, want)) changes.push({ society_id: sid, id: i.id, name: i.name, from: i.currentStock === null ? null : num(i.currentStock), to: want });
    }
  }
  return changes;
}

/** PURE. Forward SQL: refuse a re-apply, re-check each old value, log, update, verify — one transaction. */
export function buildStockCacheSql({ runAt, changes }) {
  const summary = changes.map((c) => `--   ${String(c.society_id).slice(0, 8)} ${c.name}: ${c.from} → ${c.to}`).join('\n');
  const checks = changes.map((c) => `  select count(*) into n from public.stock_items where id = ${q(c.id)} and society_id::text = ${q(c.society_id)} and "currentStock" is not distinct from ${c.from === null ? 'null' : c.from};
  if n <> 1 then raise exception '${FIX}: ${String(c.name).replace(/'/g, "''")} changed since the plan — re-plan; nothing changed'; end if;`).join('\n');
  const log = changes.map((c) => `(${q(FIX)}, ${q(c.society_id)}, 'stock_item_current_stock', ${q(c.id)}, jsonb_build_object('currentStock', ${c.from === null ? 'null' : c.from}::numeric, 'to', ${c.to}::numeric))`).join(',\n');
  const updates = changes.map((c) => `update public.stock_items set "currentStock" = ${c.to} where id = ${q(c.id)} and society_id::text = ${q(c.society_id)};`).join('\n');
  const post = changes.map((c) => `(${q(c.id)}, ${q(c.society_id)}, ${c.to}::numeric)`).join(',\n    ');
  return `-- ${FIX} · FORWARD · ${changes.length} stock_items.currentStock values set to the canonical quantity · generated ${runAt}
-- Cache only: no movement, document or voucher changes. ONE transaction; any failed check aborts with nothing changed.
${summary}
begin;

create table if not exists public.data_fix_log (
  id bigserial primary key, fix text not null, society_id text not null, entity text not null,
  entity_id text not null, old_row jsonb not null, logged_at timestamptz not null default now()
);
alter table public.data_fix_log enable row level security;
revoke all on public.data_fix_log from anon, authenticated;

do $chk$
declare n int;
begin
  select count(*) into n from public.data_fix_log where fix = ${q(FIX)};
  if n > 0 then raise exception '${FIX}: already applied — nothing changed'; end if;
${checks}
end $chk$;

insert into public.data_fix_log (fix, society_id, entity, entity_id, old_row) values
${log};

${updates}

do $chk$
declare bad int;
begin
  select count(*) into bad from (values
    ${post}) as w(id, sid, want)
  join public.stock_items s on s.id = w.id and s.society_id::text = w.sid
  where s."currentStock" is distinct from w.want;
  if bad > 0 then raise exception '${FIX}: post-check failed for % items — rolled back', bad; end if;
end $chk$;

commit;
`;
}

export function buildStockCacheUndoSql({ runAt }) {
  return `-- ${FIX} · UNDO · for the forward fix generated ${runAt}
begin;
update public.stock_items s set "currentStock" = (l.old_row ->> 'currentStock')::numeric
  from public.data_fix_log l
 where l.fix = ${q(FIX)} and l.entity = 'stock_item_current_stock' and s.id = l.entity_id and s.society_id::text = l.society_id;
delete from public.data_fix_log where fix = ${q(FIX)};
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
  const out = arg('--out'); const source = arg('--source', 'linked'); const wd = arg('--workdir');
  if (arg('--fix')) setFix(arg('--fix'));
  if (!out) { console.error('usage: --out <path> [--fix <id>] [--source linked|harness] [--workdir <dir>]'); process.exit(2); }
  const rows = async (sql) => (await read(sql, source, wd)).map((x) => x.r);
  const items = await rows(`select jsonb_build_object('id', id, 'society_id', society_id::text, 'name', name, 'openingStock', "openingStock", 'currentStock', "currentStock") r from public.stock_items`);
  const movements = await rows(`select jsonb_build_object('id', id, 'society_id', society_id::text, 'itemId', "itemId", 'type', type, 'qty', qty, 'referenceNo', "referenceNo", 'date', date) r from public.stock_movements`);
  const sales = await rows(`select jsonb_build_object('id', id, 'society_id', society_id::text, 'saleNo', "saleNo", 'date', date, 'items', items, 'isDeleted', coalesce("isDeleted", false)) r from public.sales`);
  const purchases = await rows(`select jsonb_build_object('id', id, 'society_id', society_id::text, 'purchaseNo', "purchaseNo", 'date', date, 'items', items, 'isDeleted', coalesce("isDeleted", false)) r from public.purchases`);
  const changes = planStockCache({ items, movements, sales, purchases });
  const runAt = new Date().toISOString();
  console.log(`${FIX}: ${items.length} items (${source}) → ${changes.length} cache values to fix`);
  const bySoc = {};
  for (const c of changes) (bySoc[String(c.society_id).slice(0, 8)] ??= []).push(`${c.name} ${c.from}→${c.to}`);
  for (const [s, list] of Object.entries(bySoc)) console.log(`  ${s}: ${list.length}  [${list.join(', ')}]`);
  if (!changes.length) { console.log('  nothing to fix — no SQL written'); return; }
  writeFileSync(`${out}.sql`, buildStockCacheSql({ runAt, changes }));
  writeFileSync(`${out}.undo.sql`, buildStockCacheUndoSql({ runAt }));
  console.log(`  wrote ${out}.sql and ${out}.undo.sql`);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
