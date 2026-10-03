// TDS challan → ledger voucher (src/lib/tax/challanPosting.ts) and its wiring in TdsRegister.
// Deducting TDS credits TDS Payable; a challan deposit must DEBIT it. Before this a challan was only a register row.
//   Dr TDS Payable (TDS part) [+ Dr Penalty / Fine for interest and other charges] / Cr Bank (whole amount)
// The interest / charges are typed in by the user; nothing here knows a section, a rate or a deadline.
// Run: node scripts/test-tds-challan-posting.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const S = await import(pathToFileURL(path.join(SRC, 'lib/storage.ts')).href);
const C = await import(pathToFileURL(path.join(SRC, 'lib/tax/challanPosting.ts')).href);
const H = await import(pathToFileURL(path.join(SRC, 'lib/accounting/headResolve.ts')).href);
const M = await import(pathToFileURL(path.join(SRC, 'lib/money.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const shape = (r) => r.lines.map((l) => `${l.type} ${l.accountId} ${l.amount}`);
const base = { bankAccountId: '3302', tdsPayableId: '2202', penaltyId: '5605' };
const balanced = (lines) => lines.reduce((a, l) => a + (l.type === 'Dr' ? 1 : -1) * M.toMinor(l.amount), 0) === 0;

// ── the lines ─────────────────────────────────────────────────────────────────────────────────────────
let r = C.buildChallanPosting({ ...base, amount: 5000 });
ok(r.ok && JSON.stringify(shape(r)) === JSON.stringify(['Dr 2202 5000', 'Cr 3302 5000']), 'TDS only: Dr TDS Payable / Cr Bank for the whole amount');
ok(r.ok && r.tdsAmount === 5000 && r.chargesAmount === 0 && r.amount === 5000, 'TDS only: tds 5000, charges 0');

r = C.buildChallanPosting({ ...base, amount: 5120, interestAmount: 100, otherAmount: 20 });
ok(r.ok && JSON.stringify(shape(r)) === JSON.stringify(['Dr 2202 5000', 'Dr 5605 100', 'Dr 5605 20', 'Cr 3302 5120']), 'with interest and other charges: TDS part + one penalty line each + Cr bank for the total');
ok(r.ok && balanced(r.lines) && r.tdsAmount === 5000 && r.chargesAmount === 120, 'balances; tds 5000, charges 120');

r = C.buildChallanPosting({ ...base, amount: 5100, interestAmount: 100 });
ok(r.ok && r.lines.length === 3 && !r.lines.some((l) => l.narration === 'Other charges on TDS deposit'), 'interest only: no "other charges" line');

r = C.buildChallanPosting({ ...base, amount: 1234.56, interestAmount: 12.34 });
ok(r.ok && r.tdsAmount === 1222.22 && balanced(r.lines), 'paise amounts: 1234.56 − 12.34 = 1222.22, balanced to the paisa');

r = C.buildChallanPosting({ ...base, amount: 0.3, interestAmount: 0.1, otherAmount: 0.1 });
ok(r.ok && r.tdsAmount === 0.1 && balanced(r.lines), 'float-safe: 0.3 − 0.1 − 0.1 = 0.1 exactly');

ok(C.buildChallanPosting({ ...base, amount: 5000, penaltyId: null }).ok === true, 'no penalty head is fine when there are no charges');
ok(new Set(C.buildChallanPosting({ ...base, amount: 5120, interestAmount: 100, otherAmount: 20 }).lines.map((l) => l.id)).size === 4, 'every line gets its own id');
ok(C.buildChallanPosting({ ...base, amount: 5000 }, () => 'x').lines.every((l) => l.id === 'x'), 'the id generator is injectable');

// ── refusals ──────────────────────────────────────────────────────────────────────────────────────────
const err = (o) => { const x = C.buildChallanPosting({ ...base, ...o }); return x.ok === false ? x.error : 'OK'; };
ok(err({ amount: 0 }) === 'amount' && err({ amount: -5 }) === 'amount', 'a zero / negative challan is refused');
ok(err({ amount: 1000, interestAmount: -1 }) === 'negative' && err({ amount: 1000, otherAmount: -1 }) === 'negative', 'negative interest / charges are refused');
ok(err({ amount: 1000, bankAccountId: '' }) === 'no_bank' && err({ amount: 1000, bankAccountId: undefined }) === 'no_bank', 'no bank → refused');
ok(err({ amount: 1000, tdsPayableId: null }) === 'no_tds_head', 'no TDS Payable head → refused');
ok(err({ amount: 1000, interestAmount: 600, otherAmount: 400 }) === 'no_tds', 'interest + charges that leave no TDS part → refused');
ok(err({ amount: 1000, interestAmount: 600, otherAmount: 500 }) === 'no_tds', 'charges larger than the challan → refused');
ok(err({ amount: 1000, interestAmount: 50, penaltyId: null }) === 'no_penalty_head', 'interest without a penalty head → refused (never booked to a guess)');
ok(Object.keys(C.CHALLAN_POSTING_MESSAGE).sort().join() === 'amount,negative,no_bank,no_tds', 'a Hindi message exists for every refusal the user can fix in the form');
ok(typeof H.MISSING_HEAD_TOAST.tds.title === 'string' && typeof H.MISSING_HEAD_TOAST.penalty.title === 'string', 'the two missing-head toasts exist');

// ── head resolvers against the real charts (as the app loads them: template + migrateAccounts) ────────
const chart = (t) => S.migrateAccounts(S.SOCIETY_TEMPLATES[t].map((a) => ({ ...a }))).accounts;
for (const t of Object.keys(S.SOCIETY_TEMPLATES)) {
  ok(H.tdsPayableAccountId(chart(t)) === '2202', `${t}: TDS Payable resolves to 2202`);
  ok(H.penaltyAccountId(chart(t)) === '5605', `${t}: Penalty / Fine resolves to 5605`);
}
ok(H.tdsPayableAccountId([{ id: '3307', name: 'TDS / TCS Receivable', nameHi: '', type: 'asset', isGroup: false }]) === null, 'the TDS/TCS *receivable* asset is never the payable');
ok(H.tdsPayableAccountId([{ id: '2202', name: 'TDS Payable', nameHi: '', type: 'liability', isGroup: true }]) === null, 'a group head is not postable');
ok(H.tdsPayableAccountId([{ id: '2202', name: 'Sundry', nameHi: '', type: 'liability', isGroup: false }, { id: 'u1', name: 'TDS Payable', nameHi: 'देय TDS', type: 'liability', isGroup: false }]) === 'u1', 'if 2202 is something else, a TDS Payable liability by any id is used');
ok(H.tdsPayableAccountId([{ id: '2205', name: 'TCS Payable', nameHi: '', type: 'liability', isGroup: false }]) === null, 'TCS Payable is not TDS Payable');
ok(H.tdsPayableAccountId([]) === null && H.penaltyAccountId([]) === null, 'empty chart → null');
ok(H.penaltyAccountId([{ id: '5605', name: 'Penalty / Fine', nameHi: '', type: 'income', isGroup: false }]) === null, 'a penalty INCOME head is not the expense');
ok(H.penaltyAccountId([{ id: 'u9', name: 'Late Fee', nameHi: 'विलंब शुल्क', type: 'expense', isGroup: false }]) === 'u9', 'a "Late Fee" expense counts');

// ── wiring in TdsRegister ─────────────────────────────────────────────────────────────────────────────
const tr = readFileSync(path.join(SRC, 'pages/TdsRegister.tsx'), 'utf8');
const add = tr.slice(tr.indexOf('const handleAddChallan'), tr.indexOf('const handleDeleteEntry') > 0 ? tr.indexOf('// Delete a manual entry') : undefined);
ok(/buildChallanPosting\(/.test(add) && /addVoucher\(/.test(add), 'handleAddChallan builds the posting and creates the voucher');
ok(add.indexOf('addVoucher(') > 0 && add.indexOf('addVoucher(') < add.indexOf('persistChallans([...challans, challan])'), 'the voucher is created BEFORE the challan row is saved (a lock refuses the whole thing)');
ok(/if \(!v\?\.id\) return;/.test(add), 'a blocked voucher (lock / unbalanced) stops the challan too');
ok(/refType: CHALLAN_REF_TYPE, refId: challanId/.test(add), 'the voucher is linked to the challan by refType / refId');
ok(/if \(voucherId\) cancelVoucher\(voucherId/.test(add), 'a failed cloud save of the challan cancels its voucher (RULE 1)');
ok(/challanForm\.status === 'paid' && postChallanVoucher/.test(add), 'only a PAID challan with the box ticked posts');
const del = tr.slice(tr.indexOf('const handleDeleteChallan'), tr.indexOf('// 26Q Export'));
ok(/x\.refType === CHALLAN_REF_TYPE && x\.refId === id/.test(del) && /cancelVoucher\(v\.id/.test(del), 'deleting a challan cancels its voucher (RULE 3)');
ok(del.indexOf('cancelVoucher(') < del.indexOf('persistChallans(challans.filter'), 'the voucher is cancelled before the challan is removed; a refusal stops the delete');
ok(!/from\('vouchers'\)/.test(tr), 'TdsRegister never writes a voucher row itself');
ok(/status: 'paid',/.test(tr.slice(tr.indexOf('const EMPTY_CHALLAN'), tr.indexOf('const TdsRegister'))), 'a new challan defaults to "paid" (a challan number exists only after the deposit)');

console.log(`tds challan posting: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;   // not process.exit(): it races the register() loader worker on Windows (#670)
