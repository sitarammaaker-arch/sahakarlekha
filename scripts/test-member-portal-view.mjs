// Member Portal S3 — the member's login page + dashboard.
//   1. PARITY: the browser's memberLoginEmail (src/lib/memberPortalLogin.ts) must equal the Edge
//      Function's (supabase/functions/_shared/member-portal-core.mjs) — else no member can log in.
//   2. buildPortalView reproduces the staff formulas (S0 functions) from a snapshot payload.
//   3. Static guards: separate client + sessionStorage, public route outside ProtectedRoute, noindex.
// Run: node scripts/test-member-portal-view.mjs
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
const browser = await imp('src/lib/memberPortalLogin.ts');
const server = await imp('supabase/functions/_shared/member-portal-core.mjs');
const { buildPortalView, deniedMessage } = await imp('src/lib/memberPortalView.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. login-email parity (browser ⇔ Edge Function) ──
const cases = [
  ['SOC001', 'M-001'], ['SOC001', ' m-001 '], ['d5e007f0-fef0-48dd-b5dc-7230ce0aa82c', '17'],
  ['d5e007f0-fef0-48dd-b5dc-7230ce0aa82c', 'स-१२'], ['8fa05310', 'A/B 2024-25'], ['x', 'X'.repeat(300)],
];
for (const [sid, no] of cases) {
  ok(await browser.memberLoginEmail(sid, no) === await server.memberLoginEmail(sid, no), `email parity for (${sid}, ${no.slice(0, 20)})`);
  ok(browser.normalizeMemberNo(no) === server.normalizeMemberNo(no), `normalize parity for "${no.slice(0, 20)}"`);
}
ok(browser.MEMBER_EMAIL_DOMAIN === server.MEMBER_EMAIL_DOMAIN, 'same members-only domain');
ok(browser.memberPortalPath('SOC 1') === '/member/SOC%201', 'portal path encodes the society id');

// ── 2. view builder ──
const SC = '1102';
const v = (o) => ({ id: o.id, voucherNo: o.id, type: 'receipt', date: o.date, createdAt: `${o.date}T00:00:00Z`, debitAccountId: o.dr, creditAccountId: o.cr, amount: o.amt, narration: '', memberId: 'm1' });
const snap = {
  ok: true, society: { name: 'Test PACS', nameHi: 'टेस्ट पैक्स' },
  member: { id: 'm1', memberId: 'M-1', name: 'राम', joinDate: '2024-04-01', status: 'active', shareCapital: 500 },
  shareVouchers: [v({ id: 'a', date: '2024-04-01', dr: '1001', cr: SC, amt: '500' }), v({ id: 'b', date: '2024-06-01', dr: SC, cr: '1001', amt: 100.5 })],
  loans: [
    { id: 'l1', loanNo: 'L/1', amount: '10000', repaidAmount: '2500', status: 'active' },
    { id: 'l2', loanNo: 'L/2', amount: 5000, repaidAmount: 5000, status: 'cleared' },
    { id: 'l3', loanNo: 'L/3', amount: 1000, repaidAmount: 0, status: 'overdue' },
  ],
  deposits: [
    { id: 'd1', accountNo: 'SB/1', depositType: 'SB', openDate: '2024-04-01', balance: '1200.25', status: 'active' },
    { id: 'd2', accountNo: 'FD/1', depositType: 'FD', openDate: '2024-04-01', balance: 50000, status: 'closed' },
  ],
  depositTransactions: [
    { id: 't1', depositAccountId: 'd1', date: '2024-04-01', txnType: 'open', amount: 1200.25, balanceAfter: 1200.25 },
    { id: 't2', depositAccountId: 'd2', date: '2024-04-01', txnType: 'open', amount: 50000, balanceAfter: 50000 },
  ],
  kccLoans: [
    { id: 'k1', loanNo: 'K/1', drawnAmount: 9000, repaidAmount: 1000, outstandingAmount: null, status: 'active' },
    { id: 'k2', loanNo: 'K/2', drawnAmount: 3000, repaidAmount: 0, outstandingAmount: 3000, status: 'repaid' },
  ],
};
const view = buildPortalView(snap);
ok(view.shareLedger.length === 2 && view.shareBalance === 399.5, `share ledger via buildMemberShareLedger (balance ${view.shareBalance})`);
ok(view.loans[0].outstanding === 7500, 'loan outstanding via loanOutstanding (string amounts coerced)');
ok(view.loanOutstandingTotal === 8500, `loan total excludes cleared (got ${view.loanOutstandingTotal})`);
ok(view.depositTotal === 1200.25, `deposit total excludes closed (got ${view.depositTotal})`);
ok(view.deposits[0].transactions.length === 1 && view.deposits[0].transactions[0].id === 't1', 'deposit transactions grouped per account');
ok(view.kccLoans[0].outstanding === 8000, 'KCC outstanding falls back to drawn − repaid when stored is null');
ok(view.kccOutstandingTotal === 8000, `KCC total excludes repaid (got ${view.kccOutstandingTotal})`);
const obOnly = buildPortalView({ ...snap, shareVouchers: [], loans: [], deposits: [], depositTransactions: [], kccLoans: [] });
ok(obOnly.shareLedger.length === 1 && obOnly.shareLedger[0].voucherNo === 'OB' && obOnly.shareBalance === 500, 'no voucher ⇒ OB row from share-capital scalar');
const none = buildPortalView({ ...snap, member: { ...snap.member, shareCapital: 0 }, shareVouchers: [], loans: [], deposits: [], depositTransactions: [], kccLoans: [] });
ok(none.shareBalance === 0 && none.loanOutstandingTotal === 0 && none.depositTotal === 0 && none.kccOutstandingTotal === 0, 'empty member → all zero');
const precise = buildPortalView({ ...snap, deposits: [0.1, 0.2].map((b, i) => ({ id: `p${i}`, accountNo: '', depositType: 'SB', openDate: '', balance: b, status: 'active' })) });
ok(precise.depositTotal === 0.3, 'totals are paise-exact (0.1 + 0.2 = 0.3)');
for (const r of ['no_access', 'member_inactive', 'plan_unavailable']) ok(/[ऀ-ॿ]/.test(deniedMessage(r, true)) && deniedMessage(r, false).length > 0, `Hindi + English denial: ${r}`);

// ── 3. static guards ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const client = strip('src/lib/memberPortalClient.ts');
ok(/storageKey: MEMBER_PORTAL_STORAGE_KEY/.test(client) && /'sl-member-portal'/.test(client), 'own storageKey (never overwrites the staff session)');
ok(/window\.sessionStorage/.test(client) && !/localStorage/.test(client), 'session lasts until the browser closes (sessionStorage, founder decision)');
ok(!/from '\.\/supabase'|from '@\/lib\/supabase'/.test(client), 'does NOT reuse the staff supabase client');
ok(/signOut\(\{ scope: 'local' \}\)/.test(client) && /removeItem\(MEMBER_PORTAL_STORAGE_KEY\)/.test(client), 'logout clears THIS device even with no network (scope local + key removed)');
ok(/rpc\('member_portal_snapshot'\)/.test(client) && !/\.from\(/.test(client), 'data only via the snapshot RPC — no direct table reads');
const page = strip('src/pages/MemberPortal.tsx');
ok(/robots: 'noindex, nofollow'/.test(page), 'portal page is noindex');
ok(!/@\/lib\/supabase'|useAuth\(|useData\(/.test(page), 'page never touches staff auth/data contexts');
ok(/setPin\(''\)/.test(page) && !/localStorage|sessionStorage/.test(page), 'PIN cleared after submit and never stored');
ok(/सदस्य संख्या या PIN गलत है/.test(page), 'one generic error for wrong number/PIN');
const app = strip('src/App.tsx');
ok(/<Route path="\/member\/:societyId" element=\{<MemberPortal \/>\} \/>/.test(app), '/member/:societyId is a public route (no ProtectedRoute)');
ok(/<Route path="\/sadasya\/:societyId" element=\{<SadasyaRedirect \/>\} \/>/.test(app), 'old /sadasya links redirect');
const dlg = strip('src/components/members/MemberPortalDialog.tsx');
ok(/memberPortalPath\(handout\.societyId\)/.test(dlg), 'admin hand-out link uses the same path helper as the router');

console.log(`member-portal view (S3): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
