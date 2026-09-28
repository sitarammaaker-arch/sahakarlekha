#!/usr/bin/env node
// RM-01 phantom cancel · end-to-end on the restored backup: plan with scripts/rm01-phantom-cancel.mjs
// (reading the harness), apply the forward SQL exactly as the SQL Editor would, check every effect
// against the app's own journal projection, prove a re-run refuses, then apply the undo and prove
// vouchers / voucher_entries / ledger_events are byte-identical to before.
//
// Run (harness up): node scripts/db-harness/tests/rm01-phantom-cancel.mjs

import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve, join } from 'node:path';
import { inRollback } from '../lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '../../..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));
const { projectTrialBalance } = await import(pathToFileURL(pathResolve(SRC, 'lib/ledger/projections.ts')).href);

const harness = pathResolve(HERE, '../harness.mjs');
const apply = (file) => execFileSync(process.execPath, [harness, 'apply', file], { stdio: 'pipe' });
const tryApply = (file) => { try { apply(file); return { ok: true }; } catch (e) { return { ok: false, err: String(e.stderr || e.message) }; } };

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const LOOP = `"createdBy" = 'System' and "memberId" is not null and (narration like 'Share Capital received from%' or narration like 'Admission Fee received from%')`;
const sid = (await inRollback((tx) => tx.query(`select society_id::text as s from public.vouchers where not coalesce("isDeleted", false) and ${LOOP} group by 1 order by count(*) desc limit 1`))).rows[0].s;

const snap = () => inRollback(async (tx) => {
  const h = async (sql) => (await tx.query(sql, [sid])).rows[0].h;
  const events = (await tx.query(`select event_type, payload from public.ledger_events where society_id::text = $1`, [sid])).rows;
  const tb = Object.fromEntries(projectTrialBalance(events.map((e) => ({ eventType: e.event_type, payload: e.payload }))).lines.map((l) => [l.accountId, l.netMinor]));
  return {
    vouchers: await h(`select md5(string_agg(to_jsonb(v)::text, '|' order by v.id)) as h from public.vouchers v where v.society_id::text = $1`),
    entries: await h(`select md5(string_agg(to_jsonb(e)::text, '|' order by e.id)) as h from public.voucher_entries e where e.society_id::text = $1`),
    events: await h(`select md5(string_agg(to_jsonb(e)::text, '|' order by e.event_id)) as h from public.ledger_events e where e.society_id::text = $1`),
    members: await h(`select md5(string_agg(to_jsonb(m)::text, '|' order by m.id)) as h from public.members m where m.society_id::text = $1`),
    otherVouchers: await h(`select md5(string_agg(to_jsonb(v)::text, '|' order by v.id)) as h from public.vouchers v where v.society_id::text = $1 and not (${LOOP})`),
    liveLoop: (await tx.query(`select count(*)::int as n from public.vouchers where society_id::text = $1 and not coalesce("isDeleted", false) and ${LOOP}`, [sid])).rows[0].n,
    nEntries: (await tx.query(`select count(*)::int as n from public.voucher_entries where society_id::text = $1`, [sid])).rows[0].n,
    tb,
  };
});

const before = await snap();
const dir = mkdtempSync(join(tmpdir(), 'rm01-phantom-'));
const outBase = join(dir, 'fix');
try {
  console.log(`Plan (society ${sid.slice(0, 8)}…)`);
  const planOut = execFileSync(process.execPath, [pathResolve(ROOT, 'scripts/rm01-phantom-cancel.mjs'), '--society', sid, '--out', outBase, '--source', 'harness'], { encoding: 'utf8' });
  const nDup = Number((planOut.match(/duplicates to cancel: (\d+)/) || [])[1]);
  const nSolo = Number((planOut.match(/solo loop vouchers kept: (\d+)/) || [])[1]);
  ok(`planner found ${nDup} duplicates and ${nSolo} solo vouchers (analysis: 842 / 4)`, nDup === 842 && nSolo === 4, planOut.split('\n').slice(1, 3).join(' '));
  ok('duplicates + solo = every live loop voucher', nDup + nSolo === before.liveLoop);

  console.log('Forward');
  apply(`${outBase}.sql`);
  const after = await snap();
  ok('live loop vouchers drop by exactly the duplicates (solo kept)', after.liveLoop === before.liveLoop - nDup && after.liveLoop === nSolo);
  ok('every non-loop voucher byte-identical (twins, the 33 unmatched, everything else)', after.otherVouchers === before.otherVouchers);
  ok('members byte-identical (register untouched)', after.members === before.members);
  ok('voucher_entries drop by 2 per duplicate', after.nEntries === before.nEntries - 2 * nDup, `${before.nEntries} → ${after.nEntries}`);
  const delta = (acc) => (after.tb[acc] || 0) - (before.tb[acc] || 0);
  ok('journal: Cash 3301 falls by ₹31,805', delta('3301') === -3180500, String(delta('3301')));
  ok('journal: Share capital 1102 falls by ₹29,700 (Cr)', delta('1102') === 2970000, String(delta('1102')));
  ok('journal: Admission fee 4407 falls by ₹2,105 (Cr)', delta('4407') === 210500, String(delta('4407')));
  const touched = Object.keys({ ...before.tb, ...after.tb }).filter((a) => delta(a) !== 0).sort();
  ok('no other account moves in the journal', touched.join(',') === '1102,3301,4407', touched.join(','));
  await inRollback(async (tx) => {
    const r = (await tx.query(`select
        (select count(*)::int from public.data_fix_log where fix = 'rm01-phantom-cancel' and entity = 'voucher') as lv,
        (select count(*)::int from public.data_fix_log where fix = 'rm01-phantom-cancel' and entity = 'voucher_entry') as le,
        (select count(*)::int from public.audit_log where source = 'rm01-phantom-cancel' and action = 'cancel') as au,
        (select count(*)::int from public.ledger_events where event_id like 'rm01-phantom-cancel-%' and producer_kind = 'import' and reversal_of is not null) as ev`)).rows[0];
    ok(`data_fix_log holds every changed voucher (${r.lv}) and entry (${r.le})`, r.lv === nDup && r.le === 2 * nDup);
    ok(`one audit row per cancel (${r.au})`, r.au === nDup);
    ok(`one reversing journal event per cancel, each pointing at its posting (${r.ev})`, r.ev === nDup);
  });

  console.log('Re-run');
  const again = tryApply(`${outBase}.sql`);
  ok('a second run refuses ("already applied") …', !again.ok && /already applied/.test(again.err));
  const afterAgain = await snap();
  ok('… and changes nothing', afterAgain.vouchers === after.vouchers && afterAgain.events === after.events && afterAgain.entries === after.entries);

  console.log('Undo');
  apply(`${outBase}.undo.sql`);
  const undone = await snap();
  ok('vouchers byte-identical to before', undone.vouchers === before.vouchers);
  ok('voucher_entries byte-identical to before', undone.entries === before.entries);
  ok('ledger_events byte-identical to before', undone.events === before.events);
  ok('journal trial balance identical to before', JSON.stringify(undone.tb) === JSON.stringify(before.tb));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\nRM-01 phantom cancel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
