// Member-area re-audit — final batch (2026-10-18). The share-capital drift root cause + the last small fixes.
// Run: node scripts/test-member-final.mjs   (npm run test:member-final)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = await import(pathToFileURL(resolve(ROOT, 'src/lib/members/shareRules.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── root cause: manual vouchers on 1102 tagged to a member never moved the member's share ──
ok(R.touchesShareCapital({ debitAccountId: '3301', creditAccountId: '1102' }), 'Cr 1102 detected');
ok(R.touchesShareCapital({ debitAccountId: '1102', creditAccountId: '4403', lines: [{ accountId: '1102' }, { accountId: '4403' }, { accountId: '2106' }] }), 'compound Dr 1102 detected (prod PV/2026/27/133 shape)');
ok(!R.touchesShareCapital({ debitAccountId: '3301', creditAccountId: '4101', lines: [{ accountId: '3301' }, { accountId: '4101' }] }), 'other accounts not flagged');
const dc = read('src/contexts/DataContext.tsx');
const add = dc.slice(dc.indexOf('const addVoucher = useCallback('), dc.indexOf('const addVoucher = useCallback(') + 6000);
ok(add.includes("if (data.origin === 'manual' && data.memberId && touchesShareCapital(data, ACCOUNT_IDS.SHARE_CAP))"), 'addVoucher refuses a member-tagged manual Share Capital voucher');
const upd = dc.slice(dc.indexOf('const updateVoucher = useCallback('), dc.indexOf('const updateVoucher = useCallback(') + 4000);
ok(upd.includes("current.origin === 'manual'") && upd.includes('!(current.memberId && touchesShareCapital(current, ACCOUNT_IDS.SHARE_CAP))'), 'updateVoucher: cannot edit INTO one; an existing one stays fixable');
ok(R.MANUAL_MEMBER_SHARE_VOUCHER_MESSAGE.includes('शेयर रजिस्टर'), 'the refusal points to the Share Register');

// ── M-15: 0 rows changed is a failure ──
ok(/update\(\{ isDeleted: true \}\)\.eq\('id', id\)\.select\('id'\)\.then\(\(\{ data: changed, error: err \}\)/.test(dc), 'member delete checks the row came back');
ok(/update\(\{ status: newStatus \}\)\.eq\('id', id\)\.select\('id'\)/.test(dc), 'status change checks the row came back');

// ── M-10, labels, parser ──
const mem = read('src/pages/Members.tsx');
ok(mem.includes("if (saved && saved.shareCertNo && certForm.status === 'issued') generateShareCertificatePDF(saved, society);") && dc.includes('opts?.onSaved?.(updatedMember);'), 'certificate prints right after saving');
ok(mem.includes('CASTE_OPTIONS.find(o => o.value === viewMember.caste)') && mem.includes("{ cash: 'नकद', cheque: 'चेक', online: 'ऑनलाइन' }"), 'view dialog shows caste / payment mode in Hindi');
const re = /(\d+)\D*$/;
const num = (id) => parseInt((id.match(re) || [])[1] ?? '', 10);
ok(num('HR-12/045') === 45 && num('M001') === 1 && num('M-925') === 925 && Number.isNaN(num('ABC')), 'member number = trailing number');
ok(mem.includes(".map(m => parseInt((m.memberId.match(/(\\d+)\\D*$/) || [])[1] ?? '', 10))"), 'Members uses the trailing-number parser');

console.log(`member-final: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
