// Quick UX P0s (product audit 2026-11-17: UX-01, UX-02, UX-03, UX-06).
//   UX-03  the add-member form defaulted the admission date to today → a cash receipt for every old member.
//   UX-01  "submit for approval" was always offered and stuck → vouchers silently kept out of the books.
//   UX-02  the "सदस्य शेयर पूंजी" quick tile credited 1102 without moving any member's shares.
//   UX-06  Society Setup "बैकअप" downloaded eleven browser keys and called it a backup; its restore wrote them back.
// Run: node scripts/test-ux-p0-quick.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── UX-03: the live receipt line comes from the same plan the save posts ──
{
  const { joiningPreviewLine, planJoiningReceipts } = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/members/joiningReceipts.ts')).href);
  const opts = { financialYear: '2026-27', today: '2026-11-18', bankAccountId: 'B1' };
  const m = (o) => ({ name: 'राम', shareCapital: 500, admissionFee: 10, paymentMode: 'cash', ...o });
  const empty = joiningPreviewLine(m({ joinDate: '' }), opts, false);
  ok(empty.tone === 'warn' && /Choose the admission date/.test(empty.text), 'an empty date asks for it — nothing is assumed');
  const old = joiningPreviewLine(m({ joinDate: '1998-06-01' }), opts, false);
  ok(old.tone === 'info' && /no receipt/.test(old.text) && /₹510/.test(old.text), 'an old member: no receipt, the amount goes to the opening balances');
  ok(planJoiningReceipts(m({ joinDate: '1998-06-01' }), opts).mode === 'historical', 'and that is what the save does');
  const fresh = joiningPreviewLine(m({ joinDate: '2026-11-18' }), opts, false);
  ok(fresh.tone === 'warn' && /receipt will be made/.test(fresh.text) && /₹510 \(cash\)/.test(fresh.text) && /old member/.test(fresh.text), 'a date in this year says a cash receipt will be made — and warns an old member');
  ok(/bank/.test(joiningPreviewLine(m({ joinDate: '2026-11-18', paymentMode: 'cheque' }), opts, false).text), 'a cheque goes to the bank');
  ok(/कोई रसीद नहीं/.test(joiningPreviewLine(m({ joinDate: '2026-11-18', shareCapital: 0, admissionFee: 0 }), opts, true).text), 'no amount → no receipt (Hindi, RULE 7)');
  ok(/दाख़िला तिथि चुनें/.test(joiningPreviewLine(m({ joinDate: '' }), opts, true).text), 'the empty-date line in Hindi');

  const page = read('src/pages/Members.tsx');
  const empty0 = page.slice(page.indexOf('const EMPTY_FORM'), page.indexOf('interface MemberFormProps'));
  ok(/joinDate: '',/.test(empty0) && !/joinDate: todayStr\(\)/.test(empty0), 'the add form starts with NO admission date');
  ok(/required=\{!isEdit\}/.test(page) && /data-testid="member-receipt-preview"/.test(page), 'the date is required on add, with the live receipt line under it');
  const add = page.slice(page.indexOf('const handleAdd'), page.indexOf('const handleEdit'));
  ok(/if \(!form\.joinDate\) \{[\s\S]{0,400}return;/.test(add), 'saving with an untouched date is refused');
  ok(/joining=\{\{ financialYear: society\.financialYear/.test(page), 'the line uses the society\'s financial year and default bank');
}

// ── UX-01: the approval tick only where approval is on; never sticky; a pending voucher says so ──
{
  const v = read('src/pages/Vouchers.tsx');
  ok(/const approvalOn = !!society\.approvalRequired;/.test(v), 'approval is read from the society setting');
  ok((v.match(/\{approvalOn && \(\s*<div className="flex items-center gap-2 pb-2">\s*<input\s*type="checkbox"\s*id="approvalChk[12]"/g) || []).length === 2, 'both approval ticks render only when approval is on');
  ok(!/approvalStatus: submitForApproval \?/.test(v) && (v.match(/approvalStatus: approvalOn && submitForApproval \? 'pending'/g) || []).length === 3, 'no save path marks a voucher pending unless approval is on');
  const opts = v.slice(v.indexOf('const saveOpts'), v.indexOf('// ── Admin-only bulk cancel'));
  ok(/setSubmitForApproval\(false\)/.test(opts), 'the tick resets after every save');
  ok(/sv\.approvalStatus === 'pending'/.test(opts) && /अनुमोदन हेतु भेजा गया/.test(opts) && /नहीं गिना जाएगा/.test(opts), 'a pending save has its own toast: not counted until approved');
  ok(/data-testid="voucher-pending-badge"/.test(v) && /'लंबित'/.test(v), 'the list shows a "लंबित" badge on a pending voucher');
}

// ── UX-02: the share-capital tile goes to the Share Register ──
{
  const s = read('src/lib/storage.ts');
  const tile = s.split('\n').find((l) => l.includes("id: 'share_cap'")) || '';
  ok(/route: '\/share-register'/.test(tile), 'the "सदस्य शेयर पूंजी" tile routes to the Share Register');
  const v = read('src/pages/Vouchers.tsx');
  const apply = v.slice(v.indexOf('const applyTemplate'), v.indexOf('const realBank = bankIds[0]'));
  ok(/if \(tmpl\.route\) \{[\s\S]*navigate\(tmpl\.route\);\s*return;/.test(apply), 'a routed tile navigates and never opens the bare voucher form');
  ok(/शेयर जोड़ें/.test(apply), 'and tells the user which button to press there');
  ok(/'शेयर जोड़ें'/.test(read('src/pages/ShareRegister.tsx')), 'the Share Register really has that "शेयर जोड़ें" button');
}

// ── UX-06: Society Setup links to the real backup; no browser-key export or restore ──
{
  const p = read('src/pages/SocietySetup.tsx');
  ok(!/const handleBackup/.test(p) && !/const handleRestore/.test(p), 'the browser-key export and restore are gone');
  ok(!/localStorage\.setItem\('sahayata_|sahayata_vouchers/.test(p), 'nothing writes browser keys back over the data');
  ok(/data-testid="setup-backup-links"/.test(p) && /to="\/backup-restore"/.test(p) && /to="\/restore-center"/.test(p), 'the tab links to the real backup and the Restore Center');
  ok(/path="\/backup-restore"/.test(read('src/App.tsx')) && /path="\/restore-center"/.test(read('src/App.tsx')), 'both linked routes exist');
}

console.log(`quick UX P0s: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
