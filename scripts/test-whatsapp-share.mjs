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

// ══ Batch 2: reminders and notices (src/lib/whatsappReminders.ts) ══
const rm = await import(pathToFileURL(resolve(ROOT, 'src/lib/whatsappReminders.ts')).href);

// ── loan / KCC reminder ──
const lr = rm.loanReminderMessage({ memberName: 'रामलाल', societyName: 'S', loanNo: 'L-7', kind: 'loan', label: 'अल्पकालीन', outstanding: 20000, interestDue: 450, dueDate: '31/03/2027' });
ok(lr.includes('ऋण के भुगतान की याद') && lr.includes('ऋण नं.: L-7 (अल्पकालीन)'), 'loan reminder header + type');
ok(lr.includes('मूलधन बकाया: ₹20,000.00') && lr.includes('ब्याज देय: ₹450.00') && lr.includes('कुल देय: ₹20,450.00'), 'principal + interest + total');
ok(lr.includes('देय तिथि: 31/03/2027'), 'due date');
const lrNoInt = rm.loanReminderMessage({ loanNo: 'L-8', kind: 'loan', outstanding: 100 });
ok(!lrNoInt.includes('ब्याज देय') && !lrNoInt.includes('कुल देय'), 'no interest lines when none due');
const kcc = rm.loanReminderMessage({ loanNo: 'KCC-1', kind: 'kcc', label: 'गेहूँ, रबी', outstanding: 50000, overdue: true });
ok(kcc.includes('KCC ऋण की देय तिथि निकल चुकी है') && kcc.includes('(गेहूँ, रबी)'), 'overdue KCC wording + crop');

// ── customer bills reminder ──
const br = rm.billsReminderMessage({ partyName: 'सीता', asOf: '24/10/2026', bills: [{ no: 'S-1', date: '01/09/2026', balance: 500 }, { no: 'S-2', date: '01/10/2026', balance: 0 }, { no: 'S-3', date: '05/10/2026', balance: 250.5 }] });
ok(br.includes('• S-1 (01/09/2026): ₹500.00') && br.includes('• S-3 (05/10/2026): ₹250.50'), 'open bills listed');
ok(!br.includes('S-2'), 'settled bill left out');
ok(br.includes('कुल बकाया: ₹750.50'), 'total of open bills');
const many = rm.billsReminderMessage({ asOf: 'x', bills: Array.from({ length: 13 }, (_, i) => ({ no: `B${i}`, date: 'd', balance: 1 })) });
ok(many.includes('• और 3 बिल') && many.includes('कुल बकाया: ₹13.00'), 'more than 10 bills counted, total still full');

// ── milk slip ──
const ms = rm.milkSlipMessage({ memberName: 'गीता', date: '24/10/2026', shift: 'evening', qty: 8.25, fat: 6.5, snf: 8.7, rate: 52, amount: 429, quality: 'accepted' });
ok(ms.includes('(शाम)') && ms.includes('मात्रा: 8.3 लीटर') && ms.includes('फ़ैट: 6.5%') && ms.includes('SNF: 8.7%'), 'slip readings');
ok(ms.includes('दर: ₹52.00 प्रति लीटर') && ms.includes('राशि: ₹429.00'), 'slip rate + amount');
const rej = rm.milkSlipMessage({ date: 'd', shift: 'morning', qty: 5, rate: 50, amount: 250, quality: 'rejected' });
ok(rej.includes('अस्वीकृत') && !rej.includes('राशि:') && rej.includes('(सुबह)'), 'rejected milk: no amount promised');
ok(rm.milkSlipMessage({ date: 'd', shift: 'morning', qty: 5, rate: 50, amount: 240, quality: 'accepted_cut' }).includes('कटौती'), 'quality cut noted');

// ── milk settlement ──
const st = rm.milkSettlementMessage({ memberName: 'गीता', settlementNo: 'DS-3', from: '01/10/2026', to: '15/10/2026', gross: 6000, deductions: [{ type: 'Feed', amount: 800 }, { type: 'Loan', amount: 1000 }, { type: 'Other', amount: 0 }], netPayable: 4200, paid: 2000 });
ok(st.includes('दूध की कुल राशि: ₹6,000.00') && st.includes('घटाया — पशु आहार: ₹800.00') && st.includes('घटाया — ऋण किस्त: ₹1,000.00'), 'gross + Hindi deduction labels');
ok(!st.includes('अन्य'), 'zero deduction left out');
ok(st.includes('नेट देय: ₹4,200.00') && st.includes('भुगतान हो चुका: ₹2,000.00') && st.includes('अभी मिलना बाकी: ₹2,200.00'), 'net, paid, remaining');
ok(rm.milkSettlementMessage({ from: 'a', to: 'b', gross: 10, deductions: [], netPayable: 10, paid: 10 }).includes('पूरा भुगतान हो चुका'), 'fully paid settlement');

// ── meeting notice ──
const mn = rm.meetingNoticeMessage({ societyName: 'S', typeLabel: 'वार्षिक आम सभा (AGM)', meetingNo: 'AGM-2026-01', date: '15/11/2026', time: '11:00', venue: 'समिति भवन', agenda: '1. वार्षिक लेखा' });
ok(mn.startsWith('सूचना — वार्षिक आम सभा (AGM)') && mn.includes('तारीख: 15/11/2026') && mn.includes('समय: 11:00') && mn.includes('स्थान: समिति भवन'), 'notice basics');
ok(mn.includes('कार्यसूची:\n1. वार्षिक लेखा'), 'agenda included');
const longAgenda = rm.meetingNoticeMessage({ typeLabel: 'x', date: 'd', agenda: 'क'.repeat(rm.AGENDA_MAX + 50) });
ok(longAgenda.includes('पूरी कार्यसूची समिति कार्यालय में') && !longAgenda.includes('क'.repeat(rm.AGENDA_MAX + 1)), 'long agenda cut');
ok(!/नमस्ते/.test(mn), 'notice is addressed to all members, not one name');

// ── maintenance bill ──
ok(rm.periodHi('2026-07') === 'जुलाई 2026' && rm.periodHi('bad') === 'bad', 'period in Hindi');
const mb = rm.maintenanceBillMessage({ memberName: 'A', billNo: '2026-07/A-101', flatNo: 'A-101', period: '2026-07', amount: 2500, lines: [{ name: 'रखरखाव', amount: 2000 }, { name: 'पानी', amount: 500 }], paid: 1000 });
ok(mb.includes('रखरखाव बिल — जुलाई 2026') && mb.includes('फ्लैट: A-101') && mb.includes('• पानी: ₹500.00'), 'bill heading, flat, lines');
ok(mb.includes('बिल राशि: ₹2,500.00') && mb.includes('भुगतान हो चुका: ₹1,000.00') && mb.includes('अभी बाकी: ₹1,500.00'), 'amount, paid, due');
const mbOne = rm.maintenanceBillMessage({ billNo: 'B', period: '2026-08', amount: 900, lines: [{ name: 'रखरखाव', amount: 900 }], paid: 900 });
ok(!mbOne.includes('•') && mbOne.includes('पूरा भुगतान हो चुका'), 'single-head bill: no breakdown; paid bill says so');

// ── static guards ──
const lib2 = src('src/lib/whatsappReminders.ts');
ok(!/narration|remarks|pin\b|aadhaar|pan\b|accountNo|ifsc/i.test(lib2.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'reminder builders never take narration / remarks / PIN / Aadhaar / PAN / bank details');
const loanPage = src('src/pages/LoanRegister.tsx');
ok(/outstanding > 0\.005 && \(\(\) => \{\s*const share = loanShare\(l\)/.test(loanPage), 'Loan Register: button only while something is outstanding');
ok(/interestDue: dueOf\(l\.id\)\.receivable/.test(loanPage) && /overdue: statusOf\(l\) === 'overdue'/.test(loanPage), 'Loan Register: same interest-due + overdue rule as the row');
const kccPage = src('src/pages/KccLoan.tsx');
ok(/outstanding: kccOutstanding\(l\)/.test(kccPage) && /kind="kcc"/.test(kccPage), 'KCC: canonical outstanding');
const billsPage = src('src/pages/BillsOutstanding.tsx');
ok(/const showShare = tab === 'receivable'/.test(billsPage), 'Bills Outstanding: receivables only (no reminder to suppliers)');
ok(/asOf: fmtDate\(todayStr\(\)\)/.test(billsPage), "Bills Outstanding: reminder dated today (balances are today's)");
const milkPage = src('src/pages/MilkCollection.tsx');
ok(/kind="milk-slip"/.test(milkPage), 'Milk Collection: slip button');
ok(!/WhatsAppShareButton/.test(milkPage.slice(milkPage.indexOf('{/* Payout sheet */}'))), 'Milk Collection: no button on the gross payout sheet');
const settlePage = src('src/pages/dairy/FarmerSettlement.tsx');
ok(/\{!isDraft && <WhatsAppShareButton kind="milk-settlement"/.test(settlePage), 'Farmer Settlement: approved only');
const meetPage = src('src/pages/MeetingRegister.tsx');
ok(/m\.status === 'scheduled' && m\.date >= todayStr\(\)/.test(meetPage), 'Meeting Register: upcoming scheduled meetings only');
ok(/<WhatsAppShareButton kind="meeting" iconOnly hi=\{hi\} message=/.test(meetPage), 'Meeting Register: no fixed recipient (group picked in WhatsApp)');
const maintPage = src('src/pages/MaintenanceBilling.tsx');
ok((maintPage.match(/\{shareButton\(b\)\}/g) || []).length === 2 && /getPdf=\{\(\) => printBill\(b, 'file'\)\}/.test(maintPage), 'Maintenance: month list + outstanding list, with PDF');
ok(/export function generateMaintenanceBillPDF\([^)]*opts: \{ output\?: 'save' \| 'file' \} = \{\}\): File \| void/.test(pdf), 'generateMaintenanceBillPDF can return a File');

console.log(`whatsapp-share: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
