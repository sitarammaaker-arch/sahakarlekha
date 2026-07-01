/**
 * Milk slip (दूध पर्ची) — a small printable token given to the farmer after each collection.
 * Rendered as a browser-print HTML window (NOT jsPDF) so Devanagari prints correctly — the
 * app's jsPDF reports are English-only because helvetica lacks Hindi glyphs.
 */
import type { MilkEntry } from '@/types';

const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const money = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface MilkSlipOpts { societyName: string; hi: boolean; memberCode?: string }

/** Pure — build the printable slip HTML for one collection entry. */
export function milkSlipHTML(entry: MilkEntry, opts: MilkSlipOpts): string {
  const hi = opts.hi;
  const shift = entry.shift === 'morning' ? (hi ? 'सुबह' : 'Morning') : (hi ? 'शाम' : 'Evening');
  const t = (h: string, e: string) => (hi ? h : e);
  const rejected = entry.qualityDecision === 'rejected';
  const cut = entry.qualityDecision === 'accepted_cut';
  const row = (label: string, value: string) => `<tr><td class="l">${label}</td><td class="v">${value}</td></tr>`;
  const qualityRow = rejected
    ? row(t('गुणवत्ता', 'Quality'), `<b style="color:#b00">${t('अस्वीकृत', 'REJECTED')}</b>`)
    : cut ? row(t('गुणवत्ता', 'Quality'), t('कटौती सहित', 'With cut')) : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${t('दूध पर्ची', 'Milk Slip')}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, 'Segoe UI', 'Noto Sans Devanagari', Arial, sans-serif; width: 72mm; margin: 0 auto; color: #111; }
  .society { text-align: center; font-weight: 700; font-size: 14px; }
  .title { text-align: center; font-size: 12px; margin: 2px 0 6px; letter-spacing: .5px; border-bottom: 1px dashed #999; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 2px 0; vertical-align: top; }
  td.l { color: #555; }
  td.v { text-align: right; font-weight: 600; }
  .amt { border-top: 1px dashed #999; margin-top: 6px; padding-top: 6px; font-size: 15px; display: flex; justify-content: space-between; font-weight: 700; }
  .foot { text-align: center; font-size: 10px; color: #777; margin-top: 8px; border-top: 1px dashed #999; padding-top: 6px; }
</style></head><body>
  <div class="society">${esc(opts.societyName || 'Dairy Cooperative')}</div>
  <div class="title">${t('दूध संकलन पर्ची', 'Milk Collection Slip')}</div>
  <table>
    ${row(t('तारीख', 'Date'), `${esc(entry.date)} · ${shift}`)}
    ${row(t('सदस्य', 'Member'), esc(entry.memberName) + (opts.memberCode ? ` (${esc(opts.memberCode)})` : ''))}
    ${row(t('लीटर', 'Litres'), entry.qty.toFixed(1))}
    ${row('Fat %', entry.fat ? String(entry.fat) : '—')}
    ${row('SNF %', entry.snf ? String(entry.snf) : '—')}
    ${row(t('दर ₹/लीटर', 'Rate ₹/L'), rejected ? '—' : entry.rate.toFixed(2))}
    ${qualityRow}
  </table>
  <div class="amt"><span>${t('राशि', 'Amount')}</span><span>${rejected ? '—' : money(entry.amount)}</span></div>
  <div class="foot">${t('धन्यवाद', 'Thank you')} · ${new Date().toLocaleDateString('en-IN')}</div>
  <script>window.onload=function(){window.focus();window.print();};window.onafterprint=function(){window.close();};<\/script>
</body></html>`;
}

/** Open a print window for the slip. No-op (returns false) if a popup blocker prevents it. */
export function printMilkSlip(entry: MilkEntry, opts: MilkSlipOpts): boolean {
  const w = window.open('', '_blank', 'width=380,height=600');
  if (!w) return false;
  w.document.write(milkSlipHTML(entry, opts));
  w.document.close();
  return true;
}
