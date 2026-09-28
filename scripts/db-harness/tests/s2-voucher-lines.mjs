#!/usr/bin/env node
// S2 · voucher_lines backfill end-to-end on the restored backup.
// Precondition: harness up with 072 + 073 + 076 applied (every live voucher inside an FY).
// Plans with scripts/s2-backfill-voucher-lines.mjs (reading the harness), applies the SQL as the SQL
// Editor would, then proves: every live voucher has balanced lines inside its FY; each society's
// per-account net from voucher_lines EQUALS the net from the app's posting rule over the vouchers;
// vouchers untouched; a re-run refuses; the undo empties it. Also REPORTS (not fails) where the
// journal disagrees — that is the known journal drift (e.g. vouchers without postings).
//
// Run: node scripts/db-harness/tests/s2-voucher-lines.mjs   (S2_EXCLUDE=<sid,...> to leave societies out, as in prod)

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
const { getVoucherLines } = await import(pathToFileURL(pathResolve(SRC, 'lib/voucherUtils.ts')).href);
const { toMinor } = await import(pathToFileURL(pathResolve(SRC, 'lib/money.ts')).href);
const { projectTrialBalance } = await import(pathToFileURL(pathResolve(SRC, 'lib/ledger/projections.ts')).href);

const harness = pathResolve(HERE, '../harness.mjs');
const apply = (f) => execFileSync(process.execPath, [harness, 'apply', f], { stdio: 'pipe' });
const tryApply = (f) => { try { apply(f); return { ok: true }; } catch (e) { return { ok: false, err: String(e.stderr || e.message) }; } };

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const pre = (await inRollback((tx) => tx.query("select to_regclass('public.voucher_lines') is not null as vl, (select count(*)::int from public.voucher_lines) as n")).catch(() => null));
if (!pre || !pre.rows[0].vl) throw new Error('s2 test: apply 072 + 073 + 076 to the harness first');
if (pre.rows[0].n) throw new Error('s2 test: voucher_lines is not empty');

const EXCLUDE = (process.env.S2_EXCLUDE || '').split(',').map((x) => x.trim()).filter(Boolean);
const exSql = EXCLUDE.length ? ` and v.society_id::text not in (${EXCLUDE.map((x) => `'${x}'`).join(',')})` : '';
const vh = async () => (await inRollback((tx) => tx.query(`select md5(string_agg(to_jsonb(v)::text, '|' order by id)) as h from public.vouchers v`))).rows[0].h;
const beforeHash = await vh();
const dir = mkdtempSync(join(tmpdir(), 's2-'));
try {
  console.log('Plan + apply');
  const plan = execFileSync(process.execPath, [pathResolve(ROOT, 'scripts/s2-backfill-voucher-lines.mjs'), '--out', join(dir, 'b'), '--source', 'harness', ...EXCLUDE.flatMap((x) => ['--exclude-society', x])], { encoding: 'utf8' });
  const nLines = Number((plan.match(/lines: (\d+)/) || [])[1]);
  ok(`planner produced lines with no problems (${nLines})`, nLines > 0 && !/PROBLEMS/.test(plan));
  apply(join(dir, 'b.sql'));

  await inRollback(async (tx) => {
    const r = (await tx.query(`select
      (select count(*)::int from public.voucher_lines) as lines,
      (select count(*)::int from public.vouchers v where not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", 'approved') <> 'pending'
         and not exists (select 1 from public.voucher_lines l where l.voucher_id = v.id)${exSql}) as live_without_lines,
      (select count(*)::int from (select voucher_id from public.voucher_lines group by 1 having sum(dr_minor) <> sum(cr_minor)) x) as unbalanced,
      (select count(*)::int from public.voucher_lines l join public.financial_years f on f.id = l.fy_id where l.entry_date not between f.start_date and f.end_date) as outside_fy,
      (select count(*)::int from public.voucher_lines l join public.vouchers v on v.id = l.voucher_id where coalesce(v."isDeleted", false)) as lines_of_deleted`)).rows[0];
    ok(`all ${r.lines} planned lines inserted`, r.lines === nLines);
    if (EXCLUDE.length) ok('excluded societies got no lines', (await tx.query(`select count(*)::int as n from public.voucher_lines where society_id = any($1)`, [EXCLUDE])).rows[0].n === 0);
    ok('every live, posted voucher has lines', r.live_without_lines === 0, String(r.live_without_lines));
    ok('every voucher balances in paise', r.unbalanced === 0, String(r.unbalanced));
    ok('every line sits inside its financial year', r.outside_fy === 0, String(r.outside_fy));
    ok('no line for a cancelled voucher', r.lines_of_deleted === 0);

    // Fidelity: per society × account, net from lines == net from the app's posting rule over vouchers.
    const fromLines = new Map((await tx.query(`select society_id || '|' || account_id as k, sum(dr_minor - cr_minor)::bigint as n from public.voucher_lines group by 1`)).rows.map((x) => [x.k, Number(x.n)]));
    const vouchers = (await tx.query(`select to_jsonb(v) as r from public.vouchers v where not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", 'approved') <> 'pending'${exSql}`)).rows.map((x) => x.r);
    const fromRule = new Map();
    for (const v of vouchers) for (const l of getVoucherLines(v)) {
      const k = `${v.society_id}|${l.accountId}`;
      fromRule.set(k, (fromRule.get(k) || 0) + (l.type === 'Dr' ? 1 : -1) * toMinor(Number(l.amount) || 0));
    }
    const keys = new Set([...fromLines.keys(), ...fromRule.keys()]);
    const diff = [...keys].filter((k) => (fromLines.get(k) || 0) !== (fromRule.get(k) || 0));
    ok(`per-society, per-account net from voucher_lines == the app's posting rule (${keys.size} society×account pairs)`, diff.length === 0, diff.slice(0, 5).join(', '));

    // Report-only: where the journal disagrees with the lines (known drift, e.g. vouchers without postings).
    const socs = [...new Set(vouchers.map((v) => String(v.society_id)))];
    const drift = [];
    for (const s of socs) {
      const evs = (await tx.query(`select event_type, payload from public.ledger_events where society_id::text = $1 and aggregate_type = 'voucher'`, [s])).rows;
      const j = new Map(projectTrialBalance(evs.map((e) => ({ eventType: e.event_type, payload: e.payload }))).lines.map((l) => [l.accountId, l.netMinor]));
      const accs = new Set([...j.keys(), ...[...fromLines.keys()].filter((k) => k.startsWith(`${s}|`)).map((k) => k.split('|')[1])]);
      const n = [...accs].filter((a) => (j.get(a) || 0) !== (fromLines.get(`${s}|${a}`) || 0)).length;
      if (n) drift.push(`${s.slice(0, 8)}:${n}`);
    }
    console.log(`  · journal vs lines — societies with account differences (report only): ${drift.length ? drift.join(', ') : 'none'}`);
  });

  ok('vouchers byte-identical', (await vh()) === beforeHash);

  console.log('Re-run + undo');
  const again = tryApply(join(dir, 'b.sql'));
  ok('a second run refuses ("already exist") and changes nothing', !again.ok && /already exist/.test(again.err));
  apply(join(dir, 'b.undo.sql'));
  const after = (await inRollback((tx) => tx.query('select count(*)::int as n from public.voucher_lines'))).rows[0].n;
  ok('undo empties voucher_lines', after === 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\nS2 voucher_lines: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
