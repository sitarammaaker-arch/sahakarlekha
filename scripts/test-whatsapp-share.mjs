// WhatsApp share batch 1 — the pure message builders (src/lib/whatsappShare.ts) + static guards that the
// receipt / sale / member-account pages wire them the safe way.
// Run: node scripts/test-whatsapp-share.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const w = await import(pathToFileURL(resolve(ROOT, 'src/lib/whatsappShare.ts')).href);
const src = (p) => readFileSync(resolve(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── money ──
ok(w.rupees(123456.5) === '₹1,23,456.50', 'Indian grouping, 2 decimals');
ok(w.rupees(0) === '₹0.00', 'zero');
ok(w.rupees(undefined) === '₹0.00', 'undefined → ₹0.00');

// ── which vouchers may be shared ──
ok(w.canShareReceipt({ type: 'receipt' }), 'posted receipt');
ok(w.canShareReceipt({ type: 'receipt', approvalStatus: 'approved' }), 'approved receipt');
ok(!w.canShareReceipt({ type: 'payment' }), 'payment is not a receipt');
ok(!w.canShareReceipt({ type: 'receipt', isDeleted: true }), 'cancelled receipt');
ok(!w.canShareReceipt({ type: 'receipt', approvalStatus: 'pending' }), 'pending receipt (not in the books yet)');
ok(!w.canShareReceipt({ type: 'receipt', approvalStatus: 'rejected' }), 'rejected receipt');

// ── receipt ──
const r = w.receiptMessage({ partyName: 'रामलाल', societyName: 'किसान सेवा समिति', voucherNo: 'R-112', date: '24/10/2026', amount: 5000, head: 'शेयर पूंजी' });
ok(r.startsWith('नमस्ते रामलाल जी,'), 'receipt greets by name');
ok(r.includes('₹5,000.00') && r.includes('R-112') && r.includes('24/10/2026'), 'receipt has amount, number, date');
ok(r.includes('मद: शेयर पूंजी'), 'receipt names the head');
const rb = w.receiptMessage({ voucherNo: 'R-2', date: 'd', amount: 1, againstBills: ['S-45', ' ', 'S-46'] });
ok(rb.includes('बिल: S-45, S-46'), 'bill-wise receipt lists the bills (blank dropped)');
ok(!w.receiptMessage({ voucherNo: 'R-3', date: 'd', amount: 1, againstBills: [''] }).includes('बिल:'), 'no bill line when none');

// ── receipt head (multi-line receipts) ──
ok(w.receiptHead(['ऋण', 'ब्याज', 'ऋण']) === 'ऋण, ब्याज', 'distinct heads joined');
ok(w.receiptHead([undefined, ' ']) === undefined, 'no heads → undefined');
ok(w.receiptHead(['a', 'b', 'c', 'd']) === 'a, b, c आदि', 'more than 3 heads shortened');
ok(r.trimEnd().endsWith('— किसान सेवा समिति'), 'receipt signs off with the society');
const r2 = w.receiptMessage({ voucherNo: 'R-1', date: '01/04/2026', amount: 10 });
ok(r2.startsWith('नमस्ते,') && !r2.includes('मद:') && !r2.includes('—'), 'receipt without party/head/society stays clean');

// ── sale bill ──
const cash = w.saleBillMessage({ customerName: 'Sita', saleNo: 'S-9', date: '02/10/2026', grandTotal: 1180, paymentMode: 'cash', itemCount: 2 });
ok(cash.includes('बिल नं.: S-9') && cash.includes('₹1,180.00') && cash.includes('भुगतान: नकद') && cash.includes('सामान: 2 आइटम'), 'cash bill lines');
ok(!cash.includes('बकाया'), 'cash bill does not claim a due');
const credit = w.saleBillMessage({ saleNo: 'S-10', date: '02/10/2026', grandTotal: 500, paymentMode: 'credit' });
ok(credit.includes('भुगतान: उधार') && credit.includes('उधार बिल'), 'credit bill, balance unknown → generic reminder');
const unpaid = w.saleBillMessage({ saleNo: 'S-11', date: 'd', grandTotal: 500, paymentMode: 'credit', balance: 500 });
ok(unpaid.includes('अभी बाकी: ₹500.00') && !unpaid.includes('जमा हो चुका'), 'unpaid credit bill shows the full balance');
const part = w.saleBillMessage({ saleNo: 'S-12', date: 'd', grandTotal: 500, paymentMode: 'credit', balance: 200 });
ok(part.includes('जमा हो चुका: ₹300.00') && part.includes('अभी बाकी: ₹200.00'), 'part-paid credit bill shows paid + balance');
const paid = w.saleBillMessage({ saleNo: 'S-13', date: 'd', grandTotal: 500, paymentMode: 'credit', balance: 0 });
ok(paid.includes('पूरा भुगतान हो चुका') && !paid.includes('अभी बाकी'), 'settled credit bill does not ask for money');
ok(!cash.includes('अभी बाकी'), 'cash bill never shows a balance');

// ── member account ──
const m = w.memberAccountMessage({
  memberName: 'Gita', memberNo: 'M-7', societyName: 'X', asOf: '24/10/2026',
  figures: { shareBalance: 1000, depositTotal: 0, loanOutstanding: 25000, interestDue: 312.5, dividendDue: undefined },
});
ok(m.includes('सदस्य संख्या: M-7') && m.includes('24/10/2026 तक'), 'member header');
ok(m.includes('शेयर पूँजी: ₹1,000.00') && m.includes('ऋण बकाया: ₹25,000.00') && m.includes('ऋण पर प्राप्य ब्याज: ₹312.50'), 'non-zero figures shown, page labels');
const dairy = w.memberAccountMessage({ memberName: 'A', memberNo: '1', asOf: 'x', figures: { milkDue: 4200 } });
ok(dairy.includes('दूध भुगतान बाकी (आपको मिलना है): ₹4,200.00'), 'milk payment due included');
ok(!m.includes('कुल जमा') && !m.includes('लाभांश'), 'zero / absent figures left out');
ok(!m.includes('portal'), 'no portal line without a link');
ok(m.indexOf('शेयर पूँजी') < m.indexOf('ऋण बकाया'), 'fixed order');
// The message labels are the Member-360 card labels (so the member can match line for line).
const view = src('src/components/member-portal/MemberAccountView.tsx');
for (const label of ['शेयर पूँजी', 'ऋण बकाया', 'कुल जमा', 'KCC बकाया', 'ऋण पर प्राप्य ब्याज', 'दूध भुगतान बाकी', 'रखरखाव बकाया', 'दुकान उधार', 'लाभांश बाकी']) {
  ok(view.includes(`'${label}'`), `label "${label}" matches the page card`);
}
const empty = w.memberAccountMessage({ memberName: 'A', memberNo: '1', asOf: 'x', figures: {} });
ok(empty.includes('कोई बकाया या जमा नहीं'), 'empty account says so');
const withPortal = w.memberAccountMessage({ memberName: 'A', memberNo: '1', asOf: 'x', figures: {}, portalUrl: 'https://sahakarlekha.com/member/S1' });
ok(withPortal.includes('🔗 https://sahakarlekha.com/member/S1'), 'portal link when given');

// ── link ──
ok(w.whatsappLink('9876543210', 'hi').startsWith('https://wa.me/919876543210?text='), 'link pre-fills the number');
ok(w.whatsappLink('', 'hi').startsWith('https://wa.me/?text='), 'no phone → WhatsApp asks for the contact');

// ── static guards: the text rides in the URL, so nothing secret goes in it ──
const lib = src('src/lib/whatsappShare.ts');
ok(!/narration|pin\b|aadhaar|pan\b|accountNo|ifsc/i.test(lib.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'builders never take narration / PIN / Aadhaar / PAN / bank details');

const vouchers = src('src/pages/Vouchers.tsx');
ok(/canShareReceipt\(v\) && /.test(vouchers), 'Vouchers: share only for a counted receipt');
ok(/v\.refType === 'bill-receipt' && v\.refId/.test(vouchers), 'Vouchers: bill-wise customer receipt finds its customer');
ok(/c\.accountId && crIds\.has\(c\.accountId\)/.test(vouchers), 'Vouchers: manual receipt to a customer sub-ledger finds the customer');
ok(/handlePrintVoucher\(v\.id, 'file'\)/.test(vouchers), 'Vouchers: PDF built on demand for the share sheet');
const saleMgmt = src('src/pages/SaleManagement.tsx');
ok((saleMgmt.match(/<WhatsAppShareButton/g) || []).length === 2, 'SaleManagement: row + view dialog');
ok(/handleDownloadInvoice\(sale, 'file'\)/.test(saleMgmt), 'SaleManagement: PDF built on demand');
ok(/getBillReceivedMap\(vouchers\)/.test(saleMgmt), 'SaleManagement: balance from the Bills Outstanding map');
ok(/sale\.paymentMode === 'credit' && !sale\.memberId/.test(saleMgmt), 'SaleManagement: no bill balance for member store credit');
const m360 = src('src/pages/Member360.tsx');
ok(/memberAccountMessage\(/.test(m360) && /<WhatsAppShareButton/.test(m360), 'Member360 wired');
ok(/portalLogin\?\.is_active && /.test(m360), 'Member360: portal link only for an active login');
ok(/milkDue: verticals\.dairy\?\.passbook\.totalOutstanding/.test(m360), 'Member360: milk due wired');
ok(!/toISOString\(\)\.slice\(0, 10\)/.test(m360), 'Member360: local (IST) date, not UTC');

const btn = src('src/components/WhatsAppShareButton.tsx');
ok(/trackEvent\('whatsapp_share', \{ kind, mode \}\)/.test(btn), 'button: usage count carries only kind + mode');
ok(btn.indexOf('clipboard?.writeText') < btn.indexOf('await navigator.share') && !/await navigator\.clipboard/.test(btn), 'button: copy started, not awaited, before share()');

const pdf = src('src/lib/pdf.ts');
for (const fn of ['generateVoucherPDF', 'generateSaleInvoicePDF']) {
  ok(new RegExp(`export function ${fn}\\([^)]*opts: \\{ output\\?: 'save' \\| 'file' \\} = \\{\\}\\): File \\| void`).test(pdf), `${fn} can return a File`);
}

console.log(`whatsapp-share: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
