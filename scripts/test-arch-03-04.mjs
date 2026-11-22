// ARCH-03 / ARCH-04 (product audit 2026-11-17) — every society on the posting service, the old client sale /
// purchase save removed; every update* path sends only the columns it changed.
// Run: node scripts/test-arch-03-04.mjs
import { register } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
    if (spec.startsWith('@/')) { const base = pathResolve(SRC, spec.slice(2)); for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base]) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = globalThis.__sb; export const supabaseLoose = supabase;' };
    return next(url, ctx);
  }
`));
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── ARCH-04: changedColumns / patchRow ──
{
  const calls = [];
  globalThis.__sb = { from: (t) => ({ update: (patch) => ({ eq: (c, v) => ({ select: () => ({ then: (f) => { calls.push({ t, patch, c, v }); return Promise.resolve(f({ data: v === 'gone' ? [] : [{ id: v }], error: null })); } }) }) }) }) };
  const R = await import(pathToFileURL(pathResolve(SRC, 'lib/rowPatch.ts')).href);
  const before = { id: 'm1', society_id: 'S', name: 'Ram', phone: '1', shareCapital: 500, tags: ['a'] };
  ok(JSON.stringify(R.changedColumns(before, { ...before, phone: '2' })) === '{"phone":"2"}', 'a phone fix sends the phone only — the stale share capital is NOT sent');
  ok(JSON.stringify(R.changedColumns(before, { ...before, tags: ['a', 'b'], society_id: 'X' })) === '{"tags":["a","b"]}', 'arrays compare by value; id / society_id are never sent');
  ok(Object.keys(R.changedColumns(before, { ...before, phone: undefined })).length === 0, 'undefined is left out exactly as JSON left it out of the upsert');
  ok(JSON.stringify(R.changedColumns({ ...before, parentId: 'g1', isGroup: true }, { ...before, parentId: null, isGroup: false })) === '{"parentId":null,"isGroup":false}', 'an explicit null / false (a cleared field) is sent');
  const r1 = await R.patchRow('members', 'm1', before, { ...before });
  ok(r1.error === null && calls.length === 0, 'nothing changed → no request at all');
  const r2 = await R.patchRow('members', 'm1', before, { ...before, phone: '9' });
  ok(r2.error === null && calls.length === 1 && calls[0].t === 'members' && calls[0].c === 'id' && JSON.stringify(calls[0].patch) === '{"phone":"9"}', 'one UPDATE … where id = m1 of the changed column');
  const r3 = await R.patchRow('members', 'gone', before, { ...before, phone: '9' });
  ok(r3.error && r3.error.message === R.ROW_NOT_UPDATED, '0 rows updated (row gone / RLS) is an error → the caller rolls back (RULE 1), never a silent success');
}

// ── ARCH-04: no update* path upserts the whole row any more ──
{
  const left = [];
  let patched = 0;
  for (const f of readdirSync(pathResolve(SRC, 'contexts')).filter((x) => x.endsWith('.tsx'))) {
    const s = read(`src/contexts/${f}`);
    for (const m of s.matchAll(/  const (update[A-Za-z]+) = useCallback\(/g)) {
      const body = s.slice(m.index, s.indexOf('\n  }, [', m.index));
      if (/supabase\.from\('[a-z_]+'\)\.upsert\(/.test(body)) left.push(`${f}:${m[1]}`);
      patched += (body.match(/patchRow\('/g) || []).length;
    }
  }
  ok(left.length === 1 && left[0] === 'DataContext.tsx:updateSociety', `only the society settings (one row, its own save path) still upsert — found: ${left.join(', ')}`);
  ok(patched === 32, `32 update writes go through patchRow (got ${patched})`);
  const dc = read('src/contexts/DataContext.tsx');
  ok(dc.includes("patchRow('accounts', id, before, row)") && dc.includes("if (data[k] === undefined) row[k] = k === 'isGroup' || k === 'isSystem' ? false : null;"), 'account edit: a cleared field still goes as null / false, and only changed columns are sent');
  ok(dc.includes("patchRow('loans', id, before, updatedBase)") && dc.includes("patchRow('salary_records', id, oldRecord, merged)") && dc.includes("patchRow('muster_entries', id, old, next)"), 'loans / salary / muster edits send changed columns');
}

// ── ARCH-03: posting service for everyone; the client sale / purchase save is gone ──
{
  const dc = read('src/contexts/DataContext.tsx');
  ok(dc.includes('const postingServiceRef = useRef(true);') && (dc.match(/postingServiceRef\.current = data\?\.posting_service !== false;/g) || []).length === 2 && !dc.includes('data?.posting_service === true'), 'a missing flag row / read error means ON; only an explicit false row turns it off');
  ok(!/const persistMovement = |const persistExtras = /.test(dc) && !/attempt(Sale|Purchase)(Save|Update)/.test(dc), 'the client-side sale / purchase save (3 + 2N requests) is removed');
  ok(!dc.includes('if (!server)') && !dc.includes('postingServiceRef.current ? { persistWith'), 'no stock-document write depends on the flag any more');
  ok((dc.match(/\}, \{ persistWith: \(v, ev, rollback\) => \{ viaServer = \{ v, ev, rollback \}; \} \}\);/g) || []).length === 4, 'add / edit of sale and purchase always save through the server (postStockDocument / postStockDocumentEdit)');
  ok((dc.match(/if \(!newVoucher\.id \|\| !server\) return \{ \.\.\.data, id: '' \}/g) || []).length === 2 && (dc.match(/if \(!newVoucher\.id \|\| !srv\) \{ undoLocal\(\); return null; \}/g) || []).length === 2, 'no voucher / no server payload → nothing saved, the edit is undone');
  ok(dc.includes("reportError('stock-document-no-event'") && dc.includes("    if (opts?.persistWith) {\n      rollbackOptimistic();"), 'a stock-document voucher without a ledger event is refused, never saved by the old path');
  for (const fn of ['deleteSale', 'deletePurchase']) {
    const a = dc.indexOf(`const ${fn} = useCallback(`);
    const body = dc.slice(a, dc.indexOf('\n  }, [', a));
    ok(body.includes('cancelStockDocument(') && !body.includes('postingServiceRef') && !body.includes(".update({ isDeleted: true })"), `${fn}: one server transaction only`);
  }
  for (const p of ['src/pages/SaleManagement.tsx', 'src/pages/PurchaseManagement.tsx', 'src/pages/consumer/RetailCounter.tsx']) ok(!read(p).includes('usesPostingService'), `${p}: the success toast comes from the server save only`);
  const m = read('supabase/migrations/191_posting_service_everyone.sql');
  ok(m.includes("select s.society_id::text, true, now(), 'ARCH-03 (191)'") && m.includes('where not exists (select 1 from public.society_flags f where f.society_id = s.society_id::text)'), '191 gives every society without a flag row an ON row');
  ok(m.includes('alter column posting_service set default true') && m.includes('where society_id = p_society_id), true);') && /values \('191', /.test(m), '191: default true; posting_service_on() reads a missing row as ON (the 105 guard cannot be skipped); registered');
  const d = read('supabase/migrations/191_posting_service_everyone_down.sql');
  ok(d.includes('set default false') && d.includes('p_society_id), false);') && d.includes("delete from public.app_migrations where version = '191'"), 'down restores the old default and function');
}

console.log(`ARCH-03/04: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
