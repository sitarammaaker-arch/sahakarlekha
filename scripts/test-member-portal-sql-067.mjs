// Member Portal 2b-2 · 067_member_portal_dividend.sql — STATIC guard (no DB) + a design check.
// 067 REPLACES member_portal_snapshot() again, so every 064/065 property is re-asserted, then the
// dividend additions: runs approved + live + society-scoped, only the member's OWN line; vouchers
// limited to the society's appropriations (Dr 1208 / Cr 1211) and THIS member's payments (Dr 1211),
// with other members' ids and extra line fields stripped. The 065 payload is byte-identical and the
// down migration restores the 065 function byte-for-byte.
// Part 2 mirrors the SQL selection in JS and proves, over random data, that what the portal receives
// gives the SAME memberDividendHistory as the staff Member-360 (superset filter + stripping is safe).
// Run: node scripts/test-member-portal-sql-067.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);

const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8');
const stripComments = (sql) => sql.replace(/--[^\n]*/g, '');
const fnOf = (sql) => sql.slice(sql.indexOf('create or replace function public.member_portal_snapshot()'), sql.indexOf('$$;', sql.indexOf('create or replace function public.member_portal_snapshot()')) + 3);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const raw065 = read('supabase/migrations/065_member_portal_verticals.sql');
const up = stripComments(read('supabase/migrations/067_member_portal_dividend.sql'));
const down = read('supabase/migrations/067_member_portal_dividend_down.sql');

// ── 064/065 invariants still hold on the replaced function ──
ok(/begin;[\s\S]*commit;/.test(up), 'runs in a transaction');
ok(!/create policy|create table|drop table|alter table/i.test(up), 'function-only change: no table/policy DDL');
ok(/create or replace function public\.member_portal_snapshot\(\)\s*returns jsonb/.test(up), 'RPC still takes ZERO parameters');
ok(/security definer/.test(up) && /set search_path = ''/.test(up), 'SECURITY DEFINER + pinned empty search_path');
ok(/v_uid\s+uuid := auth\.uid\(\)/.test(up) && /where auth_user_id = v_uid/.test(up), 'identity from auth.uid() only');
ok(/not v_link\.is_active/.test(up) && /'resigned', 'expelled', 'deceased'/.test(up), 'revoked logins + exited members denied');
ok(/v_plan not in \('plus', 'pro', 'enterprise', 'legacy', 'trial'\)/.test(up), 'plan gate unchanged');
ok(/revoke all on function public\.member_portal_snapshot\(\) from public, anon/.test(up), 'anon/public cannot execute');
ok(/grant execute on function public\.member_portal_snapshot\(\) to authenticated/.test(up), 'authenticated can execute');
const f065 = stripComments(fnOf(raw065));
const f067 = fnOf(up);
const pre065 = f065.slice(f065.indexOf("'ok', true"), f065.lastIndexOf("), '[]'::jsonb)"));
ok(pre065.length > 5000, 'payload slice found');
ok(f067.includes(pre065), 'the whole 065 payload is byte-identical in 067 (additive change)');

// ── dividend runs: society + approved + live + own line only ──
const runsBlock = up.slice(up.indexOf("'dividendRuns'"), up.indexOf("'dividendVouchers'"));
ok(/from public\.member_distribution_runs r/.test(runsBlock), 'reads member_distribution_runs (066)');
ok(/r\.society_id = v_link\.society_id/.test(runsBlock), 'runs: society scoped');
ok(/r\.kind = 'dividend'/.test(runsBlock) && /r\.status = 'approved'/.test(runsBlock), 'runs: dividend kind, approved only');
ok(/coalesce\(r\."isDeleted", false\) = false/.test(runsBlock), 'runs: deleted excluded');
ok(/ln\.value ->> 'memberId' = v_member\.id/.test(runsBlock), 'runs: only the member\'s own line');
ok(!/'lines', r\.lines/.test(up) && !/'createdBy'/.test(runsBlock), 'full lines arrays / creator never returned');

// ── dividend vouchers: appropriations + THIS member's payments, stripped ──
const vBlock = up.slice(up.indexOf("'dividendVouchers'"), up.indexOf('end;'));
ok(/where v\.society_id = v_link\.society_id and coalesce\(v\."isDeleted", false\) = false/.test(vBlock), 'vouchers: society scoped, deleted excluded');
ok(/v\."debitAccountId" = '1208'[\s\S]*?"accountId":"1208","type":"Dr"[\s\S]*?v\."creditAccountId" = '1211'[\s\S]*?"accountId":"1211","type":"Cr"/.test(vBlock), 'appropriation = Dr 1208 AND Cr 1211 (legacy columns or compound lines)');
ok(/v\."memberId" = v_member\.id\s+and \(v\."debitAccountId" = '1211'[\s\S]*?"accountId":"1211","type":"Dr"/.test(vBlock), 'payments = THIS member AND Dr 1211');
ok(/'memberId', case when v\."memberId" = v_member\.id then v\."memberId" end/.test(vBlock), 'another member\'s id is never returned');
ok(/'accountId', l\.value ->> 'accountId', 'type', l\.value ->> 'type', 'amount', l\.value -> 'amount'/.test(vBlock) && !/'lines', v\.lines/.test(vBlock), 'voucher lines reduced to account/type/amount');

// ── down restores the 065 function exactly ──
ok(fnOf(down) === fnOf(raw065), 'down restores the 065 function byte-for-byte');
ok(/revoke all on function public\.member_portal_snapshot\(\) from public, anon/.test(down) && /grant execute on function public\.member_portal_snapshot\(\) to authenticated/.test(down), 'down keeps the grants');

// ── Part 2: the SQL's selection, mirrored, gives the staff answer ──
const { memberDividendHistory } = await imp('src/lib/distribution/dividendRuns.ts');
const { buildMember360 } = await imp('src/lib/member360.ts');
const { buildVerticalViews } = await imp('src/lib/memberPortalVerticals.ts');

const hasLeg = (v, acc, type) => (type === 'Dr' ? v.debitAccountId === acc : v.creditAccountId === acc)
  || (Array.isArray(v.lines) && v.lines.some((l) => l.accountId === acc && l.type === type));
const sqlMirror = (me, runs, vouchers) => ({
  dividendRuns: runs.filter((r) => r.kind === 'dividend' && r.status === 'approved' && !r.isDeleted)
    .map((r) => ({ id: r.id, fyLabel: r.fyLabel, kind: r.kind, basis: r.basis, ratePct: r.ratePct, total: r.total, status: r.status, source: r.source,
      lines: r.lines.filter((l) => l.memberId === me) })),
  dividendVouchers: vouchers.filter((v) => !v.isDeleted && (
    (hasLeg(v, '1208', 'Dr') && hasLeg(v, '1211', 'Cr')) || (v.memberId === me && hasLeg(v, '1211', 'Dr'))))
    .map((v) => ({ id: v.id, voucherNo: v.voucherNo, type: v.type, date: v.date, createdAt: v.createdAt,
      debitAccountId: v.debitAccountId, creditAccountId: v.creditAccountId, amount: String(v.amount), narration: v.narration,
      memberId: v.memberId === me ? v.memberId : null,
      lines: (v.lines || []).map((l) => ({ id: l.id, accountId: l.accountId, type: l.type, amount: l.amount })) })),
});

let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const fys = ['2024-25', '2025-26', '2026-27'];
const mids = ['m1', 'm2', 'm3'];
let mism = 0, nonEmpty = 0;
for (let t = 0; t < 500; t++) {
  const vouchers = []; const runs = [];
  for (const fy of fys) {
    if (rnd() < 0.2) continue;
    const total = pick([300, 150.5, 90]);
    const compound = rnd() < 0.3;
    vouchers.push({ id: `A${fy}`, voucherNo: `JV/${fy}`, type: 'journal', date: '2027-03-31', createdAt: '2027-03-31T00:00:00Z',
      debitAccountId: compound ? '' : '1208', creditAccountId: compound ? '' : '1211', amount: total, isDeleted: rnd() < 0.1,
      memberId: rnd() < 0.2 ? pick(mids) : undefined,
      lines: compound ? [{ id: 'l1', accountId: '1208', type: 'Dr', amount: total + 50, narration: 'x' }, { id: 'l2', accountId: '1211', type: 'Cr', amount: total }, { id: 'l3', accountId: '1201', type: 'Cr', amount: 50 }] : [],
      narration: `Dividend Appropriation @ 10% of Share Capital — FY ${fy}` });
    if (rnd() < 0.6) runs.push({ id: `r${fy}`, fyLabel: fy, kind: 'dividend', basis: 'share_capital', ratePct: 10, total: rnd() < 0.85 ? total : 999,
      status: 'approved', source: 'posted', createdBy: 'u1', isDeleted: rnd() < 0.1,
      lines: mids.filter(() => rnd() < 0.7).map((m) => ({ memberId: m, memberName: m, base: 1000, amount: pick([30, 50.25, 100]) })) });
    for (const m of mids) if (rnd() < 0.5) vouchers.push({ id: `P${fy}${m}`, voucherNo: `PV/${fy}${m}`, type: 'payment', date: '2027-04-10', createdAt: '2027-04-10T00:00:00Z',
      debitAccountId: '1211', creditAccountId: '3301', amount: pick([30, 20, 50.25]), memberId: m, isDeleted: rnd() < 0.1, lines: [],
      narration: pick([`Dividend paid to ${m} — FY ${fy}`, `डिविडेंड भुगतान — FY ${fy}`, `Refund — FY ${fy}`]) });
  }
  vouchers.push({ id: 'X', voucherNo: 'X', type: 'receipt', date: '2027-01-01', createdAt: '2027-01-01T00:00:00Z', debitAccountId: '3301', creditAccountId: '4101', amount: 9, memberId: 'm2', narration: 'sale — FY 2026-27', lines: [] });
  for (const me of mids) {
    const member = { id: me, memberId: me, name: me, joinDate: '2024-04-01', status: 'active', shareCapital: 1000, nominees: [] };
    const staff = buildMember360(member, { vouchers, loans: [], depositAccounts: [], depositTransactions: [], kccLoans: [], accounts: [], distributionRuns: runs }, '2027-04-30');
    const portal = buildVerticalViews(me, JSON.parse(JSON.stringify(sqlMirror(me, runs, vouchers))), '2027-04-30');
    if (!same(portal.dividend, staff.verticals.dividend)) mism++;
    if (staff.verticals.dividend) nonEmpty++;
    const payload = JSON.stringify(sqlMirror(me, runs, vouchers));
    for (const other of mids) if (other !== me && payload.includes(`"memberId":"${other}"`)) mism++;
  }
}
ok(nonEmpty > 300, `random data exercises the section (${nonEmpty} non-empty)`);
ok(mism === 0, `500 random societies × 3 members: portal payload (SQL mirror) → same dividend view as staff Member-360, no other member's id (${mism} mismatches)`);
ok(memberDividendHistory('m1', [], []).length === 0, 'empty payload → no rows');

console.log(`member-portal SQL (067): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
