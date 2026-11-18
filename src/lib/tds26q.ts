/**
 * TDS Form 26Q — Text file generator for TRACES portal
 * Generates pipe-delimited text file for quarterly TDS return filing
 */
import type { TdsEntry, TdsChallan, SocietySettings } from '@/types';

// Date formatter: yyyy-mm-dd → ddmmyyyy
const fmtDate = (d: string): string => {
  const [y, m, dd] = d.split('-');
  return `${dd}${m}${y}`;
};

// Amount formatter: 2 decimal places
const fmtAmt = (n: number): string => n.toFixed(2);

// TDS section code mapping
const SECTION_CODES: Record<string, string> = {
  '192': '192',
  '194A': '94A',
  '194C': '94C',
  '194H': '94H',
  '194I': '4IB',
  '194J': '94J',
  '194Q': '94Q',
  '195': '195',
};

// Nature of payment codes (TRACES standard)
const NATURE_CODES: Record<string, string> = {
  '192': 'Salary',
  '194A': 'Interest other than Interest on securities',
  '194C': 'Payment to Contractors',
  '194H': 'Commission or Brokerage',
  '194I': 'Rent of land, building or furniture',
  '194J': 'Fees for Professional or Technical Services',
  '194Q': 'Payment for purchase of goods',
  '195': 'Other sums payable to a non-resident',
};

/**
 * What belongs in the 26Q file. Salary TDS (section 192) is filed in Form 24Q, never 26Q — the TDS Register
 * lists it (it shares challans and the register view), but the 26Q export must leave it out. A challan goes
 * into 26Q unless EVERY entry linked to it is salary TDS (a challan deposited only for salary belongs to 24Q).
 * An unlinked challan stays — the register cannot tell which return it is for. PURE.
 */
export const SALARY_TDS_SECTION = '192';
export function entriesFor26Q(entries: TdsEntry[], challans: TdsChallan[]): { entries: TdsEntry[]; challans: TdsChallan[] } {
  const nonSalary = entries.filter((e) => e.section !== SALARY_TDS_SECTION);
  const linkedSections = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!e.challanId) continue;
    const set = linkedSections.get(e.challanId) ?? new Set<string>();
    set.add(e.section);
    linkedSections.set(e.challanId, set);
  }
  const salaryOnly = (c: TdsChallan) => {
    const secs = linkedSections.get(c.id);
    return !!secs && secs.size > 0 && [...secs].every((x) => x === SALARY_TDS_SECTION);
  };
  return { entries: nonSalary, challans: challans.filter((c) => !salaryOnly(c)) };
}

/** The entries and challans of one quarter's 26Q (PURE). Challans: dated in the quarter, or linked to one of its entries. */
export function quarterFor26Q(entries: TdsEntry[], challans: TdsChallan[], quarter: string, financialYear: string): { qEntries: TdsEntry[]; qChallans: TdsChallan[]; unlinked: TdsEntry[] } {
  const byId = new Map(challans.map((c) => [c.id, c]));
  const qEntries = entries.filter((e) => e.quarter === quarter && e.financialYear === financialYear)
    .map((e) => (e.challanId && !byId.has(e.challanId) ? { ...e, challanId: undefined } : e));
  const linked = new Set(qEntries.map((e) => e.challanId).filter(Boolean) as string[]);
  const qChallans = challans.filter((c) => (c.quarter === quarter && c.financialYear === financialYear) || linked.has(c.id));
  return { qEntries, qChallans, unlinked: qEntries.filter((e) => !e.challanId) };
}

/** Quarter-level refusals for the 26Q export (PURE): every deductee must sit under a real, deposited challan. */
export function validate26QQuarter(entries: TdsEntry[], challans: TdsChallan[], quarter: string, financialYear: string): string[] {
  const { unlinked } = quarterFor26Q(entries, challans, quarter, financialYear);
  if (unlinked.length === 0) return [];
  const total = unlinked.reduce((s, e) => s + (e.tdsAmount || 0), 0);
  const names = unlinked.slice(0, 3).map((e) => e.deducteeName).join(', ') + (unlinked.length > 3 ? '…' : '');
  return [`${unlinked.length} TDS ${unlinked.length === 1 ? 'entry has' : 'entries have'} no deposited challan (TDS ${fmtAmt(total)}): ${names} — deposit the TDS and link the challan before filing 26Q.`];
}

export interface Generate26QOptions {
  entries: TdsEntry[];
  challans: TdsChallan[];
  society: SocietySettings;
  quarter: string;       // Q1, Q2, Q3, Q4
  financialYear: string; // 2024-25
}

export function generate26QText(opts: Generate26QOptions): string {
  const { entries, challans, society, quarter, financialYear } = opts;
  const tan = society.tan || 'XXXXXXXXXX';
  const pan = society.entityPan || 'XXXXXXXXXX';
  const lines: string[] = [];

  // RPT-03 (audit 2026-11-17): the quarter's challans are those dated in it PLUS any challan a quarter entry is
  // linked to — TDS deducted in March is routinely deposited in April. Before, such a deductee was counted in the
  // file header but dropped from the detail (header 3, detail 2). An entry whose challan is not found is unlinked.
  const { qEntries, qChallans } = quarterFor26Q(entries, challans, quarter, financialYear);

  // Line 1: File Header
  lines.push([
    'FH',                                       // Record type
    tan,                                        // TAN
    'SahakarLekha v1.0',                       // Utility name
    '001',                                      // Batch count
    String(qEntries.filter(e => e.challanId).length), // Total deductee records (= the DD lines written)
    financialYear.replace('-', ''),             // FY (202425)
    quarter.replace('Q', ''),                   // Quarter (1/2/3/4)
  ].join('|'));

  // Line 2: Batch Header
  lines.push([
    'BH',                                       // Record type
    tan,                                        // TAN
    pan,                                        // PAN of deductor
    society.name.substring(0, 75),             // Entity name (max 75)
    society.address.substring(0, 75),          // Address
    society.state.toUpperCase(),               // State code
    society.pinCode,                           // PIN
    society.phone,                             // Phone
    society.email,                             // Email
    '26Q',                                     // Form type
    financialYear,                             // FY
    quarter.replace('Q', ''),                  // Quarter
  ].join('|'));

  // Challan records
  qChallans.forEach(ch => {
    // Find entries linked to this challan
    const linkedEntries = qEntries.filter(e => e.challanId === ch.id);
    const totalTds = linkedEntries.reduce((s, e) => s + e.tdsAmount, 0);

    lines.push([
      'CH',                                     // Record type
      ch.bsrCode.padStart(7, '0'),             // BSR code (7 digits)
      fmtDate(ch.challanDate),                 // Challan date
      ch.challanSerial,                        // Serial number
      fmtAmt(ch.amount),                       // Amount deposited
      fmtAmt(totalTds),                        // Total TDS
      String(linkedEntries.length),            // No. of deductees
    ].join('|'));

    // Deductee records under this challan
    linkedEntries.forEach(entry => {
      lines.push([
        'DD',                                   // Record type
        entry.deducteePan,                     // Deductee PAN
        entry.deducteeName.substring(0, 75),   // Name
        SECTION_CODES[entry.section] || entry.section, // Section code
        fmtDate(entry.date),                   // Payment date
        fmtAmt(entry.grossAmount),             // Amount paid/credited
        fmtAmt(entry.tdsRate),                 // TDS rate
        fmtAmt(entry.tdsAmount),               // TDS amount
        NATURE_CODES[entry.section] || entry.natureOfPayment, // Nature
        '',                                    // Exemption reason (blank if none)
      ].join('|'));
    });
  });

  // RPT-03: an entry with no deposited challan is NEVER written under an invented challan (BSR 0000000) — the FVU
  // rejects it or, worse, the return goes in with wrong data. validate26QQuarter() refuses the export while any such
  // entry remains; this builder simply never writes one.

  return lines.join('\n');
}

// Download helper
export function download26Q(text: string, society: SocietySettings, quarter: string, fy: string) {
  const tan = society.tan || 'XXXXXXXXXX';
  const filename = `26Q_${tan}_${quarter}_${fy.replace('-', '')}.txt`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Validation before export
export function validate26QData(
  entries: TdsEntry[],
  challans: TdsChallan[],
  society: SocietySettings,
): string[] {
  const errors: string[] = [];

  if (!society.tan || society.tan.length !== 10) errors.push('Society TAN is missing or invalid (must be 10 characters)');
  if (!society.entityPan || society.entityPan.length !== 10) errors.push('Society PAN is missing or invalid (must be 10 characters)');

  entries.forEach((e, i) => {
    if (!e.deducteePan || e.deducteePan.length !== 10)
      errors.push(`Entry #${i + 1} (${e.deducteeName}): Invalid PAN "${e.deducteePan}"`);
    if (e.tdsAmount <= 0)
      errors.push(`Entry #${i + 1} (${e.deducteeName}): TDS amount must be > 0`);
    if (e.grossAmount < e.tdsAmount)
      errors.push(`Entry #${i + 1} (${e.deducteeName}): Gross amount < TDS amount`);
  });

  challans.forEach((c, i) => {
    if (c.bsrCode.length !== 7)
      errors.push(`Challan #${i + 1}: BSR code must be 7 digits`);
  });

  return errors;
}

// Quarter helper
export function getQuarterFromDate(date: string): TdsEntry['quarter'] {
  const month = parseInt(date.split('-')[1]);
  if (month >= 4 && month <= 6) return 'Q1';
  if (month >= 7 && month <= 9) return 'Q2';
  if (month >= 10 && month <= 12) return 'Q3';
  return 'Q4'; // Jan-Mar
}

// Due date for quarter
export function getQuarterDueDate(quarter: string, fy: string): string {
  const startYear = parseInt(fy.split('-')[0]);
  switch (quarter) {
    case 'Q1': return `${startYear}-07-31`;
    case 'Q2': return `${startYear}-10-31`;
    case 'Q3': return `${startYear + 1}-01-31`;
    case 'Q4': return `${startYear + 1}-05-31`;
    default: return '';
  }
}
