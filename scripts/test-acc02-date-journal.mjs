// ACC-02 (product audit 2026-11-17) — an edit that changes ONLY the date never reached the journal.
// Reproduction from the audit: a ₹5,000 receipt dated 2027-04-02 is re-dated to 2027-03-30. The all-time parity
// gate still passed, but the journal's Trial Balance as on 2027-03-31 showed cash 0 / income 0 while the vouchers
// showed 5,000. Fixed in three places:
//   - ledgerParity also compares each live voucher's date with its journal posting (a cut-over tenant falls back);
//   - DataContext.updateVoucher writes reversed + reposted when the date changes (browser path);
//   - migration 180: edit_voucher does the same on the server, plus a one-time append-only repair.
// The SQL of 180 was run end to end on Postgres (PGlite) while building: only the re-dated live voucher got the
// pair (with its own date), a second run added nothing, cancelled and correctly dated vouchers were untouched.
// Run: node scripts/test-acc02-date-journal.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
    if (spec.startsWith('@/')) { const base = pathResolve(SRC, spec.slice(2)); for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base]) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const c of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(c, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {}; export const supabaseLoose = supabase;' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8');

const { ledgerParity, journalDateDiffs } = await imp('src/lib/ledger/parity.ts');
const { buildEvent } = await imp('src/lib/ledger/event.ts');
const { voucherPostingLines, voucherReversalLines, voucherEventMeta } = await imp('src/lib/ledger/voucherEvent.ts');
const { ledgerTrialBalance } = await imp('src/lib/ledger/trialBalance.ts');
const { computeTrialBalance } = await imp('src/lib/reports/trialBalance.ts');

let pass = 0, fail = 0;
const ok = (cond, msg, detail = '') => { if (cond) pass++; else { fail++; console.error('  ✗', msg, detail); } };

const accounts = [
  { id: '3301', name: 'Cash', nameHi: 'Cash', type: 'asset', parentId: '3300', openingBalance: 0, openingBalanceType: 'debit', isGroup: false },
  { id: '4401', name: 'Fee', nameHi: 'Fee', type: 'income', parentId: '4400', openingBalance: 0, openingBalanceType: 'credit', isGroup: false },
];
const before = { id: 'r1', voucherNo: 'RV/1', type: 'receipt', date: '2027-04-02', debitAccountId: '3301', creditAccountId: '4401', amount: 5000, narration: '' };
const after = { ...before, date: '2027-03-30' };
const P = { kind: 'human', id: 't' };
const ev = (seq, eventType, voucher, lines, extra = {}) => buildEvent({ eventType, tenantId: 'S', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'r1', sequence: seq, producer: P, payload: { lines, ...voucherEventMeta(voucher), ...extra } }, { eventId: `e${seq}`, occurredAt: '2027-04-05T00:00:00Z' });
const asOf = '2027-03-31', fyStart = '2026-04-01';
const cashOf = (tb) => tb.find((b) => b.account.id === '3301')?.netBalance ?? 0;

// ── The bug: a date-only edit that emits nothing ──
{
  const journal = [ev(1, 'voucher.posted', before, voucherPostingLines(before))];
  const p = ledgerParity(journal, [after], accounts);
  ok(p.diffs.length === 0, 'the all-time balances still agree (why the old gate passed)');
  ok(!p.matches && p.dateDiffs?.length === 1 && p.dateDiffs[0].journalDate === '2027-04-02' && p.dateDiffs[0].voucherDate === '2027-03-30', 'the gate now FAILS on the date difference — the tenant falls back to the voucher rows');
  ok(cashOf(ledgerTrialBalance(journal, accounts, asOf, fyStart)) === 0 && cashOf(computeTrialBalance({ accounts, vouchers: [after], asOnDate: asOf, fyStart, openingsInScope: true })) === 5000, 'as on 2027-03-31 the stale journal says 0, the vouchers 5,000 (the audit\'s reproduction)');
}

// ── The fix: reversed + reposted with the new date ──
{
  const journal = [
    ev(1, 'voucher.posted', before, voucherPostingLines(before)),
    ev(2, 'voucher.reversed', before, voucherReversalLines(before), { reason: 'edit' }),
    ev(3, 'voucher.reposted', after, voucherPostingLines(after)),
  ];
  const p = ledgerParity(journal, [after], accounts);
  ok(p.matches && (p.dateDiffs ?? []).length === 0, 'after the pair the gate passes');
  for (const d of ['2027-03-30', '2027-03-31', '2027-04-01', '2027-04-02', '2027-04-30']) {
    const j = cashOf(ledgerTrialBalance(journal, accounts, d, d >= '2027-04-01' ? '2027-04-01' : fyStart));
    const v = cashOf(computeTrialBalance({ accounts, vouchers: [after], asOnDate: d, fyStart: d >= '2027-04-01' ? '2027-04-01' : fyStart, openingsInScope: true }));
    ok(j === v, `journal TB = voucher TB as on ${d}`, `${j} vs ${v}`);
  }
}

// ── The gate ignores what it cannot judge ──
{
  const noDate = buildEvent({ eventType: 'voucher.posted', tenantId: 'S', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'r1', sequence: 1, producer: P, payload: { lines: voucherPostingLines(after) } }, { eventId: 'n1', occurredAt: '2027-04-05T00:00:00Z' });
  ok(journalDateDiffs([noDate], [after]).length === 0, 'a posting with no date in its payload is not compared');
  const cancelled = [ev(1, 'voucher.posted', before, voucherPostingLines(before)), ev(2, 'voucher.cancelled', before, voucherReversalLines(before))];
  ok(journalDateDiffs(cancelled, [{ ...after, isDeleted: true }]).length === 0, 'a cancelled voucher is not compared');
  ok(journalDateDiffs([ev(1, 'voucher.posted', before, voucherPostingLines(before))], [{ ...after, approvalStatus: 'pending' }]).length === 0, 'a pending voucher is not compared');
}

// ── Browser path + migration 180 ──
{
  const dc = read('src/contexts/DataContext.tsx');
  ok(/if \(JSON\.stringify\(oldLegs\) !== JSON\.stringify\(newLegs\) \|\| current\.date !== updatedVoucher\.date\) \{/.test(dc), 'updateVoucher journals a date-only edit');

  const m = read('supabase/migrations/180_edit_voucher_date_journal.sql').replace(/\r\n/g, '\n');
  const d = read('supabase/migrations/180_edit_voucher_date_journal_down.sql').replace(/\r\n/g, '\n');
  const m127 = read('supabase/migrations/127_voucher_activity_tag_edit.sql').replace(/\r\n/g, '\n');
  const fnOf = (s) => s.slice(s.indexOf('CREATE OR REPLACE FUNCTION public.edit_voucher'), s.indexOf('$function$', s.indexOf('AS $function$') + 14) + 10);
  const f127 = fnOf(m127), f180 = fnOf(m), fDown = fnOf(d);
  ok(/elsif v_posting\.payload -> 'lines' is distinct from v_legs\n\s+or \(v_posting\.payload ->> 'date'\) is distinct from v_new\."date" then/.test(f180), '180: edit_voucher writes the pair when the legs OR the date change');
  const strip = (s) => s.replace(/  -- Journal:[^\n]*\n(  -- [^\n]*\n)*/, '').replace(/  elsif v_posting\.payload -> 'lines' is distinct from v_legs(\n\s+or \(v_posting\.payload ->> 'date'\) is distinct from v_new\."date")? then/, 'ELSIF');
  ok(strip(f180) === strip(f127), '180 changes only that condition (and its comment) of 127\'s edit_voucher');
  ok(fDown === f127, '180 down puts back 127\'s edit_voucher verbatim');
  ok(/revoke execute on function public\.edit_voucher\(jsonb, jsonb, text\) from public, anon;/.test(m) && /grant execute on function public\.edit_voucher\(jsonb, jsonb, text\) to authenticated;/.test(m), '180 keeps anon out');
  const repair = m.slice(m.indexOf('do $repair$'), m.indexOf('$repair$;'));
  ok(/'voucher\.reversed'/.test(repair) && /'voucher\.reposted'/.test(repair) && !/update public\.ledger_events|delete from public\.ledger_events/.test(m), 'the repair appends a reversed + reposted pair and never edits or deletes an event');
  ok(/not coalesce\(v\."isDeleted", false\)/.test(repair) && /'voucher\.cancelled'/.test(repair) && /not in \('pending', 'rejected'\)/.test(repair), 'the repair skips cancelled, pending and rejected vouchers');
  ok(/'import', 'migration-180'/.test(repair) && !/'system'/.test(repair), 'the repair\'s producer kind is one the client accepts (import)');
  ok(/jsonb_build_object\('date', r\.vdate\)/.test(repair) && /reversal_of[\s\S]*r\.event_id/.test(repair), 'the repost carries the voucher\'s date; the reversal points at the posting it reverses');
  ok(/^begin;/m.test(m) && /^commit;/m.test(m) && /values \('180', 'edit_voucher_date_journal'\)/.test(m), '180 runs in one transaction and registers itself');
}

console.log(`ACC-02 date-only edit reaches the journal: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
