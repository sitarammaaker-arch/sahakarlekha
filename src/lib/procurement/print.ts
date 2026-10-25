/**
 * Marketing D2b — printable procurement documents: the J-Form (purchase slip) and the farmer payment
 * slip. Rendered as a browser-print HTML window (like the dairy milk slip) so Devanagari prints
 * correctly — the app's jsPDF reports are English-only.
 *
 * This is the SOCIETY'S OWN slip. A state's prescribed J-Form (where one exists) is issued on that
 * state's procurement portal; nothing here claims to be that statutory form. PURE builders + one
 * window helper. Tested by scripts/test-procurement-agent-flow.mjs.
 */
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const money = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const t = (hi: boolean, h: string, e: string) => (hi ? h : e);

export interface SlipParty { name: string; code?: string; fatherName?: string; village?: string; mobile?: string; bankName?: string; bankAccountMasked?: string; ifsc?: string; portalId?: string }

export interface JFormSlipData {
  hi: boolean;
  societyName: string;
  documentNo: string;          // J-Form number (DB-issued)
  date: string;                // business date (lot date / J-Form day)
  farmer: SlipParty;
  crop: string;
  variety?: string;
  season?: string;
  centre?: string;
  agency?: string;
  arhtiya?: string;
  grossWeight?: number;
  tareWeight?: number;
  bags?: number;
  quantity: number;            // net, quintals
  rate: number;                // ₹ / quintal
  value: number;               // procurement value (rupees)
  moisture?: number;
  quality?: string;
}

export interface PaymentSlipData {
  hi: boolean;
  societyName: string;
  farmer: SlipParty;
  settlementNo?: string;
  jformNo?: string;
  gross: number;
  deductions: { label: string; amount: number }[];
  netPayable: number;
  payments: { date: string; voucherNo: string; amount: number; mode?: string; reference?: string }[];
  outstanding: number;
}

const STYLE = `
  @page { size: A5; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, 'Segoe UI', 'Noto Sans Devanagari', Arial, sans-serif; color: #111; font-size: 12px; margin: 0; }
  .society { text-align: center; font-weight: 700; font-size: 16px; }
  .title { text-align: center; font-size: 13px; margin: 4px 0 8px; border-bottom: 1px solid #333; padding-bottom: 6px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 6px; vertical-align: top; }
  .kv td.l { color: #555; width: 38%; }
  .grid { border: 1px solid #999; }
  .grid th, .grid td { border: 1px solid #999; }
  .grid th { background: #f2f2f2; text-align: left; }
  .r { text-align: right; }
  .tot td { font-weight: 700; }
  .sign { display: flex; justify-content: space-between; margin-top: 36px; font-size: 11px; }
  .note { font-size: 10px; color: #666; margin-top: 10px; }`;

const partyRows = (hi: boolean, f: SlipParty) => [
  [t(hi, 'किसान', 'Farmer'), `${esc(f.name)}${f.code ? ` (${esc(f.code)})` : ''}`],
  f.fatherName ? [t(hi, 'पिता का नाम', 'Father'), esc(f.fatherName)] : null,
  f.village ? [t(hi, 'गाँव', 'Village'), esc(f.village)] : null,
  f.mobile ? [t(hi, 'मोबाइल', 'Mobile'), esc(f.mobile)] : null,
  f.portalId ? [t(hi, 'पोर्टल ID', 'Portal ID'), esc(f.portalId)] : null,
  (f.bankName || f.bankAccountMasked) ? [t(hi, 'बैंक', 'Bank'), `${esc(f.bankName || '')} ${esc(f.bankAccountMasked || '')}${f.ifsc ? ` · IFSC ${esc(f.ifsc)}` : ''}`] : null,
].filter((r): r is string[] => !!r).map(([l, v]) => `<tr><td class="l">${l}</td><td>${v}</td></tr>`).join('');

/** PURE — the J-Form / purchase slip HTML. */
export function jformSlipHTML(d: JFormSlipData): string {
  const hi = d.hi;
  const row = (l: string, v: string) => `<tr><td class="l">${l}</td><td>${v}</td></tr>`;
  const produce = [
    row(t(hi, 'फसल', 'Crop'), `${esc(d.crop)}${d.variety ? ` (${esc(d.variety)})` : ''}`),
    d.season ? row(t(hi, 'सीज़न', 'Season'), esc(d.season)) : '',
    d.centre ? row(t(hi, 'खरीद केंद्र', 'Centre'), esc(d.centre)) : '',
    d.agency ? row(t(hi, 'एजेंसी', 'Agency'), esc(d.agency)) : '',
    d.arhtiya ? row(t(hi, 'आढ़ती', 'Arhtiya'), esc(d.arhtiya)) : '',
    d.quality ? row(t(hi, 'क्वालिटी', 'Quality'), `${esc(d.quality)}${d.moisture != null ? ` · ${t(hi, 'नमी', 'moisture')} ${esc(d.moisture)}%` : ''}`) : '',
  ].join('');
  const weigh = (d.grossWeight || d.tareWeight || d.bags)
    ? `<tr><th>${t(hi, 'कुल वज़न', 'Gross')}</th><th>${t(hi, 'खाली बोरी', 'Tare')}</th><th>${t(hi, 'शुद्ध (क्विंटल)', 'Net (qtl)')}</th><th>${t(hi, 'बोरी', 'Bags')}</th></tr>
       <tr><td class="r">${d.grossWeight ?? '—'}</td><td class="r">${d.tareWeight ?? '—'}</td><td class="r">${d.quantity}</td><td class="r">${d.bags ?? '—'}</td></tr>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${t(hi, 'J-Form / खरीद पर्ची', 'J-Form / Purchase Slip')} ${esc(d.documentNo)}</title><style>${STYLE}</style></head><body>
  <div class="society">${esc(d.societyName)}</div>
  <div class="title">${t(hi, 'J-Form / खरीद पर्ची (MSP)', 'J-Form / Purchase Slip (MSP)')}</div>
  <div class="meta"><span>${t(hi, 'क्रमांक', 'No.')} <b>${esc(d.documentNo || '—')}</b></span><span>${t(hi, 'तारीख', 'Date')} <b>${esc(d.date)}</b></span></div>
  <table class="kv">${partyRows(hi, d.farmer)}${produce}</table>
  ${weigh ? `<table class="grid" style="margin-top:8px">${weigh}</table>` : ''}
  <table class="grid" style="margin-top:8px">
    <tr><th>${t(hi, 'मात्रा (क्विंटल)', 'Quantity (qtl)')}</th><th>${t(hi, 'MSP दर (₹/क्विंटल)', 'MSP rate (₹/qtl)')}</th><th class="r">${t(hi, 'राशि', 'Amount')}</th></tr>
    <tr class="tot"><td>${d.quantity}</td><td>${money(d.rate)}</td><td class="r">${money(d.value)}</td></tr>
  </table>
  <div class="sign"><span>${t(hi, 'किसान के हस्ताक्षर', 'Farmer signature')}</span><span>${t(hi, 'खरीद अधिकारी', 'Purchase officer')}</span><span>${t(hi, 'सचिव / प्रबंधक', 'Secretary / Manager')}</span></div>
  <div class="note">${t(hi, 'यह समिति की खरीद पर्ची है। राज्य पोर्टल का निर्धारित J-Form (जहाँ लागू हो) पोर्टल से जारी होता है।', "The society's purchase slip. A state's prescribed J-Form, where one applies, is issued on the state portal.")}</div>
  <script>window.onload=function(){window.focus();window.print();};<\/script>
</body></html>`;
}

/** PURE — the farmer payment slip HTML (settlement + every payment against it). */
export function paymentSlipHTML(d: PaymentSlipData): string {
  const hi = d.hi;
  const ded = d.deductions.map(x => `<tr><td>${esc(x.label)}</td><td class="r">${money(x.amount)}</td></tr>`).join('');
  const pays = d.payments.map(p => `<tr><td>${esc(p.date)}</td><td>${esc(p.voucherNo)}</td><td>${esc(p.mode || '')}${p.reference ? ` · ${esc(p.reference)}` : ''}</td><td class="r">${money(p.amount)}</td></tr>`).join('');
  const paid = d.payments.reduce((t2, p) => t2 + p.amount, 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${t(hi, 'भुगतान पर्ची', 'Payment Slip')} ${esc(d.settlementNo || '')}</title><style>${STYLE}</style></head><body>
  <div class="society">${esc(d.societyName)}</div>
  <div class="title">${t(hi, 'किसान भुगतान पर्ची (MSP)', 'Farmer Payment Slip (MSP)')}</div>
  <div class="meta"><span>${t(hi, 'निपटान', 'Settlement')} <b>${esc(d.settlementNo || '—')}</b></span><span>J-Form <b>${esc(d.jformNo || '—')}</b></span></div>
  <table class="kv">${partyRows(hi, d.farmer)}</table>
  <table class="grid" style="margin-top:8px">
    <tr><th>${t(hi, 'विवरण', 'Particulars')}</th><th class="r">${t(hi, 'राशि', 'Amount')}</th></tr>
    <tr><td>${t(hi, 'सकल (MSP मूल्य)', 'Gross (MSP value)')}</td><td class="r">${money(d.gross)}</td></tr>
    ${ded}
    <tr class="tot"><td>${t(hi, 'निवल देय', 'Net payable')}</td><td class="r">${money(d.netPayable)}</td></tr>
  </table>
  <table class="grid" style="margin-top:8px">
    <tr><th>${t(hi, 'तारीख', 'Date')}</th><th>${t(hi, 'वाउचर', 'Voucher')}</th><th>${t(hi, 'माध्यम / संदर्भ', 'Mode / Ref')}</th><th class="r">${t(hi, 'भुगतान', 'Paid')}</th></tr>
    ${pays || `<tr><td colspan="4">${t(hi, 'अभी कोई भुगतान नहीं', 'No payment yet')}</td></tr>`}
    <tr class="tot"><td colspan="3">${t(hi, 'कुल भुगतान', 'Total paid')}</td><td class="r">${money(paid)}</td></tr>
    <tr class="tot"><td colspan="3">${t(hi, 'बकाया', 'Outstanding')}</td><td class="r">${money(d.outstanding)}</td></tr>
  </table>
  <div class="sign"><span>${t(hi, 'प्राप्तकर्ता किसान', 'Received by (farmer)')}</span><span>${t(hi, 'कैशियर / लेखाकार', 'Cashier / Accountant')}</span><span>${t(hi, 'सचिव / प्रबंधक', 'Secretary / Manager')}</span></div>
  <script>window.onload=function(){window.focus();window.print();};<\/script>
</body></html>`;
}

/** Open a print window. Returns false if a popup blocker prevented it. */
export function openPrint(html: string): boolean {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
