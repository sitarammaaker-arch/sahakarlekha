#!/usr/bin/env node
// S2 (login read-load) · tables known to be empty for the society are not fetched — and nothing else changes.
// Pins: the helper is fail-safe (any failure → fetch everything), a skipped table resolves exactly like an
// empty fetch, only loaders that treat `[]` as ordinary are wired, and migration 151 reads under the
// caller's RLS. Run: node scripts/test-empty-table-skip.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as PR } from 'node:path';
import { readFileSync } from 'node:fs';
const root = PR(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = PR(root, 'src');
const STUB = 'data:text/javascript,' + encodeURIComponent(
  'export const supabase = { rpc: (...a) => globalThis.__rpc(...a) };');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: ${JSON.stringify(STUB)}, shortCircuit: true };
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    return next(spec, ctx);
  }`));
const m = await import(pathToFileURL(PR(SRC, 'lib/emptyTables.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

// ── pure: toEmptySet ─────────────────────────────────────────────────────────────────────────────
ok('error → skip nothing', m.toEmptySet(['procurement_crops'], { message: 'x' }).size === 0);
ok('non-array answer → skip nothing', m.toEmptySet('procurement_crops', null).size === 0 && m.toEmptySet(null, null).size === 0);
const s = m.toEmptySet(['procurement_crops', 'vouchers', 'accounts', 'ledger_events', 7, 'sales_returns'], null);
ok('keeps only skippable names (never a core table)', s.has('procurement_crops') && s.has('sales_returns') && s.size === 2);

// ── unlessEmpty: a skipped table resolves exactly like an empty fetch, without fetching ─────────
let calls = 0;
const fetcher = () => { calls++; return Promise.resolve({ data: [{ id: 1 }], error: null }); };
const skipped = await m.unlessEmpty(Promise.resolve(new Set(['procurement_crops'])), 'procurement_crops', fetcher);
ok('known-empty → { data: [], error: null }, no request', JSON.stringify(skipped) === '{"data":[],"error":null}' && calls === 0);
const fetched = await m.unlessEmpty(Promise.resolve(new Set(['procurement_crops'])), 'procurement_seasons', fetcher);
ok('anything else → fetched as before', fetched.data.length === 1 && calls === 1);

// ── fetchEmptyTables: fail-safe on every failure ─────────────────────────────────────────────────
let lastArgs = null;
globalThis.__rpc = (fn, args) => { lastArgs = { fn, args }; return Promise.resolve({ data: ['procurement_crops', 'vouchers'], error: null }); };
const got = await m.fetchEmptyTables('S1');
ok('calls society_empty_tables with the society + the skippable list', lastArgs.fn === 'society_empty_tables' && lastArgs.args.p_society_id === 'S1'
  && JSON.stringify(lastArgs.args.p_tables) === JSON.stringify([...m.SKIPPABLE_TABLES]));
ok('answer filtered to skippable names', got.has('procurement_crops') && !got.has('vouchers'));
globalThis.__rpc = () => Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'not found' } });
ok('function not deployed yet → skip nothing', (await m.fetchEmptyTables('S1')).size === 0);
globalThis.__rpc = () => Promise.reject(new Error('offline'));
ok('network failure → skip nothing (never rejects)', (await m.fetchEmptyTables('S1')).size === 0);

// ── wiring ───────────────────────────────────────────────────────────────────────────────────────
const dc = readFileSync(PR(SRC, 'contexts/DataContext.tsx'), 'utf8');
const wrapped = [...dc.matchAll(/unlessEmpty\(emptyP, '([a-z_]+)', \(\) => supabase\.from\('([a-z_]+)'\)/g)];
ok('DataContext: every side-load table wrapped, and only those', JSON.stringify(wrapped.map(w => w[1]).sort()) === JSON.stringify([...m.SIDE_LOAD_TABLES].sort())
  && wrapped.every(w => w[1] === w[2]));
ok('DataContext: no side-load left unwrapped', !/sideLoad\(supabase\.from\(/.test(dc));
ok('DataContext: the ask starts with the load (in parallel with the core tables)', /const loadFromSupabase = async \(\) => \{\s*try \{\s*const emptyP = knownEmptyTables\(sid\);/.test(dc));
const core = ['vouchers', 'members', 'accounts', 'loans', 'assets', 'audit_objections', 'stock_items', 'stock_movements', 'sales', 'purchases',
  'employees', 'salary_records', 'society_settings', 'suppliers', 'customers', 'kcc_loans', 'recoverables', 'kachi_aarat_entries', 'p7_entries',
  'member_identity', 'ledger_events'];
ok('core / member_identity / ledger_events are never skippable', core.every(t => !m.SKIPPABLE_TABLES.includes(t)));
for (const [file, list] of [['MarketingDataContext', m.MARKETING_TABLES], ['ConsumerDataContext', m.CONSUMER_TABLES]]) {
  const src = readFileSync(PR(SRC, `contexts/${file}.tsx`), 'utf8');
  const w = [...src.matchAll(/\[unlessEmpty\(empty, '([a-z_]+)', \(\) => fetchAllPaged<\w+>\('([a-z_]+)', sid\)\)/g)];
  ok(`${file}: every load table wrapped, names match`, JSON.stringify(w.map(x => x[1]).sort()) === JSON.stringify([...list].sort()) && w.every(x => x[1] === x[2]));
  ok(`${file}: no unwrapped load left`, !/\[fetchAllPaged</.test(src));
}

// ── migration 151 ────────────────────────────────────────────────────────────────────────────────
const sql = readFileSync(PR(root, 'supabase/migrations/151_society_empty_tables.sql'), 'utf8').replace(/--.*$/gm, '');
ok('151: SECURITY INVOKER + STABLE (reads under the caller\'s RLS, writes nothing)', /stable security invoker/i.test(sql) && !/security definer/i.test(sql));
ok('151: table names quoted from the catalog, unknown/unreadable tables never reported', /%I/.test(sql) && /continue when typ is null/.test(sql) && /exception when others then\s*continue/.test(sql));
ok('151: not callable by anon', /revoke all on function public\.society_empty_tables\(text, text\[\]\) from public, anon/.test(sql)
  && /grant execute on function public\.society_empty_tables\(text, text\[\]\) to authenticated/.test(sql));

console.log(`\nEmpty-table skip: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
