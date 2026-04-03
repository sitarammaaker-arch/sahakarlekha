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
  '194J': '94J',
  '194Q': '94Q',
};

// Nature of payment codes (TRACES standard)
const NATURE_CODES: Record<string, string> = {
  '192': 'Salary',
  '194A': 'Interest other than Interest on securities',
  '194C': 'Payment to Contractors',
  '194H': 'Commission or Brokerage',
  '194J': 'Fees for Professional or Technical Services',
  '194Q': 'Payment for purchase of goods',
};

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

  // Quarterly entries only
  const qEntries = entries.filter(e => e.quarter === quarter && e.financialYear === financialYear);
  const qChallans = challans.filter(c => c.quarter === quarter && c.financialYear === financialYear);

  // Line 1: File Header
  lines.push([
    'FH',                                       // Record type
    tan,                                        // TAN
    'SahakarLekha v1.0',                       // Utility name
    '001',                                      // Batch count
    String(qEntries.length),                    // Total deductee records
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

  // Unlinked entries (no challan yet)
  const unlinked = qEntries.filter(e => !e.challanId);
  if (unlinked.length > 0) {
    lines.push([
      'CH',
      '0000000',   // No BSR (pending deposit)
      '00000000',  // No date
      '0',         // No serial
      fmtAmt(unlinked.reduce((s, e) => s + e.tdsAmount, 0)),
      fmtAmt(unlinked.reduce((s, e) => s + e.tdsAmount, 0)),
      String(unlinked.length),
    ].join('|'));

    unlinked.forEach(entry => {
      lines.push([
        'DD',
        entry.deducteePan,
        entry.deducteeName.substring(0, 75),
        SECTION_CODES[entry.section] || entry.section,
        fmtDate(entry.date),
        fmtAmt(entry.grossAmount),
        fmtAmt(entry.tdsRate),
        fmtAmt(entry.tdsAmount),
        NATURE_CODES[entry.section] || entry.natureOfPayment,
        '',
      ].join('|'));
    });
  }

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
