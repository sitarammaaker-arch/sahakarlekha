// Member-area re-audit 2026-10-17 — stage A (data integrity, no migration).
//   H-1 share khata keeps an old member's opening · H-2 joining receipts only after the member row saved ·
//   H-3 share ops unwind their voucher on a failed member save, system share debits not cancellable alone ·
//   M-1 approve/reject dialog stays open on an error · M-2 application PDF after the cloud save ·
//   M-3 member status toast/audit after the cloud · M-4 a blanked admission field is written as null ·
//   M-6 no NEW loan / deposit account for a non-live member · M-11 flat / premium "saved" toasts wait for the cloud.
// Run: node scripts/test-member-stage-a.mjs   (npm run test:member-stage-a)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const O = await import(pathToFileURL(resolve(ROOT, 'src/lib/members/shareOpening.ts')).href);
const A = await import(pathToFileURL(resolve(ROOT, 'src/lib/members/admission.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const between = (src, from, to) => { const i = src.indexOf(from); const j = src.indexOf(to, i + from.length); return i < 0 || j < 0 ? '' : src.slice(i, j); };

// ── H-1: the opening rule (paise) ──
const cr = (date, amountMinor) => ({ date, isCredit: true, amountMinor });
const dr = (date, amountMinor) => ({ date, isCredit: false, amountMinor });
ok(O.memberShareOpeningMinor(50000, '2023-04-01', []) === 50000, 'no vouchers ⇒ the scalar is the opening');
ok(O.memberShareOpeningMinor(150000, '2023-04-01', [cr('2026-07-01', 50000)]) === 100000, 'old member + later purchase ⇒ opening = scalar − purchase');
ok(O.memberShareOpeningMinor(60000, '2023-04-01', [dr('2026-07-01', 40000)]) === 100000, 'old member + later refund ⇒ opening = scalar + refund');
ok(O.memberShareOpeningMinor(50000, '2026-08-19', [cr('2026-08-19', 40000), dr('2026-08-19', 15000)]) === 0, 'joining voucher on the join date ⇒ no opening (the gap stays visible)');
ok(O.memberShareOpeningMinor(50000, '2026-08-19', [cr('2026-08-01', 50000)]) === 0, 'a share credit before the join date also counts as the joining receipt');
ok(O.memberShareOpeningMinor(10000, '2023-04-01', [cr('2026-07-01', 50000)]) === 0, 'vouchers above the scalar ⇒ no invented negative opening');
ok(O.memberShareOpeningMinor(0, undefined, [cr('2026-07-01', 100)]) === 0, 'no join date ⇒ any share credit is the joining receipt (legacy rule)');
const snap = read('src/lib/memberSnapshot.ts'), jl = read('src/lib/ledger/memberLedger.ts');
ok(snap.includes('memberShareOpeningMinor(') && jl.includes('memberShareOpeningMinor('), 'voucher path AND journal path use the one opening rule (RULE 2)');
ok(!/hasShareCapVoucher \? 0/.test(snap) && !/hasShareCapVoucher \? 0/.test(jl), 'the old "any Cr voucher ⇒ start at 0" rule is gone from both');

// ── M-4: blanked admission fields ──
ok(JSON.stringify(A.clearedAdmissionFields({ admissionResolutionNo: '', admissionDate: '2026-10-01' }, { admissionResolutionNo: 'R/5', admissionDate: '2026-09-01' })) === '["admissionResolutionNo"]', 'a blanked resolution no. is reported');
ok(A.clearedAdmissionFields({ admissionResolutionNo: '' }, { admissionResolutionNo: '' }).length === 0, 'blank → blank is not a change');
ok(A.clearedAdmissionFields({ name: 'x' }, { admissionResolutionNo: 'R/5' }).length === 0, 'a field the edit does not touch is not cleared');
ok(A.clearedAdmissionFields({ rejectionReason: undefined }, { rejectionReason: 'out of area' })[0] === 'rejectionReason', 'undefined counts as blanked');

const dc = read('src/contexts/DataContext.tsx');
ok(/const persistMemberAdmission = \(id: string, member: Record<string, any>, cleared: readonly string\[\] = \[\]\)/.test(dc)
  && dc.includes('Object.fromEntries(cleared.map(f => [f, null]))'), 'persistMemberAdmission writes blanked fields as null');
ok(dc.includes('clearedAdmissionFields(data as Record<string, unknown>, oldMember as unknown as Record<string, unknown>)'), 'updateMember passes the blanked admission fields');

// ── H-2: addMember receipts after the save ──
const add = between(dc, 'const addMember = useCallback(', '}, [postJoiningReceipts]);');
const addSuccess = between(add, 'persistMemberAdmission(newMember.id, newMember);', 'opts.onSaved?.(newMember);');
ok(add.length > 0 && addSuccess.includes("if (newMember.approvalStatus !== 'pending') postJoiningReceipts(newMember, { quiet: opts.quiet });"), 'addMember posts joining receipts inside the cloud-success branch');
ok(!/attemptMemberSave\(newMember\);\s*\n[^]*?postJoiningReceipts/.test(between(add, 'attemptMemberSave(newMember);\n    return', 'return newMember;')), 'no receipt posted after attemptMemberSave returns (optimistic)');
ok(add.includes('opts.onFailed?.();'), 'addMember tells the page when the cloud refused (onFailed)');

// updateMember: the auto-voucher re-sync waits for the save
const upd = between(dc, 'const updateMember = useCallback(', '}, [updateVoucher]);');
const updSuccess = between(upd, 'const attemptMemberUpdate = (payload: Member) => {', 'attemptMemberUpdate(updatedMember);');
ok(updSuccess.includes("resyncMemberVoucher(ACCOUNT_IDS.SHARE_CAP, data.shareCapital, 'Share Capital');") && updSuccess.includes("resyncMemberVoucher(ACCOUNT_IDS.ADM_FEE, data.admissionFee, 'Admission Fee');"), 'updateMember re-syncs the auto-voucher only after the member saved');
ok(updSuccess.indexOf('resyncMemberVoucher(') > updSuccess.indexOf('return;'), '…after the failure branch has returned');

// ── H-3: share ops unwind their voucher; system share debits not cancellable alone ──
for (const [fn, end] of [['const refundShareCapital = useCallback(', '}, [accounts, addVoucher, user]);'], ['const shareOperation = useCallback(', '}, [accounts, addVoucher]);'], ['const purchaseShareCapital = useCallback(', '}, [accounts, addVoucher, user]);']]) {
  const body = between(dc, fn, end);
  ok(/cancelLinkedVouchers\(\[voucher\.id\]/.test(body), `${fn.slice(6, -15)}: a failed member save cancels the voucher too`);
}
const appr = between(dc, 'const approveShareRefund = useCallback(', 'const payShareRefund = useCallback(');
ok(appr.includes('cancelLinkedVouchers([v.id]') && !appr.includes('cancelVoucher(v.id'), 'approveShareRefund rolls back via the cascade path (no delete-right dependency)');
const tr = between(dc, 'const transferShareCapital = useCallback(', '// ══ Deposits module');
ok(tr.includes("unwind([outHalf.id], 'Share transfer incomplete (second half not posted)')"), 'transfer: a missing second half unwinds the first (no "cancel it yourself" dead end)');
ok(tr.includes('if (!premV?.id)') && tr.includes('unwind([outHalf.id, inHalf.id]'), 'transfer: a refused premium unwinds both halves');
ok(tr.includes("unwind(transferVoucherIds, 'Share transfer not saved (cloud save failed)')"), 'transfer: a failed member save unwinds every transfer voucher');
ok(tr.includes('upsert(memberRow(beforeFrom))'), 'transfer: the transferor row that DID save is restored in the cloud');
ok(!tr.includes('पहला वाउचर (${outHalf.voucherNo || outHalf.id}) रद्द करें और दोबारा करें'), 'the impossible instruction is gone');
const cv = between(dc, 'const cancelVoucher = useCallback(', 'if (current.memberId && (current.creditAccountId === ACCOUNT_IDS.SHARE_CAP');
ok(cv.includes("current.memberId && current.debitAccountId === ACCOUNT_IDS.SHARE_CAP && current.origin !== 'manual' && !opts?.viaParent"), 'cancelVoucher refuses a system share-capital debit (scalar would stay reduced); hand-made vouchers stay cancellable');

// ── M-3: status change ──
const st = between(dc, 'const changeMemberStatus = useCallback(', '}, []);');
const stThen = between(st, "supabase.from('members').update({ status: newStatus })", 'return true;');
ok(stThen.indexOf("'✅ सदस्य स्थिति अपडेट'") > stThen.indexOf('return;') && stThen.indexOf('emitAudit(') > stThen.indexOf('return;'), 'status toast + audit only after the base update succeeded');
ok(st.includes("'स्थिति सेव हुई — पर तिथि/कारण नहीं'") && !st.includes("console.warn('Member status metadata not persisted"), 'a lost ceased-on date / reason is said, not console.warn (RULE 1)');

// ── M-1 / M-2: pages ──
const mem = read('src/pages/Members.tsx');
ok(mem.includes('const confirmDecision = (): boolean =>') && mem.includes('onClick={e => { if (!confirmDecision()) e.preventDefault(); }}'), 'approve/reject dialog stays open when validation fails');
const app = read('src/pages/MemberApplication.tsx');
const onSaved = between(app, 'onSaved: async m => {', 'onFailed: () => setSubmitting(false),');
ok(onSaved.includes('generateMemberApplicationPDF(m, society, photoUrl);') && onSaved.includes("navigate('/members?tab=pending');"), 'application PDF + navigation only once the cloud has it');
ok(app.indexOf('generateMemberApplicationPDF(') === app.lastIndexOf('generateMemberApplicationPDF(') && app.indexOf('generateMemberApplicationPDF(') > app.indexOf('onSaved: async m => {'), 'no PDF outside onSaved');
ok(app.includes('if (submitting) return;') && app.includes('disabled={submitting}'), 'no double application while the first is saving');

// ── M-6: new loans / deposit accounts only for a live member ──
ok(dc.includes('const refuseNonLiveMember = (memberId: string | undefined, what: string): boolean =>'), 'refuseNonLiveMember helper exists');
ok(between(dc, 'const addLoan = useCallback(', 'const loanNo').includes("refuseNonLiveMember(data.memberId, 'ऋण')"), 'addLoan refuses a non-live member');
ok(between(dc, 'const addDepositAccount = useCallback(', 'const { openingAmount').includes("refuseNonLiveMember(data.memberId, 'जमा खाता')"), 'addDepositAccount refuses a non-live member');
const lr = read('src/pages/LoanRegister.tsx');
ok(lr.includes('members={lendableMembers} onSubmit={handleAdd}') && lr.includes('if (!created.id) return;'), 'Loan Register: add form lists live members only; no "added" toast on a refusal');
ok(read('src/pages/Deposits.tsx').includes('approvedMembers.filter(canHoldShares).map('), 'Deposits: new-account picker lists live members only');

// ── M-11: toasts wait for the cloud ──
const hd = read('src/contexts/HousingDataContext.tsx');
ok(hd.includes('updateHousingFlat: (id: string, data: Partial<HousingFlat>, opts?: { onSaved?: () => void }) => boolean;') && between(hd, 'const updateHousingFlat = useCallback(', '}, [housingFlats]);').includes('opts?.onSaved?.();'), 'updateHousingFlat reports refusal + cloud success');
ok(read('src/pages/ShareNominationRegister.tsx').includes("{ onSaved: () => toast({ title: hi ? 'सहेजा गया' : 'Saved' }) }"), 'Share/nomination register "saved" waits for the cloud');
ok(read('src/pages/ShareRegister.tsx').includes("onSaved: () => toast({ title: hi ? 'प्रीमियम सीमा सहेजी' : 'Premium cap saved' })"), 'premium cap "saved" waits for the cloud');

console.log(`member-stage-a: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
