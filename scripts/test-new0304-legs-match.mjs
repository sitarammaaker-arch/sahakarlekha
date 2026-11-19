// NEW-03 / NEW-04 (product audit 2026-11-17) — migration 185.
//   NEW-04  post / save-pending / edit / approve compared the ledger legs with the voucher by TOTAL only, so an approver
//           could post a held voucher to other accounts → _legs_match_voucher() compares per account and Dr/Cr side.
//   NEW-03  needs no SQL: voucher_lines has the foreign key (account_id, society_id) → accounts and 112's group trigger;
//           the client now turns that foreign-key refusal into the plain account_not_found message.
// Run on Postgres (PGlite) while building: before 185 an approver posted a held voucher to two other accounts and a
// post with mismatching legs went through; after it those, swapped sides and a held voucher with mismatching legs were
// refused, while matching legs, split legs on one account, a voucher without lines (debit/credit fallback) and a
// compound voucher with paise still posted; the helper is not callable from a browser; the down file restored all four.
// Production 2026-11-19: all 984 vouchers with ledger lines already match per account and side.
// Run: node scripts/test-new0304-legs-match.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const m = read('supabase/migrations/185_legs_match_voucher.sql');
const d = read('supabase/migrations/185_legs_match_voucher_down.sql');
const fn = (sql, name) => { const i = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`); return i < 0 ? '' : sql.slice(i, sql.indexOf('$function$', sql.indexOf('AS $function$', i) + 14)); };
const BASE = {
  post_voucher: read('supabase/migrations/184_subscription_gate_and_change_log.sql'),
  save_pending_voucher: read('supabase/migrations/184_subscription_gate_and_change_log.sql'),
  approve_voucher: read('supabase/migrations/183_maker_checker_server.sql'),
  edit_voucher: read('supabase/migrations/180_edit_voucher_date_journal.sql'),
};
const ARGS = {
  post_voucher: `p_voucher -> 'lines', p_voucher ->> 'debitAccountId', p_voucher ->> 'creditAccountId', (p_voucher ->> 'amount')::numeric`,
  save_pending_voucher: `p_voucher -> 'lines', p_voucher ->> 'debitAccountId', p_voucher ->> 'creditAccountId', (p_voucher ->> 'amount')::numeric`,
  approve_voucher: `v_cur.lines, v_cur."debitAccountId", v_cur."creditAccountId", v_cur.amount`,
  edit_voucher: `v_new.lines, v_new."debitAccountId", v_new."creditAccountId", v_new.amount`,
};

const STAMP_OLD = `            p_voucher || jsonb_build_object('society_id', v_sid, 'jurisdiction', v_juris, 'isDeleted', false, 'voucherNo', v_no))).*;`;
const STAMP_NEW = `            -- 185 / X-4: who posted it and when, from the token and the server clock (never the JSON) — withdraw_voucher reads these.\n` +
  `            (p_voucher - 'postedByEmail' - 'postedAt') || jsonb_build_object('society_id', v_sid, 'jurisdiction', v_juris, 'isDeleted', false, 'voucherNo', v_no,\n` +
  `                                            'postedByEmail', lower(nullif(trim(auth.jwt() ->> 'email'), '')), 'postedAt', now()))).*;`;

// ── X-4 server: post_voucher stamps the poster; withdraw_voucher lets that login take it back for 30 minutes ──
{
  ok(fn(m, 'post_voucher').includes(STAMP_NEW), 'post_voucher stamps postedByEmail (token) + postedAt (server clock), ignoring the JSON');
  ok(/alter table public\.vouchers add column if not exists "postedByEmail" text;/.test(m) && /alter table public\.vouchers add column if not exists "postedAt" timestamptz;/.test(m), 'the two columns are added');
  const w = m.slice(m.indexOf('create or replace function public.withdraw_voucher'), m.indexOf('$$;', m.indexOf('create or replace function public.withdraw_voucher')));
  ok(w.includes('if not public.jwt_can_delete() then') && w.includes(`if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_delete'; end if;`), 'a delete role withdraws as before; a non-writer never');
  ok(w.includes(`v_by is distinct from v_email or v_at is null or v_at < now() - interval '30 minutes'`) && w.includes(`raise exception 'post_voucher:withdraw_not_allowed'`), 'any other writer: only their own voucher, within 30 minutes');
  ok(w.includes('return public._cancel_voucher_core(v_sid, p_id, p_reason, p_deleted_by);'), 'the same cancel core as cancel_voucher (locks, journal, entries)');
  ok(/revoke execute on function public\.withdraw_voucher\(text, text, text\) from public, anon;\ngrant execute on function public\.withdraw_voucher\(text, text, text\) to authenticated;/.test(m), 'withdraw_voucher: signed-in only');
  ok(/drop function if exists public\.withdraw_voucher\(text, text, text\);/.test(d) && /drop column if exists "postedByEmail"/.test(d), 'down removes them');
}

// ── X-4 / X-2 client ──
{
  const dc = read('src/contexts/DataContext.tsx');
  const cv = dc.slice(dc.indexOf('const cancelVoucher = useCallback('), dc.indexOf('\n  }, []);', dc.indexOf('const cancelVoucher = useCallback(')));
  ok(cv.includes(`if (!opts?.rollback && guardPermission('delete'`), 'a rollback needs no delete role on the screen');
  ok(cv.includes('if (!opts?.rollback) {') && cv.includes('}   // end of the document guards (skipped for a rollback)'), 'a rollback skips the document guards');
  ok(cv.includes(`supabase.rpc(opts?.rollback ? 'withdraw_voucher' : 'cancel_voucher'`), 'a rollback calls withdraw_voucher');
  ok((cv.match(/opts\?\.onCancelled\?\.\(\)/g) || []).length === 4 && (cv.match(/opts\?\.onFailed\?\.\(/g) || []).length === 4, 'onCancelled / onFailed fire once the cloud answers, on every path');
  const cl = dc.slice(dc.indexOf('const cancelLinkedVouchers = ('), dc.indexOf('\n  };', dc.indexOf('const cancelLinkedVouchers = (')));
  ok(cl.includes(`supabase.rpc(opts?.rollback ? 'withdraw_voucher' : 'cancel_voucher'`), 'cancelLinkedVouchers can roll back too');
  // every "rolled back / auto-rollback / not saved" withdrawal of a just-posted voucher carries rollback: true
  const files = ['src/contexts/DataContext.tsx', 'src/contexts/LabourDataContext.tsx', 'src/contexts/ConsumerDataContext.tsx', 'src/contexts/DairyDataContext.tsx', 'src/contexts/HousingDataContext.tsx',
    'src/contexts/MarketingDataContext.tsx', 'src/contexts/TransportOpsContext.tsx', 'src/hooks/useLoanRepayment.ts', 'src/pages/KccLoan.tsx', 'src/pages/TdsRegister.tsx'];
  let sites = 0;
  for (const f of files) {
    for (const l of read(f).split('\n')) {
      if (!/cancel(Voucher|LinkedVouchers)\(/.test(l) || /const cancel/.test(l)) continue;
      if (!/rolled back|auto-rollback|not saved|save failed|refused by the server|auto-withdrawn|auto-cancelled|auto-unwind|edit withdrawn|unwind = /.test(l)) continue;
      sites++;
      ok(l.includes('rollback: true'), `${f}: rollback flag on "${l.trim().slice(0, 90)}"`);
    }
  }
  ok(sites >= 50, `all rollback sites found (${sites})`);
  // X-2: edit and reverse ask the same owner question as cancel
  const g = dc.slice(dc.indexOf('const guardDocumentOwnedVoucher = '), dc.indexOf('const updateVoucher = useCallback('));
  ok(g.includes('voucherOwnersRef.current.values()') && g.includes("'sale.return'") && g.includes("'share.transfer'") && g.includes("'wage.accrual'") && /depreciation/i.test(g), 'the owner guard covers the registry, returns, share transfers, muster accruals and depreciation');
  ok(dc.includes(`if (!opts?.viaParent && guardDocumentOwnedVoucher(id, { hi: 'बदला', en: 'changed' })) return false;   // X-2`), 'edit refuses an owned voucher');
  ok(dc.includes(`if (!opts?.engine && guardDocumentOwnedVoucher(id, { hi: 'reverse', en: 'reversed' })) return null;   // X-2`), 'reverse refuses an owned voucher');
  const P = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/ledger/postVoucherMessages.ts')).href);
  ok(/\(withdraw_not_allowed\)$/.test(P.postVoucherMessage('withdraw_not_allowed')), 'withdraw_not_allowed has a plain message');
}

// ── the helper ──
{
  const h = m.slice(m.indexOf('create or replace function public._legs_match_voucher'), m.indexOf('$$;', m.indexOf('create or replace function public._legs_match_voucher')));
  ok(h.includes(`(x ->> 'accountId') || '|' || (x ->> 'drCr')`) && h.includes(`(x ->> 'accountId') || '|' || (x ->> 'type')`), 'legs and voucher lines are both keyed by account + side');
  ok(h.includes(`p_dr || '|Dr'`) && h.includes(`p_cr || '|Cr'`) && h.includes('where not has.lines'), 'a voucher without lines compares its debit / credit account + amount');
  ok(h.includes('where m <> 0') && h.includes('= coalesce((select jsonb_object_agg(k, m) from w where m <> 0)'), 'the two per-account maps must be equal');
  ok(/revoke execute on function public\._legs_match_voucher\(jsonb, jsonb, text, text, numeric\) from public, anon, authenticated;/.test(m), 'not callable from a browser');
}

// ── each function = production body + exactly the check ──
for (const name of Object.keys(BASE)) {
  const up = fn(m, name), base = fn(BASE[name], name);
  const line = `  if not public._legs_match_voucher(p_lines, ${ARGS[name]}) then raise exception 'post_voucher:legs_do_not_match_voucher'; end if;\n`;
  ok(up.includes(line), `${name} checks the legs against its own voucher`);
  const unstamp = (s) => s.replace(STAMP_NEW, STAMP_OLD);
  ok(unstamp(up.replace(/  -- 185 \/ NEW-04[^\n]*\n/, '').replace(line, '')) === base, `${name} = the production body + only the 185 lines`);
  ok(fn(d, name) === base, `down restores ${name}`);
  ok(up.indexOf(line) > up.indexOf(`if v_total <> v_dr then raise exception 'post_voucher:legs_do_not_match_voucher'; end if;`), `${name}: the total check still runs first`);
}
ok(/^begin;/m.test(m) && /^commit;/m.test(m) && /values \('185', 'legs_match_voucher'\)/.test(m), '185 is one transaction and registers itself');
for (const s of ['post_voucher(jsonb, jsonb, jsonb)', 'save_pending_voucher(jsonb, jsonb)', 'approve_voucher(text, jsonb, text)', 'edit_voucher(jsonb, jsonb, text)']) {
  ok(m.includes(`revoke execute on function public.${s} from public, anon;`) && m.includes(`grant execute on function public.${s} to authenticated;`), `${s}: signed-in only`);
}

// ── NEW-03: the foreign key is the existence / tenant check; the client explains it ──
{
  const P = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/ledger/postVoucherMessages.ts')).href);
  ok(P.postVoucherErrorCode('insert or update on table "voucher_lines" violates foreign key constraint "voucher_lines_account_fkey"') === 'account_not_found', 'the foreign-key refusal maps to account_not_found');
  ok(P.postVoucherErrorCode('post_voucher:group_account') === 'group_account' && P.postVoucherErrorCode('something else') === null, 'coded refusals unchanged');
  ok(/\(account_not_found\)$/.test(P.postVoucherMessage('account_not_found')) && !/Cloud ने वाउचर मना किया|refused the voucher/.test(P.postVoucherMessage('account_not_found')), 'account_not_found has a plain message');
  const m112 = read('supabase/migrations/112_refuse_group_account_legs.sql');
  ok(/create trigger trg_refuse_group_account_leg\s+before insert on public\.voucher_lines/.test(m112) && m112.includes(`raise exception 'post_voucher:group_account'`), '112 still refuses a group account on every server path');
}

console.log(`NEW-03/04 migration 185: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
