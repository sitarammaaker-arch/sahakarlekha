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
ok(r.trimEnd().endsWith('— किसान सेवा समिति'), 'receipt signs off with the society');
const r2 = w.receiptMessage({ voucherNo: 'R-1', date: '01/04/2026', amount: 10 });
ok(r2.startsWith('नमस्ते,') && !r2.includes('मद:') && !r2.includes('—'), 'receipt without party/head/society stays clean');

// ── sale bill ──
const cash = w.saleBillMessage({ customerName: 'Sita', saleNo: 'S-9', date: '02/10/2026', grandTotal: 1180, paymentMode: 'cash', itemCount: 2 });
ok(cash.includes('बिल नं.: S-9') && cash.includes('₹1,180.00') && cash.includes('भुगतान: नकद') && cash.includes('सामान: 2 आइटम'), 'cash bill lines');
ok(!cash.includes('बकाया'), 'cash bill does not claim a due');
const credit = w.saleBillMessage({ saleNo: 'S-10', date: '02/10/2026', grandTotal: 500, paymentMode: 'credit' });
ok(credit.includes('भुगतान: उधार') && credit.includes('बकाया'), 'credit bill asks for payment');

// ── member account ──
const m = w.memberAccountMessage({
  memberName: 'Gita', memberNo: 'M-7', societyName: 'X', asOf: '24/10/2026',
  figures: { shareBalance: 1000, depositTotal: 0, loanOutstanding: 25000, interestDue: 312.5, dividendDue: undefined },
});
ok(m.includes('सदस्य संख्या: M-7') && m.includes('24/10/2026 तक'), 'member header');
ok(m.includes('शेयर पूंजी: ₹1,000.00') && m.includes('ऋण बकाया: ₹25,000.00') && m.includes('ब्याज देय: ₹312.50'), 'non-zero figures shown');
ok(!m.includes('कुल जमा') && !m.includes('लाभांश'), 'zero / absent figures left out');
ok(!m.includes('portal'), 'no portal line without a link');
ok(m.indexOf('शेयर पूंजी') < m.indexOf('ऋण बकाया'), 'fixed order');
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
ok(/handlePrintVoucher\(v\.id, 'file'\)/.test(vouchers), 'Vouchers: PDF built on demand for the share sheet');
const saleMgmt = src('src/pages/SaleManagement.tsx');
ok((saleMgmt.match(/<WhatsAppShareButton/g) || []).length === 2, 'SaleManagement: row + view dialog');
ok(/handleDownloadInvoice\(sale, 'file'\)/.test(saleMgmt), 'SaleManagement: PDF built on demand');
const m360 = src('src/pages/Member360.tsx');
ok(/memberAccountMessage\(/.test(m360) && /<WhatsAppShareButton/.test(m360), 'Member360 wired');
ok(/portalLogin\?\.is_active && /.test(m360), 'Member360: portal link only for an active login');

const pdf = src('src/lib/pdf.ts');
for (const fn of ['generateVoucherPDF', 'generateSaleInvoicePDF']) {
  ok(new RegExp(`export function ${fn}\\([^)]*opts: \\{ output\\?: 'save' \\| 'file' \\} = \\{\\}\\): File \\| void`).test(pdf), `${fn} can return a File`);
}

console.log(`whatsapp-share: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
