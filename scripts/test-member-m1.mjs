// Member-audit M1 — data safety in the member area (2026-10-16 audit, D1–D9 + U4/U9).
//   D1 a refused voucher never moves a member's share capital (refund / purchase / transfer ask first, then check)
//   D2 the share count follows the share capital         D3 a member with live records cannot be deleted
//   D4 member changes are audited (Aadhaar/PAN named, never their values)   D5 success messages wait for the cloud
//   D6 member numbers unique across branches + within an import file      D7 share buttons only for roles that may
//   D8 the share-register PDF lists approved members      D9 no portal login for a pending/rejected application
//   U4 the real status label everywhere                   U9 approve / reject ask first
// Run: node scripts/test-member-m1.mjs   (npm run test:member-m1)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const { shareCountFor, withShareCapital } = await imp('lib/shareOps.ts');
const { memberAuditDiff } = await imp('lib/members/memberAudit.ts');
const { computeEntityLinks } = await imp('lib/entityLinks.ts');
const { memberStatusLabel, MEMBER_STATUSES } = await imp('lib/memberLifecycle.ts');
const core = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/member-portal-core.mjs')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── D2: share count follows the capital ──
ok(shareCountFor(100, 500) === 5, '₹500 at ₹100 = 5 shares');
ok(shareCountFor(100, 550) === 5, 'part share floors to whole shares');
ok(shareCountFor(10, 0.3 * 10 * 10) === 3, 'float noise does not lose a share (30 at 10 = 3)');
ok(shareCountFor(undefined, 500, 7) === 7 && shareCountFor(0, 500) === undefined, 'no face value → count unchanged');
const m0 = { id: 'x', shareCapital: 500, shareCount: 5, shareFaceValue: 100, name: 'A' };
const m1 = withShareCapital(m0, 300);
ok(m1.shareCapital === 300 && m1.shareCount === 3 && m1.name === 'A' && m0.shareCount === 5, 'withShareCapital: new amount + count, original untouched');

// ── D4: audit diff ──
const before = { id: 'x', name: 'Ram', phone: '9876543210', aadhaar: '123412341234', pan: '', nominees: [{ name: 'Sita' }] };
const after = { ...before, phone: '9876500000', aadhaar: '999988887777', pan: 'ABCDE1234F', nominees: [{ name: 'Gita' }] };
const d = memberAuditDiff(before, after);
ok(d && d.before.phone === '9876543210' && d.after.phone === '9876500000', 'changed field recorded before → after');
ok(d && d.after.aadhaar === '(changed)' && d.before.aadhaar === '(set)' && !JSON.stringify(d).includes('1234') && !JSON.stringify(d).includes('ABCDE'), 'Aadhaar / PAN never written to the audit row');
ok(d && d.before.pan === null && d.after.pan === '(changed)', 'PAN added: null → (changed)');
ok(d && Array.isArray(d.after.nominees) && !('name' in d.after) && !('id' in d.after), 'only changed keys; nominees compared by value');
ok(memberAuditDiff(before, { ...before, phone: '9876543210', pan: undefined }) === null, 'nothing changed (empty ≡ undefined) → no audit row');

// ── D3: delete pre-check ──
const base = { vouchers: [], loans: [], sales: [], purchases: [], stockMovements: [], salaryRecords: [], suppliers: [], customers: [], assets: [] };
ok(computeEntityLinks('member', 'M', base).length === 0, 'no records → deletable');
ok(computeEntityLinks('member', 'M', { ...base, loans: [{ memberId: 'M', isDeleted: true }] }).length === 0, 'RULE 5: a soft-deleted loan does not block');
ok(computeEntityLinks('member', 'M', { ...base, loans: [{ memberId: 'M' }] }).some((l) => l.module === 'Loans' && l.blocking), 'live loan blocks');
ok(computeEntityLinks('member', 'M', { ...base, depositAccounts: [{ memberId: 'M' }] }).some((l) => l.module === 'Deposits' && l.blocking), 'deposit account blocks');
ok(computeEntityLinks('member', 'M', { ...base, kccLoans: [{ memberId: 'M' }] }).some((l) => l.module === 'KCC' && l.blocking), 'KCC loan blocks');
ok(computeEntityLinks('member', 'M', { ...base, kccLoans: [{ memberId: 'OTHER' }] }).length === 0, "another member's KCC does not block");

// ── U4: status labels ──
ok(MEMBER_STATUSES.every((s) => memberStatusLabel(s) && memberStatusLabel(s, true)), 'every status has both labels');
ok(memberStatusLabel('deceased') === 'Deceased' && memberStatusLabel('resigned', true) === 'त्यागपत्र' && memberStatusLabel(undefined) === 'Active', 'real labels, not Active/Inactive');

// ── D9: portal eligibility ──
ok(core.memberEligible({ memberId: 'M1', status: 'active', approvalStatus: 'pending' }).reason === 'member_not_approved', 'pending application: no login');
ok(core.memberEligible({ memberId: 'M1', status: 'active', approvalStatus: 'rejected' }).reason === 'member_not_approved', 'rejected application: no login');
ok(core.memberEligible({ memberId: 'M1', status: 'active', approvalStatus: 'approved' }).ok && core.memberEligible({ memberId: 'M1', status: 'active' }).ok, 'approved / legacy (no flag) members still eligible');
ok(/[ऀ-ॿ]/.test(core.MESSAGES.member_not_approved), 'Hindi-first refusal message');
ok(read('supabase/functions/member-portal-admin/index.ts').includes("select('id, memberId, name, status, isDeleted, approvalStatus')"), 'edge function reads approvalStatus');

// ── wiring (static) ──
const dc = read('src/contexts/DataContext.tsx');
const fn = (name) => { const i = dc.indexOf(`const ${name} = useCallback(`); return i < 0 ? '' : dc.slice(i, dc.indexOf('\n  }, [', i)); };
for (const name of ['refundShareCapital', 'purchaseShareCapital']) {
  const body = fn(name);
  const guard = body.indexOf('if (voucherBirthBlocked(date)) return;');
  const check = body.indexOf('if (!voucher?.id) return;');
  const move = body.indexOf('withShareCapital(');
  ok(guard > 0 && check > guard && move > check, `${name}: refusals asked, voucher checked, THEN the capital moves (D1)`);
}
const tr = fn('transferShareCapital');
ok(tr.indexOf('voucherBirthBlocked(date)') > 0 && tr.indexOf('if (!outHalf?.id) return;') > 0 && tr.indexOf('if (!inHalf?.id)') > 0
  && tr.indexOf('withShareCapital(from') > tr.indexOf('if (!inHalf?.id)'), 'transfer: both halves must post before either member moves (D1)');
ok(/const voucherBirthBlocked = \(date: string\): boolean => \{[\s\S]*?guardPermission\('create'[\s\S]*?guardFYLocked\(\)[\s\S]*?guardSubscriptionExpired\(\)[\s\S]*?guardPeriodLock\(date\)/.test(dc), 'voucherBirthBlocked = the same refusals as addVoucher');
for (const name of ['refundShareCapital', 'approveShareRefund', 'shareOperation', 'purchaseShareCapital']) ok(fn(name).includes('withShareCapital('), `${name}: share count kept in step (D2)`);
const del = fn('deleteMember');
ok(del.indexOf("computeEntityLinks('member'") > 0 && del.indexOf('.filter(l => l.blocking)') > 0 && del.indexOf('if (live.length)') < del.indexOf("supabase.from('members').update({ isDeleted: true })"), 'deleteMember refuses live records before the soft delete (D3)');
ok(del.includes('depositAccounts: depositAccountsRef.current, kccLoans: kccLoansRef.current'), 'deleteMember checks deposits + KCC');
ok(fn('addMember').includes("action: 'create'") && fn('addMember').includes('opts.onSaved?.(newMember)'), 'addMember: audit + onSaved after the cloud (D4/D5)');
ok(fn('updateMember').includes('memberAuditDiff(') && fn('updateMember').includes('opts?.onSaved?.()') && fn('updateMember').includes('return true;'), 'updateMember: audit diff, onSaved, boolean result');
ok(fn('approveMember').includes("action: 'approve'") && fn('rejectMember').includes("action: 'reject'"), 'approve / reject audited');
ok(!/console\.info\(`\[AUDIT\] Member id=/.test(dc), 'console-only "audit" lines replaced');

const mem = read('src/pages/Members.tsx');
ok(mem.includes('blockOnLinks') && mem.includes('softDelete'), 'member delete dialog blocks on red links + says soft delete');
ok(!/deleteMember\(deleteGuard\.id\);\s*toast\(/.test(mem), 'no page toast right after delete (D5)');
ok(/onSaved: m => \{?\s*toast\(\{\s*title: hi \? 'सदस्य जोड़ा गया'/.test(mem) && mem.includes('if (!created.id) return;'), 'add: toast on save, form kept on refusal');
ok(mem.includes("allMembers.some(m => m.memberId.trim().toLowerCase() === memberId.toLowerCase())"), 'member number unique across branches (D6)');
ok(mem.includes("openDecision(member, 'approve')") && mem.includes('setDecision({ member, action })') && mem.includes('confirmDecision'), 'approve / reject go through a confirmation (U9)');
ok(!/approveMember\(member\.id\);\s*toast\(/.test(mem), 'no premature approve toast');

const dlg = read('src/components/LinkedDeleteDialog.tsx');
ok(dlg.includes("step === 'links' && !(blockOnLinks && hasBlocking)"), '"Proceed anyway" hidden when links block');

const sr = read('src/pages/ShareRegister.tsx');
ok(sr.includes("const canPost = can('create');") && sr.includes('{canPost && <>') && sr.includes('{canEdit && <Button'), 'share buttons gated by role (D7)');
ok(sr.includes('generateShareRegisterPDF(approvedMembers, society)'), 'share register PDF = approved members (D8)');

const imp2 = read('src/pages/UniversalImporter.tsx');
ok(imp2.includes('const seen = new Set(members.map(m => m.memberId.trim().toLowerCase()));') && imp2.includes('repeatedInFile++'), 'import skips a member number repeated in the file (D6)');
ok(imp2.includes("entityId: 'bulk', action: 'create'"), 'one audit row per member import');

for (const f of ['src/pages/Form1MemberList.tsx', 'src/pages/ShareRegister.tsx', 'src/lib/pdf.ts', 'src/pages/Members.tsx']) {
  ok(!/status === 'active' \? (\(hi \? 'सक्रिय' : 'Active'\)|'Active') : (\(hi \? 'निष्क्रिय' : 'Inactive'\)|'Inactive')/.test(read(f)), `${f}: no Active/Inactive collapse (U4)`);
}
ok(read('src/pages/Form1MemberList.tsx').includes("list.filter(m => m.status !== 'active')"), 'Form-1 "not active" filter reaches resigned/expelled/deceased');
ok(read('src/pages/MemberApplication.tsx').includes('if (!newMember.id) { setSubmitting(false); return; }'), 'application refused → no PDF, no "submitted"');

console.log(`member-m1: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
