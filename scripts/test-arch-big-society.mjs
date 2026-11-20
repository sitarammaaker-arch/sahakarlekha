// ARCH-01 / ARCH-02 / MKT-01 / ARCH-04 (product audit 2026-11-17) — what breaks as a society grows.
//   ARCH-01  localStorage.setItem past the ~5 MB quota THREW inside the load (fresh data replaced by the stale cache,
//            entry blocked) or inside a state updater (white screen) → a write that does not fit is dropped and the
//            stale key removed; the app keeps working from the cloud.
//   ARCH-02 / MKT-01  15 side tables loaded with a plain select (Supabase returns 1,000 rows, the rest vanish) → paged.
//   ARCH-04  updateMember upserted the WHOLE row from the login-time snapshot (a stale tab overwrote newer values) →
//            only the columns this edit changed are sent.
// Run: node scripts/test-arch-big-society.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── ARCH-01: run the real storage setter against a full localStorage ──
{
  const src = read('src/lib/storage.ts');
  const set = src.slice(src.indexOf('const quotaWarned = new Set<string>();'), src.indexOf('export const getVouchers'));
  const store = new Map([['vouchers', '[stale]']]);
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { if (v.length > 20) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } store.set(k, v); },
    removeItem: (k) => store.delete(k),
  };
  const warns = [];
  const origWarn = console.warn; console.warn = (m) => warns.push(m);
  // eslint-disable-next-line no-new-func
  const js = set.replace('new Set<string>()', 'new Set()').replace(/function set<T>\(key: string, value: T\): void/, 'function set(key, value)');
  const setFn = new Function(`${js}; return set;`)();
  let threw = false;
  try { setFn('vouchers', ['x'.repeat(50)]); setFn('vouchers', ['y'.repeat(50)]); } catch { threw = true; }
  console.warn = origWarn;
  ok(!threw, 'a write past the quota does not throw (no blocked load, no white screen)');
  ok(!store.has('vouchers'), 'the stale cached copy of that key is removed, so it is never read back');
  ok(warns.length === 1, 'warned once per key, not on every write');
  setFn('members', [1]);
  ok(store.get('members') === '[1]', 'a write that fits is still cached');
}

// ── ARCH-02 / MKT-01 ──
{
  const dc = read('src/contexts/DataContext.tsx');
  const paged = ['deposit_accounts', 'deposit_transactions', 'compliance_filings', 'procurement_farmers', 'procurement_lots', 'procurement_events', 'procurement_quality_tests',
    'procurement_moisture_records', 'procurement_jforms', 'procurement_financial_intents', 'procurement_posting_requests', 'procurement_posting_rule_results',
    'procurement_settlements', 'work_orders', 'muster_entries'];
  for (const t of paged) {
    ok(dc.includes(`() => fetchAllPaged('${t}'))`) && !dc.includes(`supabase.from('${t}').select('*').eq('society_id', sid))`), `${t} loads every page (no silent 1,000-row cut)`);
  }
  const pager = read('src/lib/supabasePaging.ts');
  ok(/\.range\(from, from \+ PAGE - 1\)/.test(pager) && pager.includes("orderBy: string[] = ['id']"), 'the pager ranges through pages in a total (id) order');
}

// ── ARCH-04 ──
{
  const dc = read('src/contexts/DataContext.tsx');
  const um = dc.slice(dc.indexOf('const updateMember = useCallback('), dc.indexOf('attemptMemberUpdate(updatedMember);', dc.indexOf('const updateMember = useCallback(')));
  ok(um.includes("if (k === 'id' || k === 'society_id' || !(k in data)) continue;") && um.includes('if (JSON.stringify(v ?? null) !== JSON.stringify(before[k] ?? null)) patch[k] = v;'), 'only the base columns this edit touched AND changed are sent');
  ok(um.includes("supabase.from('members').update(patch).eq('id', id).select('id')") && !um.includes("supabase.from('members').upsert(memberRow(payload))"), 'an update of those columns, never a whole-row upsert');
  ok(um.includes("!rows?.length ? { message:"), 'zero rows updated is a failure (rolled back), not a silent success');
  ok(um.includes('Object.keys(patch).length === 0') && um.includes('Promise.resolve({ error: null'), 'an edit of side-table fields only (profile, contact, PII) does not touch the base row');
  ok(um.includes('setMembersState(prev => prev.map(m => m.id === id ? oldMember : m));'), 'a refused update still rolls the screen back (RULE 1)');
}

console.log(`ARCH big-society: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
