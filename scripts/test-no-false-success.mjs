// The false-success pattern: a mutation's guard refuses (FY lock / permission / expired plan /
// state machine) and toasts the reason, then the PAGE toasts "success" anyway. Fixed here for
// approve/reject (boolean contract, like updateVoucher #345) and every page that toasted after
// addVoucher without checking the voucher exists. A regex sweep keeps new ones from appearing.
// Run: node scripts/test-no-false-success.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. approve / reject return a boolean; every guard returns false ──
const dc = strip(read('src/contexts/DataContext.tsx'));
ok(/approveVoucher: \(id: string, approvedBy: string\) => boolean;/.test(dc) && /rejectVoucher: \(id: string, rejectedBy: string, reason: string\) => boolean;/.test(dc), 'interface: approve/reject → boolean');
for (const name of ['approveVoucher', 'rejectVoucher']) {
  const i = dc.indexOf(`const ${name} = useCallback(`);
  const body = dc.slice(i, dc.indexOf('}, [society.fyLocked]);', i));
  ok(/\): boolean => \{/.test(body), `${name}: typed boolean`);
  ok(!/\breturn;/.test(body), `${name}: no bare return (every guard says false)`);
  ok((body.match(/return false;/g) || []).length >= 5 && /return true;\s*$/.test(body.trim()), `${name}: guards → false, applied → true`);
}
const va = strip(read('src/pages/VoucherApproval.tsx'));
ok(/if \(!approveVoucher\(id, [^)]*\)\) return;\s*toast\(/.test(va), 'VoucherApproval: approve toast only on true');
ok(/if \(!rejectVoucher\(rejectId, [^)]*\)[^)]*\)\) return;\s*toast\(/.test(va), 'VoucherApproval: reject toast only on true');

// ── 2. Pages: success only for vouchers that exist ──
const rf = strip(read('src/pages/ReserveFund.tsx'));
ok(/if \(v\?\.id\) posted\+\+; else failed\.push/.test(rf) && /if \(posted > 0\)/.test(rf) && /if \(society\.fyLocked\)/.test(rf), 'ReserveFund: counts real vouchers, lists failures, FY guard');
for (const f of ['src/pages/CashBook.tsx', 'src/pages/BankBook.tsx']) {
  const s = strip(read(f));
  ok(/const v = addVoucher\(/.test(s) && /if \(!v\?\.id\) \{[\s\S]*?return;\s*\}\s*toast\(\{ title: language === 'hi' \? 'एंट्री सहेजी गई'/.test(s), `${f}: "Entry saved" only after the voucher exists`);
}
const br = strip(read('src/pages/BankReconciliation.tsx'));
ok(/const v = addVoucher\(/.test(br) && /if \(!v\?\.id\) \{[\s\S]*?return;\s*\}\s*setRowContra/.test(br), 'BankReconciliation: row cleared only after the voucher exists');
const ar = strip(read('src/pages/AssetRegister.tsx'));
ok(/const dv = addVoucher\(/.test(ar) && /if \(!dv\?\.id\) \{[\s\S]*?updateAsset\(editAsset\.id, \{ status: editAsset\.status/.test(ar), 'AssetRegister: refused disposal journal ⇒ asset put back (RULE 1)');
const pd = strip(read('src/pages/ProfitDistribution.tsx'));
ok(/if \(v\?\.id\) \{ n\+\+; paidTotal \+= r\.dividend; \} else failed\.push/.test(pd) && /if \(n > 0\) toast/.test(pd), 'ProfitDistribution: dividend payments counted only when posted');
ok(/if \(bv\?\.id\) posted\+\+;/.test(pd) && /if \(posted > 0\) \{/.test(pd), 'ProfitDistribution: bonus counted only when posted');

// ── 3. Sweep: no page toasts success right after an unchecked addVoucher ──
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx$/.test(f)) files.push(p); } };
walk(path.join(ROOT, 'src/pages')); walk(path.join(ROOT, 'src/components'));
const offenders = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /(?:const|let)\s+(\w+)\s*=\s*addVoucher\(|addVoucher\(/g;
  let m;
  while ((m = re.exec(s))) {
    const after = s.slice(m.index, m.index + 2500);
    const name = m[1];
    const checked = name ? new RegExp(`${name}\\??\\.id|!${name}\\b`).test(after.slice(m[0].length + 5)) : false;
    const succ = /toast\(\{[\s\S]{0,200}?(सफल|posted|recorded|दर्ज|saved|सेव|पोस्ट हो|✅)/i.test(after);
    if (!checked && succ) offenders.push(`${path.relative(ROOT, f)}:${s.slice(0, m.index).split('\n').length}`);
  }
}
ok(offenders.length === 0, `no unchecked addVoucher followed by a success toast (${offenders.join(', ') || 'none'})`);

console.log(`no false success: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
