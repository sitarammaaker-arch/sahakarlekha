// Step 2b-1 — the general dividend on the staff Member-360 (and, from the same view, the portal).
// One rule everywhere: postedAppropriation / dividendPaymentsByMember / liveRunFor, now shared by the
// Profit Distribution page, Member-360 and the portal (RULE 2). Legacy UNPAID years without a frozen
// split are hidden (founder decision); orphan runs never show; other members' lines never leave.
// Run: node scripts/test-member-dividend.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

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
const R = await imp('src/lib/distribution/dividendRuns.ts');
const { getVoucherLines } = await imp('src/lib/voucherUtils.ts');
const { buildMember360 } = await imp('src/lib/member360.ts');
const { buildVerticalViews } = await imp('src/lib/memberPortalVerticals.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Verbatim copies of the pre-2b page matchers (ProfitDistribution.tsx) ──
const legacyUsePosted = (vouchers, debitId, creditId, fy) => vouchers.find((v) => !v.isDeleted
  && getVoucherLines(v).some((l) => l.accountId === debitId && l.type === 'Dr')
  && getVoucherLines(v).some((l) => l.accountId === creditId && l.type === 'Cr') && v.narration.includes(fy));
const legacyPaid = (vouchers, fy) => {
  const m = new Map();
  for (const v of vouchers) {
    if (v.isDeleted || !v.memberId || !v.narration?.includes(fy)) continue;
    if (!/dividend paid|डिविडेंड भुगतान/i.test(v.narration)) continue;
    if (!getVoucherLines(v).some((l) => l.accountId === '1211' && l.type === 'Dr')) continue;
    const prev = m.get(v.memberId);
    m.set(v.memberId, { amount: Math.round(((prev?.amount || 0) + v.amount) * 100) / 100, voucherNo: v.voucherNo || prev?.voucherNo || '', date: v.date });
  }
  return m;
};

const V = (o) => ({ type: 'journal', createdAt: `${o.date}T00:00:00Z`, narration: '', ...o });
const appr = (id, fy, amount, extra = {}) => V({ id, voucherNo: id, date: '2027-03-31', debitAccountId: '1208', creditAccountId: '1211', amount, narration: `Dividend Appropriation @ 10% of Share Capital — FY ${fy}`, ...extra });
const pay = (id, fy, memberId, amount, extra = {}) => V({ id, voucherNo: id, type: 'payment', date: '2027-04-10', debitAccountId: '1211', creditAccountId: '3301', amount, memberId, narration: `Dividend paid to X — FY ${fy}`, ...extra });

// ── 1. The page's matchers moved to the lib unchanged ──
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
let mism = 0;
for (let t = 0; t < 600; t++) {
  const fys = ['2024-25', '2025-26', '2026-27'];
  const vs = Array.from({ length: Math.floor(rnd() * 10) }, (_, i) => pick([
    () => appr(`a${i}`, pick(fys), pick([100, 250.5, 0.01]), { isDeleted: rnd() < 0.2 }),
    () => pay(`p${i}`, pick(fys), pick(['m1', 'm2', undefined]), pick([10, 20.25]), { isDeleted: rnd() < 0.2, narration: pick([`Dividend paid to X — FY ${pick(fys)}`, `डिविडेंड भुगतान — FY ${pick(fys)}`, `Refund — FY ${pick(fys)}`]) }),
    () => V({ id: `x${i}`, date: '2027-01-01', debitAccountId: '1208', creditAccountId: '2103', amount: 5, narration: `Employee Bonus — FY ${pick(fys)}` }),
  ])());
  for (const fy of fys) {
    if (legacyUsePosted(vs, '1208', '1211', fy)?.id !== R.postedAppropriation(vs, '1208', '1211', fy)?.id) mism++;
    if (legacyUsePosted(vs, '1208', '2103', fy)?.id !== R.postedAppropriation(vs, '1208', '2103', fy)?.id) mism++;
    if (!same([...legacyPaid(vs, fy)], [...R.dividendPaymentsByMember(vs, fy)])) mism++;
  }
}
ok(mism === 0, '600 random voucher sets × 3 FYs: shared postedAppropriation / dividendPaymentsByMember = the page\'s original logic');

// ── 2. memberDividendHistory ──
const run = (fy, total, lines, extra = {}) => ({ id: `r-${fy}`, fyLabel: fy, kind: 'dividend', basis: 'share_capital', total, lines, status: 'approved', source: 'posted', ...extra });
const L = (memberId, amount) => ({ memberId, memberName: memberId, base: amount * 10, amount });
const runs = [
  run('2026-27', 200, [L('m1', 100), L('m2', 100)]),          // frozen, partly paid below
  run('2025-26', 999, [L('m1', 999)]),                        // ORPHAN: voucher total 150 ≠ 999
];
const vouchers = [
  appr('A27', '2026-27', 200), pay('P27', '2026-27', 'm1', 40),
  appr('A26', '2025-26', 150), pay('P26a', '2025-26', 'm1', 75), pay('P26b', '2025-26', 'm2', 75),   // legacy paid
  appr('A25', '2024-25', 300),                                                                        // legacy UNPAID, no run
];
const h1 = R.memberDividendHistory('m1', runs, vouchers);
ok(h1.map((r) => r.fyLabel).join() === '2026-27,2025-26', `m1 sees 2026-27 (run) + 2025-26 (paid); the unpaid legacy 2024-25 is hidden (got ${h1.map((r) => r.fyLabel)})`);
ok(same(h1[0], { fyLabel: '2026-27', entitled: 100, paid: 40, due: 60, source: 'run' }), 'frozen run: entitled 100, paid 40, due 60');
ok(same(h1[1], { fyLabel: '2025-26', entitled: 75, paid: 75, due: 0, source: 'payments' }), 'orphan run ignored → legacy paid year shown from the payment (75), not the orphan 999');
ok(R.memberDividendHistory('m3', runs, vouchers).length === 0, 'a member with no line and no payment sees nothing');
ok(R.memberDividendHistory('m1', runs, vouchers.filter((v) => v.id !== 'A27')).every((r) => r.fyLabel !== '2026-27'), 'run without its live voucher (e.g. voucher cancelled) disappears');
ok(R.memberDividendHistory('m1', runs, [{ ...vouchers[0], isDeleted: true }, ...vouchers.slice(1)]).every((r) => r.fyLabel !== '2026-27'), 'deleted appropriation voucher ⇒ that FY not shown');

// ── 3. Staff 360 === portal, and other members' lines never leave ──
const member = { id: 'm1', memberId: 'M-1', name: 'Asha', joinDate: '2024-04-01', status: 'active', shareCapital: 1000, nominees: [] };
const src = { vouchers: [...vouchers, V({ id: 'Q', date: '2027-01-01', debitAccountId: '1001', creditAccountId: '4101', amount: 9, memberId: 'm2', narration: 'sale — FY 2026-27' })], loans: [], depositAccounts: [], depositTransactions: [], kccLoans: [], accounts: [], distributionRuns: runs };
const m360 = buildMember360(member, src, '2027-04-30');
ok(same(m360.verticals.dividend.rows, h1), 'staff Member-360 dividend rows = memberDividendHistory');
ok(m360.verticals.dividend.dueTotal === 60, 'dividend due total = 60 (drives the "लाभांश बाकी" card)');
ok(m360.snapshot.dividendRuns.every((r) => r.lines.every((l) => l.memberId === 'm1')), 'snapshot runs carry ONLY this member\'s line (m2 never included)');
ok(m360.snapshot.dividendVouchers.every((v) => v.memberId === undefined || v.memberId === 'm1'), 'snapshot vouchers: appropriations + this member\'s payments only (m2 payment excluded)');
ok(!m360.snapshot.dividendVouchers.some((v) => v.id === 'Q'), 'unrelated vouchers never leave');
const portal = buildVerticalViews('m1', JSON.parse(JSON.stringify(m360.snapshot)), '2027-04-30');
ok(same(portal.dividend, m360.verticals.dividend), 'portal view (same payload over JSON) = staff 360');
ok(buildVerticalViews('m1', {}, '2027-04-30').dividend === null, '065-only payload (no dividend keys) → no section, no crash');

// ── 4. Static: one rule, wired everywhere ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const page = strip('src/pages/ProfitDistribution.tsx');
ok(/postedAppropriation\(vouchers, debitId, creditId, fy\)/.test(page) && /dividendPaymentsByMember\(vouchers, fy\)/.test(page), 'Profit Distribution uses the shared matchers (no private copy)');
ok(!/dividend paid\|डिविडेंड भुगतान/.test(page.slice(page.indexOf('const paidByMember'), page.indexOf('const paidByMember') + 300)), 'the page no longer carries its own payment regex');
const ui = strip('src/components/member-portal/PortalVerticals.tsx');
ok(/\{dividend && \(/.test(ui) && /link=\{links\?\.dividend\}/.test(ui), 'dividend section rendered (with staff link)');
ok(/label: hi \? 'लाभांश बाकी'/.test(strip('src/components/member-portal/MemberAccountView.tsx')), 'summary card "लाभांश बाकी" when due > 0');
const p360 = strip('src/pages/Member360.tsx');
ok(/useDistributionRuns\(\)/.test(p360) && /distributionRuns,\s*\}, new Date/.test(p360) && /dividend: \{ to: '\/profit-distribution'/.test(p360), 'Member-360 feeds runs + links to Profit Distribution');

console.log(`member dividend (2b-1): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
