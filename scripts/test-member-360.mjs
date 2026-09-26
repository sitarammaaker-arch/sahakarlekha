// Member-360 (staff) — PARITY. The staff Member-360 view, built from staff state by member360.ts,
// must equal (a) each source page's own function on the same rows and (b) what the member sees on
// the portal for the same rows. Noise rows (other members, soft-deleted, drafts, other members'
// bills/lines) must never leak in. Run: node scripts/test-member-360.mjs
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
const { buildMember360, toMemberSnapshot, maskAadhaar, maskPan } = await imp('src/lib/member360.ts');
const { buildPortalView } = await imp('src/lib/memberPortalView.ts');
const { buildVerticalViews } = await imp('src/lib/memberPortalVerticals.ts');
const { buildMemberShareLedger, loanOutstanding, kccOutstanding } = await imp('src/lib/memberSnapshot.ts');
const { buildMemberPassbook } = await imp('src/lib/dairy/registers.ts');
const { memberInputOutstanding } = await imp('src/lib/dairy/inputs.ts');
const { buildMemberStatement } = await imp('src/lib/housing/statement.ts');
const { memberOutstanding, memberAgeing, memberCreditLedger } = await imp('src/lib/consumer/credit.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const M = 'm1', O = 'other';
const asOf = '2026-09-26';

const member = { id: M, memberId: 'M-1', name: 'राम', fatherName: 'श्याम', address: 'गाँव', phone: '9876543210', memberType: 'member', joinDate: '2024-04-01', status: 'active', shareCapital: 500, admissionFee: 10, aadhaar: '1234 5678 9012', pan: 'ABCDE1234F', kycStatus: 'verified', nominees: [] };
const v = (o) => ({ type: 'receipt', createdAt: `${o.date}T00:00:00Z`, narration: '', ...o });
const vouchers = [
  v({ id: 'sc1', voucherNo: 'R/1', date: '2024-04-01', debitAccountId: '1001', creditAccountId: '1102', amount: 500, memberId: M }),
  v({ id: 'sc2', voucherNo: 'P/1', date: '2025-01-01', debitAccountId: '1102', creditAccountId: '1001', amount: 100, memberId: M }),
  v({ id: 'scX', voucherNo: 'R/2', date: '2025-02-01', debitAccountId: '1001', creditAccountId: '1102', amount: 999, memberId: M, isDeleted: true }),
  v({ id: 'scO', voucherNo: 'R/3', date: '2025-02-01', debitAccountId: '1001', creditAccountId: '1102', amount: 300, memberId: O }),
  v({ id: 'mv1', voucherNo: 'RV/9', date: '2026-04-10', amount: 1500, refType: 'maintenance.receipt', refId: 'b1' }),
  v({ id: 'mvO', voucherNo: 'RV/10', date: '2026-04-10', amount: 700, refType: 'maintenance.receipt', refId: 'bO' }),
  v({ id: 'mvX', voucherNo: 'RV/11', date: '2026-04-11', amount: 50, refType: 'maintenance.receipt', refId: 'b2', isDeleted: true }),
];
const loans = [
  { id: 'l1', loanNo: 'L/1', memberId: M, amount: 10000, repaidAmount: 2500, status: 'active' },
  { id: 'l2', loanNo: 'L/2', memberId: M, amount: 5000, repaidAmount: 5000, status: 'cleared' },
  { id: 'lX', loanNo: 'L/3', memberId: M, amount: 9000, repaidAmount: 0, status: 'active', isDeleted: true },
  { id: 'lO', loanNo: 'L/4', memberId: O, amount: 7000, repaidAmount: 0, status: 'active' },
];
const depositAccounts = [
  { id: 'd1', accountNo: 'SB/1', memberId: M, depositType: 'SB', openDate: '2024-04-01', balance: 1200.25, status: 'active' },
  { id: 'dO', accountNo: 'SB/2', memberId: O, depositType: 'SB', openDate: '2024-04-01', balance: 9999, status: 'active' },
];
const depositTransactions = [
  { id: 't1', depositAccountId: 'd1', date: '2024-04-01', txnType: 'open', amount: 1200.25, balanceAfter: 1200.25 },
  { id: 'tO', depositAccountId: 'dO', date: '2024-04-01', txnType: 'open', amount: 9999, balanceAfter: 9999 },
];
const kccLoans = [{ id: 'k1', loanNo: 'K/1', memberId: M, drawnAmount: 9000, repaidAmount: 1000, outstandingAmount: undefined, status: 'active' }, { id: 'kO', loanNo: 'K/2', memberId: O, drawnAmount: 1, repaidAmount: 0, status: 'active' }];
const accounts = [{ id: '1102', name: 'Share Capital' }, { id: '3305', name: 'Member Input Receivable', nameHi: 'सदस्य आदान प्राप्य' }, { id: 'G', name: 'Group', isGroup: true }];
const milkEntries = [
  { id: 'e0', date: '2025-06-01', shift: 'morning', memberId: M, qty: 3, fat: 4, snf: 8, rate: 40, amount: 120 }, // older than the portal window
  { id: 'e1', date: '2026-06-28', shift: 'morning', memberId: M, qty: 8, fat: 8, snf: 2, rate: 32, amount: 256 },
  { id: 'e2', date: '2026-07-01', shift: 'morning', memberId: M, qty: 10, fat: 12, snf: 0, rate: 84, amount: 840 },
  { id: 'eO', date: '2026-07-01', shift: 'morning', memberId: O, qty: 50, fat: 4, snf: 8, rate: 40, amount: 2000 },
];
const dairySettlements = [
  { id: 's1', memberId: M, from: '2025-06-01', to: '2025-06-10', gross: 120, netPayable: 100, amountPaid: 40, status: 'approved', deductionLines: [{ accountId: '3305', amount: 20 }] },
  { id: 'sX', memberId: M, from: '2025-07-01', to: '2025-07-10', gross: 999, netPayable: 999, amountPaid: 0, status: 'approved', deductionLines: [], isDeleted: true },
  { id: 'sO', memberId: O, from: '2025-07-01', to: '2025-07-10', gross: 5, netPayable: 5, amountPaid: 0, status: 'approved', deductionLines: [] },
];
const dairyInputIssues = [{ id: 'i1', date: '2025-06-03', memberId: M, inputType: 'feed', itemName: 'आहार', amount: 150 }, { id: 'iX', date: '2025-06-03', memberId: M, inputType: 'feed', amount: 77, isDeleted: true }];
const dairyDistributions = [
  { id: 'dd1', kind: 'bonus', fyLabel: '2025-26', rate: 1, status: 'approved', lines: [{ memberId: M, base: 1200, amount: 360 }, { memberId: O, base: 5000, amount: 1500 }] },
  { id: 'dd2', kind: 'bonus', fyLabel: '2026-27', rate: 1, status: 'draft', lines: [{ memberId: M, base: 1, amount: 999 }] },
];
const maintenanceBills = [
  { id: 'b1', billNo: 'MB/1', memberId: M, flatNo: 'A-1', period: '2026-04', date: '2026-04-01', amount: 1500, paidAmount: 1500 },
  { id: 'b2', billNo: 'MB/2', memberId: M, flatNo: 'A-1', period: '2026-05', date: '2026-05-01', amount: 1500, paidAmount: 0 },
  { id: 'bO', billNo: 'MB/3', memberId: O, flatNo: 'B-1', period: '2026-04', date: '2026-04-01', amount: 700, paidAmount: 700 },
];
const housingFlats = [{ id: 'f1', flatNo: '101', blockNo: 'A', memberId: M, monthlyMaintenance: 1500 }, { id: 'fO', flatNo: '202', memberId: O, monthlyMaintenance: 1 }];
const sales = [
  { id: 'c1', saleNo: 'S/1', memberId: M, paymentMode: 'credit', date: '2026-07-04', grandTotal: 245, netAmount: 230 },
  { id: 'c2', saleNo: 'S/2', memberId: M, paymentMode: 'cash', date: '2026-07-05', grandTotal: 999, netAmount: 999 },
  { id: 'cO', saleNo: 'S/3', memberId: O, paymentMode: 'credit', date: '2026-07-05', grandTotal: 500, netAmount: 500 },
];
const memberRecoveries = [v({ id: 'r1', voucherNo: 'RV/396', date: '2026-07-04', memberId: M, amount: 45 }), v({ id: 'rX', voucherNo: 'RV/397', date: '2026-07-06', memberId: M, amount: 20, isDeleted: true })];
const salesReturns = [{ id: 'x1', returnNo: 'SR/1', date: '2026-07-05', memberId: M, grandTotal: 49, refundMode: 'credit-adjust' }, { id: 'x2', returnNo: 'SR/2', date: '2026-07-05', memberId: M, grandTotal: 10, refundMode: 'cash' }];
const patronageRuns = [
  { id: 'p1', kind: 'patronage', fyLabel: '2026-27', from: '2026-04-01', to: '2027-03-31', ratePct: 1, status: 'approved', lines: [{ memberId: M, memberName: 'राम', base: 295, amount: 2.95 }, { memberId: O, memberName: 'x', base: 100, amount: 1 }] },
  { id: 'pX', kind: 'patronage', fyLabel: '2025-26', from: '2025-04-01', to: '2026-03-31', ratePct: 1, status: 'approved', isDeleted: true, lines: [{ memberId: M, base: 1, amount: 777 }] },
];

const src = { society: { name: 'Test', nameHi: 'टेस्ट' }, vouchers, loans, depositAccounts, depositTransactions, kccLoans, accounts, milkEntries, dairySettlements, dairyInputIssues, dairyDistributions, maintenanceBills, housingFlats, sales, memberRecoveries, salesReturns, patronageRuns };
const m360 = buildMember360(member, src, asOf);
const { view, verticals, snapshot } = m360;
const activeVouchers = vouchers.filter((x) => !x.isDeleted);

// ── (a) each figure === the source page's own function ──
ok(same(view.shareLedger, buildMemberShareLedger(member, activeVouchers, '1102')), 'share ledger === buildMemberShareLedger (getMemberLedger voucher path)');
ok(view.shareBalance === 400, `share balance 500 − 100 = 400 (deleted + other member excluded; got ${view.shareBalance})`);
const liveLoans = loans.filter((l) => l.memberId === M && !l.isDeleted);
ok(view.loans.length === 2 && view.loanOutstandingTotal === liveLoans.filter((l) => l.status !== 'cleared').reduce((s, l) => s + loanOutstanding(l), 0), 'loans: deleted/other excluded; total = Loan Register formula');
ok(view.deposits.length === 1 && view.depositTotal === 1200.25 && view.deposits[0].transactions.length === 1, 'deposits + transactions: only this member\'s');
ok(view.kccOutstandingTotal === kccOutstanding(kccLoans[0]), 'KCC via kccOutstanding');

const staffPassbook = buildMemberPassbook(milkEntries, dairySettlements.filter((s) => !s.isDeleted), M);
for (const k of ['totalQty', 'totalGross', 'totalNet', 'totalPaid', 'totalOutstanding']) ok(verticals.dairy.passbook[k] === staffPassbook[k], `dairy ${k} === Dairy Registers passbook (${staffPassbook[k]})`);
ok(verticals.dairy.passbook.collections.length === 3, 'staff sees FULL milk history (incl. 2025 entry the portal windows out)');
ok(same(verticals.dairy.inputs, memberInputOutstanding(dairyInputIssues.filter((i) => !i.isDeleted), dairySettlements.filter((s) => !s.isDeleted), M, '3305')), 'inputs === memberInputOutstanding');
ok(verticals.dairy.distributions.length === 1 && verticals.dairy.distributions[0].amount === 360, 'dairy: approved run only, own line only (draft 999 + other member 1500 excluded)');

const staffStmt = buildMemberStatement(maintenanceBills.filter((b) => b.memberId === M), vouchers);
ok(same(verticals.housing.statement, staffStmt), `housing === Member Statement (outstanding ${staffStmt.outstanding})`);
ok(verticals.housing.statement.outstanding === 1500 && verticals.housing.flats.length === 1, 'housing: other member\'s bill/receipt + deleted receipt excluded');

const recRows = memberRecoveries.map((x) => ({ id: x.id, date: x.date, ref: x.voucherNo, memberId: x.memberId, amount: x.amount, isDeleted: x.isDeleted }));
const retRows = salesReturns.map((x) => ({ id: x.id, date: x.date, ref: x.returnNo, memberId: x.memberId, grandTotal: x.grandTotal, refundMode: x.refundMode }));
ok(verticals.consumer.outstanding === memberOutstanding(sales, memberRecoveries, M, salesReturns), 'consumer outstanding === Member Credit');
ok(same(verticals.consumer.ageing, memberAgeing(sales, memberRecoveries, M, asOf, salesReturns)), 'consumer ageing === Member Credit');
ok(same(verticals.consumer.ledger, memberCreditLedger(sales, recRows, retRows, M)), 'consumer ledger === Member Credit ledger');
ok(verticals.consumer.outstanding === 151 && verticals.consumer.ledger.at(-1).balance === 151, 'consumer 245 − 45 − 49 = 151 (cash sale/return + deleted recovery excluded)');
ok(verticals.consumer.distributions.length === 1 && verticals.consumer.distributions[0].amount === 2.95, 'patronage: approved, not deleted, own line only');

// ── (b) staff view === portal view for the same rows ──
const portalPayload = { ...snapshot, milkEntries: snapshot.milkEntries.filter((e) => e.date >= '2026-03-01'), milkFrom: '2026-03-01' };
const portalView = buildPortalView(JSON.parse(JSON.stringify(portalPayload)));
const portalVerticals = buildVerticalViews(M, JSON.parse(JSON.stringify(portalPayload)), asOf);
ok(same(portalView, view), 'profile/share/loan/deposit/KCC: staff 360 === portal');
ok(same(portalVerticals.housing, verticals.housing) && same(portalVerticals.consumer, verticals.consumer), 'housing + consumer: staff 360 === portal');
ok(portalVerticals.dairy.passbook.totalOutstanding === verticals.dairy.passbook.totalOutstanding && same(portalVerticals.dairy.inputs, verticals.dairy.inputs), 'dairy dues + inputs: staff 360 === portal (only the milk-entry window differs)');

// ── KYC masking matches the 064 RPC ──
ok(snapshot.member.aadhaarMasked === 'XXXX-XXXX-9012' && maskAadhaar('') === null, 'Aadhaar masked like the RPC');
ok(snapshot.member.panMasked === 'XXXXX1234F' && maskPan(undefined) === null, 'PAN masked like the RPC');
ok(!('aadhaar' in snapshot.member) && !('pan' in snapshot.member), 'raw Aadhaar/PAN never in the view model');

// ── empty member ──
const bare = buildMember360({ ...member, id: 'nobody', shareCapital: 0 }, src, asOf);
ok(bare.verticals.dairy === null && bare.verticals.housing === null && bare.verticals.consumer === null && bare.view.loans.length === 0, 'member with nothing → no sections');

// ── static: pure, reuses the portal builders ──
const lib = readFileSync(pathResolve(ROOT, 'src/lib/member360.ts'), 'utf8');
ok(/buildPortalView\(snapshot(, asOf)?\)/.test(lib) && /buildVerticalViews\(member\.id, snapshot, asOf\)/.test(lib), 'reuses the portal view builders (no third formula)');
ok(!/from 'react'|supabase/.test(lib), 'adapter is pure (no React, no network)');
ok(typeof toMemberSnapshot === 'function', 'snapshot adapter exported');

// ── 360-b: route gate + read-only page ──
const { moduleForRoute, DETAIL_ROUTE_PARENTS } = await imp('src/lib/navigation/routeModule.ts');
ok(moduleForRoute('/members')?.route === '/members', 'exact route → its module');
ok(moduleForRoute('/members/abc-123')?.route === '/members', '/members/:id inherits the /members gate (not "universal")');
ok(moduleForRoute('/members/') === undefined || moduleForRoute('/members/')?.route === '/members', 'bare prefix does not crash');
ok(moduleForRoute('/member-statement')?.route === '/member-statement', 'sibling route /member-statement unaffected');
ok(moduleForRoute('/definitely-unknown') === undefined, 'unknown routes still fall through (unchanged behaviour)');
ok(DETAIL_ROUTE_PARENTS.every((d) => d.prefix.endsWith('/')), 'detail prefixes end with "/" (no accidental /membersX match)');
// Role gate, end to end: a role that cannot open Members cannot open /members/:id either.
const { isModuleVisible } = await imp('src/lib/navigation/navVisibility.ts');
const detailModule = moduleForRoute('/members/abc-123');
const allCaps = new Set(detailModule.requiredCapabilities);
const ctxFor = (userRole) => ({ societyType: 'pacs', capabilities: allCaps, hasRole: () => true, userRole });
for (const role of ['boardMember', 'chairman', 'internalAuditor', 'externalCA', 'procurementOfficer']) {
  ok(!isModuleVisible(detailModule, ctxFor(role)), `${role}: /members/:id blocked (same as /members)`);
}
for (const role of ['admin', 'accountant', 'manager']) ok(isModuleVisible(detailModule, ctxFor(role)), `${role}: /members/:id allowed (same as /members)`);
const guard = readFileSync(pathResolve(ROOT, 'src/components/CapabilityGuard.tsx'), 'utf8');
ok(/const module = moduleForRoute\(location\.pathname\)/.test(guard), 'CapabilityGuard resolves modules through moduleForRoute');
const page360 = readFileSync(pathResolve(ROOT, 'src/pages/Member360.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
ok(/buildMember360\(member,/.test(page360) && /<MemberAccountView member=\{snapshot\.member\} view=\{view\} verticals=\{verticals\}/.test(page360), 'page renders buildMember360 through the shared MemberAccountView');
ok(!/\b(add|update|delete|approve|reject|record|cancel|set)[A-Z]\w*\s*[,}]/.test(page360.slice(page360.indexOf('useData()') - 200, page360.indexOf('const member ='))), 'page takes NO mutation functions from any context (read-only)');
ok(/matchesActiveBranch\(member\.branchId\)/.test(page360), 'page respects the branch selector');
const app = readFileSync(pathResolve(ROOT, 'src/App.tsx'), 'utf8');
ok(/<Route path="\/members\/:id" element=\{<ProtectedRoute><Member360 \/><\/ProtectedRoute>\} \/>/.test(app), '/members/:id is a ProtectedRoute (auth + CapabilityGuard)');
const membersPage = readFileSync(pathResolve(ROOT, 'src/pages/Members.tsx'), 'utf8');
ok(/navigate\(`\/members\/\$\{member\.id\}`\)/.test(membersPage), 'Members list has the 360° button');
const portalPage = readFileSync(pathResolve(ROOT, 'src/pages/MemberPortal.tsx'), 'utf8');
ok(/<MemberAccountView member=\{m\} view=\{v\} verticals=\{vv\} hi=\{hi\} \/>/.test(portalPage), 'the member portal renders the SAME MemberAccountView');

// ── 360-c: labels, print, source links, admin portal status ──
const strip2 = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const verticalsUi = strip2('src/components/member-portal/PortalVerticals.tsx');
ok(!/'इस वर्ष'|'this year'/.test(verticalsUi), 'no "this year" milk label (staff sees ALL milk — founder\'s Mik Member PDF)');
ok(/\(कुल\)/.test(verticalsUi) && /\(all time\)/.test(verticalsUi), 'staff milk labels say "कुल" / "all time"');
ok(verticals.dairy.milkFrom === undefined, 'staff snapshot carries no milk window (so the "all time" label applies)');
const accountUi = strip2('src/components/member-portal/MemberAccountView.tsx');
ok(/addEventListener\('beforeprint'/.test(accountUi) && /addEventListener\('afterprint'/.test(accountUi), 'print opener lives in the SHARED view (portal + 360)');
ok(!/beforeprint/.test(strip2('src/pages/MemberPortal.tsx')), 'no duplicate print opener left in the portal page');
ok(/print:hidden fixed bottom-5 right-5/.test(strip2('src/components/FeedbackFab.tsx')), 'feedback button is never printed (was overlapping the statement)');
const header = strip2('src/components/member-portal/SectionHeader.tsx');
ok(/print:hidden/.test(header), 'source links are never printed');
const p360 = strip2('src/pages/Member360.tsx');
for (const [k, to] of [['share', '/share-register'], ['loans', '/loan-register'], ['deposits', '/deposits'], ['kcc', '/kcc-loan'], ['dairy', '/dairy-registers'], ['housing', '/member-statement'], ['consumer', '/member-credit']]) {
  ok(new RegExp(`${k}: \\{ to: '${to.replace('/', '\\/')}'`).test(p360), `section ${k} links to ${to}`);
}
const appSrc = readFileSync(pathResolve(ROOT, 'src/App.tsx'), 'utf8');
for (const to of ['/share-register', '/loan-register', '/deposits', '/kcc-loan', '/dairy-registers', '/member-statement', '/member-credit']) {
  ok(appSrc.includes(`path="${to}"`), `link target ${to} is a real route`);
}
ok(/if \(!isAdmin \|\| !id\) return;/.test(p360) && /\{isAdmin && \(\s*<MemberPortalDialog/.test(p360), 'portal-login status + dialog: admin only (non-admins never call the function)');
ok(!/links=/.test(strip2('src/pages/MemberPortal.tsx')), 'the member portal passes NO staff links');

console.log(`member-360 (staff) parity: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
