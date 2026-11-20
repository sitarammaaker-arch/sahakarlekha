// BKP-06, option A (product audit 2026-11-17) — migration 188: the restore server re-derives financial_years.
// financial_years is the year state machine, so it is never in the archive (a file must not set a year's status). A
// society rebuilt from its .slbak had only its registration year, so every older voucher stopped the restore with
// no_financial_year. restore_commit now re-creates the missing years from the restored vouchers.
// Run on Postgres (PGlite) with the 178 harness while building: a re-created society (only 2026-27 open) restored
// 2024-25 (its FYC/2024-25/RESULT voucher in the archive) → 'closed' and 2025-26 → 'closing', ledger lines for every
// voucher; a REAL closed year still refused a change (closed_year); a 2022-23 voucher with no way to place it still
// refused the whole restore (no_financial_year, nothing written); every earlier 178/179 case unchanged; down → 179.
// Run: node scripts/test-bkp06-rederive-fy.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const m = read('supabase/migrations/188_restore_rederive_financial_years.sql');
const d = read('supabase/migrations/188_restore_rederive_financial_years_down.sql');
const base = read('supabase/migrations/179_restore_commit_createdat_text.sql');
const fn = (s) => s.slice(s.indexOf('create or replace function public.restore_commit('), s.indexOf('$fn$;', s.indexOf('create or replace function public.restore_commit(')));
const up = fn(m);

ok(up.indexOf('-- 188 / BKP-06') > up.indexOf('create temp table _rv') && up.indexOf('-- 188 / BKP-06') < up.indexOf('-- 4a. voucher_entries'), 'the years are re-created after the vouchers are restored and before any ledger row is built');
ok(up.includes("and not exists (select 1 from public.financial_years f where f.society_id = v_sid and rv.vdate between f.start_date and f.end_date)"), 'only years no row covers are created (existing years are never touched)');
ok(up.includes("v.\"voucherNo\" = 'FYC/' || v_label || '/RESULT'") && up.includes("'closed', v_at, 'restored from archive'"), 'a year whose close voucher is in the archive comes back closed, marked "restored from archive"');
ok(up.includes("f.status = 'open' and f.start_date = make_date(r.y + 1, 4, 1)") && up.includes("f.status = 'closing')") && up.includes("make_date(r.y + 1, 3, 31), 'closing');"), 'the year right before the open one comes back closing (only if none is closing — one-closing index)');
ok(up.includes("(case when extract(month from rv.vdate) >= 4 then extract(year from rv.vdate) else extract(year from rv.vdate) - 1 end)::int as y") && up.includes("make_date(r.y, 4, 1), make_date(r.y + 1, 3, 31)"), 'years are April–March, labelled like the label CHECK expects');
ok(up.split('and not (f.id = any(v_fy_new))').length - 1 === 3 && up.includes('returning id into v_fy_id;') && up.includes('v_fy_new := v_fy_new || v_fy_id;'), 'only a year THIS restore re-created as closed may receive its (missing) ledger rows; real closed years stay refused');
ok(up.includes("return jsonb_build_object('financialYearsCreated', v_fy_made, "), 'the result says how many years were re-created');
ok(!/insert into public\.financial_years[^;]*'open'/.test(up), 'it never creates an open year (one-open index; the open year is the registration one)');

// body = 179 + only the marked lines
{
  const strip = up
    .replace("  v_label text; v_fy_made int := 0; v_fy_new uuid[] := '{}'; v_fy_id uuid;\n", '')
    .replace(/  -- 188 \/ BKP-06[\s\S]*?  end loop;\n\n/, '')
    .split('and not (f.id = any(v_fy_new))').join('').replace(/f\.status in \('closed', 'audited'\) /g, "f.status in ('closed', 'audited')")
    .replace("return jsonb_build_object('financialYearsCreated', v_fy_made, ", 'return jsonb_build_object(');
  ok(strip.replace(/\s+/g, ' ') === fn(base).replace(/\s+/g, ' '), '188 = 179\'s restore_commit + only the 188 lines');
}
ok(fn(d) === fn(base), 'down restores 179');
ok(/revoke execute on function public\.restore_commit\(uuid, int, text, text, jsonb\) from public, anon;/.test(m) && /grant execute on function public\.restore_commit\(uuid, int, text, text, jsonb\) to authenticated;/.test(m), 'grants unchanged (browser can call it as the signed-in admin; anon cannot)');
ok(/^begin;/m.test(m) && /^commit;/m.test(m) && /values \('188', 'restore_rederive_financial_years'\)/.test(m), '188 is one transaction and registers itself');
// voucher_lines / entries / journal were already derived (179) — still there
ok(up.includes('-- 4a. voucher_entries: replaced for the society.') && up.includes("'posted', 'restore'") && up.includes('-- The journal: append only.'), 'voucher_entries, voucher_lines and the journal are still rebuilt from the vouchers');

console.log(`BKP-06 re-derive financial_years (188): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
