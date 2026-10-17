// Member-audit M3 — share & nomination rules (2026-10-17). Legal checks WARN (never block); data rules enforce.
//   s.6 one-fifth / ₹5 lakh holding cap · s.22 two-year holding before transfer · r.18(3) refunds ≤ 5% of the
//   paid-up capital on the previous 31 March · r.21 nominees ≤ shares, every member nominates.
//   Enforced: shares only to / for a live approved member; a certificate number belongs to one member.
//   Plus the share certificate PDF.
// Run: node scripts/test-member-m3.mjs   (npm run test:member-m3)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = await import(pathToFileURL(resolve(ROOT, 'src/lib/members/shareRules.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── s.6 ──
ok(R.shareHoldingLimit(1_000_000) === 200_000, 'one-fifth of ₹10 lakh = ₹2 lakh');
ok(R.shareHoldingLimit(10_000_000) === 500_000, '₹5 lakh when one-fifth is higher (whichever is less)');
ok(R.shareCapWarning(200_000, 1_000_000) === null, 'exactly at the limit — fine');
ok(/धारा 6/.test(R.shareCapWarning(200_100, 1_000_000) ?? '') && /1\/5/.test(R.shareCapWarning(200_100, 1_000_000)), 'over one-fifth warns, names s.6');
ok(/₹5 लाख/.test(R.shareCapWarning(600_000, 10_000_000) ?? ''), 'over ₹5 lakh warns with the rupee cap');
ok(R.shareCapWarning(0, 100) === null, 'nothing held — no warning');

// ── s.22 ──
ok(R.addTwoYears('2024-02-29') === '2026-02-28' && R.addTwoYears('2024-10-17') === '2026-10-17', 'two years, leap-day clamped');
ok(R.transferHoldingWarning('2024-10-17', '2026-10-17') === null, 'exactly two years — allowed');
ok(/धारा 22/.test(R.transferHoldingWarning('2025-01-01', '2026-10-17') ?? '') && /01\/01\/2027/.test(R.transferHoldingWarning('2025-01-01', '2026-10-17')), 'under two years warns with the eligible date');
ok(R.transferHoldingWarning(undefined, '2026-10-17') === null, 'unknown holding date — no claim');
ok(R.sharesHeldSince({ admissionDate: '2025-04-01', joinDate: '2024-01-01' }) === '2025-04-01' && R.sharesHeldSince({ joinDate: '2024-01-01' }) === '2024-01-01', 'held since admission, else join date');

// ── enforced data rule ──
ok(R.canHoldShares({ status: 'active' }) && R.canHoldShares({ status: 'inactive', approvalStatus: 'approved' }), 'active / inactive approved members hold shares');
for (const st of ['resigned', 'expelled', 'deceased']) ok(!R.canHoldShares({ status: st }), `${st}: no shares`);
ok(!R.canHoldShares({ status: 'active', approvalStatus: 'pending' }) && !R.canHoldShares({ status: 'active', isDeleted: true }) && !R.canHoldShares(undefined), 'pending / deleted / missing: no shares');

// ── r.18(3) ──
ok(R.previousMarch31('2026-10-17') === '2026-03-31' && R.previousMarch31('2027-02-10') === '2026-03-31' && R.previousMarch31('2026-04-01') === '2026-03-31' && R.previousMarch31('2026-03-31') === '2025-03-31', 'previous 31 March');
ok(R.refundLimitWarning({ paidUpOnBaseDate: 100_000, refundedThisYear: 3_000, thisRefund: 2_000, baseDate: '2026-03-31' }) === null, '5% exactly — fine');
ok(/नियम 18\(3\)/.test(R.refundLimitWarning({ paidUpOnBaseDate: 100_000, refundedThisYear: 3_000, thisRefund: 2_001, baseDate: '2026-03-31' }) ?? ''), 'over 5% warns, names r.18(3)');
ok(R.refundLimitWarning({ paidUpOnBaseDate: 0, refundedThisYear: 0, thisRefund: 500, baseDate: '2026-03-31' }) === null, 'no paid-up base (new society) — no claim');

// ── r.21 ──
ok(R.nomineeCountWarning(2, 1) && R.nomineeCountWarning(1, 1) === null && R.nomineeCountWarning(3, undefined) === null, 'nominees ≤ shares; unknown share count → no claim');

// ── certificate number ──
const ms = [{ id: 'a', shareCertNo: 'SC-1' }, { id: 'b', shareCertNo: 'sc-2' }, { id: 'c', shareCertNo: 'SC-3', isDeleted: true }];
ok(R.certificateNoTakenBy(ms, ' sc-2 ', 'a')?.id === 'b', 'taken by another member (case/space-insensitive)');
ok(!R.certificateNoTakenBy(ms, 'SC-1', 'a') && !R.certificateNoTakenBy(ms, 'SC-3', 'a') && !R.certificateNoTakenBy(ms, '', 'a'), 'own number / deleted member / blank → free');

// ── wiring ──
const dc = read('src/contexts/DataContext.tsx');
const fn = (name) => { const i = dc.indexOf(`const ${name} = useCallback(`); return dc.slice(i, dc.indexOf('\n  }, [', i)); };
ok(fn('purchaseShareCapital').indexOf('if (!canHoldShares(member))') > 0 && fn('purchaseShareCapital').indexOf('if (!canHoldShares(member))') < fn('purchaseShareCapital').indexOf('addVoucher('), 'purchase refused for a non-live member, before any voucher');
ok(fn('transferShareCapital').indexOf('if (!canHoldShares(to))') > 0 && fn('transferShareCapital').indexOf('if (!canHoldShares(to))') < fn('transferShareCapital').indexOf('addVoucher('), 'transfer refused to a non-live recipient, before any voucher');

const sr = read('src/pages/ShareRegister.tsx');
ok(sr.includes("getTrialBalance(base).find(b => b.account.id === '1102')") && sr.includes("t.type === 'refund' && t.date > base && t.date <= date"), 'r.18(3) base = 1102 on the previous 31 March, refunds since');
ok(sr.includes('shareCapWarning(cap + val, rules.totalCapital + val)') && sr.includes('rules.refundCheck(date, val)'), 'purchase / refund dialogs warn');
ok(sr.includes('const warning = approving && val > 0 ? rules.refundCheck(date, val) : null;'), 'approve-refund warns');
ok(sr.includes('members.filter(m => m.id !== member.id && canHoldShares(m))') && sr.includes('transferHoldingWarning(sharesHeldSince(member), date)'), 'transfer: live recipients only + two-year warning');
ok(sr.includes('{canHoldShares(m) && <ShareTxnButton member={m} hi={hi} kind="purchase"'), 'no "add shares" for an exited member');
ok(/<Button disabled=\{!\(val > 0\) \|\| overCap\} onClick=\{\(\) => \{ onSubmit/.test(sr), 'warnings never disable the post button');

const mem = read('src/pages/Members.tsx');
ok(mem.includes('nomineeCountWarning((form.nomineeName.trim() ? 1 : 0) + cleanNominees.length') && mem.includes("नियम 21: हर सदस्य नामांकन करेगा"), 'nomination warnings on add + edit');
ok(mem.includes('certificateNoTakenBy(allMembers, certForm.certNo, certMember.id)'), 'duplicate certificate number refused');
ok(mem.includes('generateShareCertificatePDF(certMember, society)') && sr.includes('generateShareCertificatePDF(m, society)'), 'certificate PDF from Members + Share Register');

const pdf = read('src/lib/pdf.ts');
ok(/export function generateShareCertificatePDF\(/.test(pdf) && pdf.includes("new jsPDF('l', 'mm', 'a5')") && pdf.includes("'SHARE CERTIFICATE'"), 'share certificate PDF (landscape A5)');

// Live M925 certificate (2026-10-17): "Rs. Rs. 100.00" (fmt already says Rs.) and a two-line address overprinting the next line.
ok(!/Rs\. \$\{(face \? )?fmt\(/.test(pdf), 'no "Rs. " before fmt() anywhere in pdf.ts (fmt prints Rs. itself)');
const cert = pdf.slice(pdf.indexOf('export function generateShareCertificatePDF('));
ok(cert.includes("text.replace(/\\s*\\n\\s*/g, ', ')") && cert.includes('y += (lines.length - 1) * 4.6 + gap;') && cert.includes('block(`Resident of: ${member.address}`, 7)'), 'certificate wraps each field and moves down by its line count');

console.log(`member-m3: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
