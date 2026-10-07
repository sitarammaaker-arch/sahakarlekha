/**
 * Universal Importer — the four download templates, the CSV parser and the row validators. PURE (no React, no data context).
 *
 * Why this is a module: the templates are what a society's clerk fills in, and a wrong example row does real harm. Audit of
 * 2026-10-07 found the example rows were stale and one of them dangerous:
 *   - opening balances: "Share Capital" is a GROUP in every chart (1100). The Opening Balances page refuses an opening on a group
 *     (reports ignore it — a real ₹58 lakh went missing that way, PR #350) but the importer accepted it. Now it refuses too;
 *   - "Bank - SBI" / "Reserve Fund" exist in no chart (the real names are "Bank Account (Main)" / "Statutory Reserve Fund");
 *   - accounts: "Admission Fee Income" and "Salary Expense" would have created DUPLICATES of "Admission Fee" and "Salary";
 *   - vouchers: the example dates were 2025-04-15 — the importer only accepts the CURRENT financial year, so every example failed.
 * Every example row now starts with "(उदाहरण)": a row left in by mistake is refused with a plain message instead of being imported.
 * Example account names are the real, postable ones that exist in every society chart (Cash in Hand, Bank Account (Main), Individual Share
 * Capital, Statutory Reserve Fund, Admission Fee, Salary).
 */
import type { LedgerAccount } from '@/types';

export interface RowError {
  row: number;
  field: string;
  message: string;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

export function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .filter(l => l.trim() !== '')
    .map(line => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    });
}

// ─── Templates ────────────────────────────────────────────────────────────────

const EXAMPLE = "(उदाहरण) ";

export const ACCOUNTS_TEMPLATE = [
  'account_name,account_type,opening_balance,balance_type,parent_group',
  '(यहाँ Account का नाम लिखें),(Asset/Liability/Equity/Income/Expense),(शुरुआती राशि रुपये में),(Debit/Credit),(किस समूह के नीचे — समूह का नाम या कोड; खाली छोड़ें तो प्रकार का सामान्य समूह लगेगा)',
  EXAMPLE + 'Bank - SBI,Asset,120000,Debit,Current Assets',
  EXAMPLE + 'Loan from Bank,Liability,200000,Credit,Current Liabilities',
  EXAMPLE + 'Anniversary Fund,Equity,80000,Credit,Reserves & Surplus',
  EXAMPLE + 'Interest Received,Income,0,Credit,4400',
  EXAMPLE + 'Office Expense,Expense,0,Debit,Admin Expenses',
].join('\n');

export const MEMBERS_TEMPLATE = [
  "member_id,name,father_name,age,occupation,caste,address,post_office,tehsil,district,state,pin_code,phone,share_capital,admission_fee,payment_mode,member_type,join_date,status,share_count,share_face_value,nominee_name,nominee_father_name,nominee_relation,nominee_age,nominee_occupation,nominee_address,nominee_shares,nominee_phone",
  "(सदस्य क्रमांक),(पूरा नाम),(पिता/पति का नाम),(आयु),(व्यवसाय),(General/Backward Class/Schedule Caste/Schedule Tribe),(पता),(डाकघर),(तहसील),(जिला),(राज्य),(पिन कोड),(मोबाइल नं),(शेयर पूंजी रुपये),(प्रवेश शुल्क),(cash/cheque/online),(member/nominal),(YYYY-MM-DD),(active/inactive),(शेयर संख्या),(प्रति शेयर मूल्य),(नामिनी का नाम),(नामिनी के पिता),(संबंध),(नामिनी आयु),(नामिनी व्यवसाय),(नामिनी पता),(नामिनी शेयर),(नामिनी मोबाइल)",
  "(उदाहरण) M001,राम कुमार शर्मा,श्री हरि शर्मा,35,किसान,General,ग्राम - रामपुर,रामपुर,राणिया,सिरसा,Haryana,125076,9876543210,5000,100,cash,member,2020-04-01,active,10,500,सीता देवी,श्री राम कुमार,पत्नी,30,गृहिणी,ग्राम - रामपुर,10,9876543211",
  "(उदाहरण) M002,सुरेश यादव,श्री महेश यादव,28,व्यापारी,Backward Class,ग्राम - शिवपुर,शिवपुर,राणिया,सिरसा,Haryana,125076,9988776655,2500,100,cheque,member,2021-06-15,active,5,500,,,,,,,,,",
].join('\n');

export const OPENING_BALANCES_TEMPLATE = [
  'account_name,opening_balance,balance_type',
  '(Account का नाम — बिल्कुल वैसा जैसा system में है; समूह नहीं, उसके नीचे का असली खाता),(राशि रुपये में),(Debit/Credit)',
  EXAMPLE + 'Cash in Hand,45000,Debit',
  EXAMPLE + 'Bank Account (Main),115000,Debit',
  EXAMPLE + 'Individual Share Capital,500000,Credit',
  EXAMPLE + 'Statutory Reserve Fund,80000,Credit',
].join('\n');

const isoDate = (s: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10));
const plusDays = (iso: string, n: number): string => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** The voucher template carries example dates INSIDE the society's current financial year (it starts on `fyStart`). */
export function vouchersTemplate(fyStart: string): string {
  const start = isoDate(fyStart);
  return [
    "date,type,debit_account,credit_account,amount,narration,reference",
    "(YYYY-MM-DD),(receipt/payment/journal/contra/sale/purchase),(Debit खाता — system में exact नाम),(Credit खाता — exact नाम),(राशि रुपये),(विवरण),(बाहरी ref जैसे गेट-पास नं — दोबारा import पर duplicate रोकता है)",
    EXAMPLE + plusDays(start, 14) + ',receipt,Cash in Hand,Admission Fee,100,नया सदस्य प्रवेश शुल्क,RCPT-1001',
    EXAMPLE + plusDays(start, 19) + ',payment,Salary,Cash in Hand,15000,मासिक वेतन,PAY-1001',
  ].join('\n');
}

// ─── Validators ───────────────────────────────────────────────────────────────

export const VALID_ACCOUNT_TYPES = ['asset', 'liability', 'income', 'expense', 'equity'];
export const VALID_BALANCE_TYPES = ['debit', 'credit'];
export const VALID_MEMBER_TYPES = ['member', 'nominal'];
export const VALID_STATUS = ['active', 'inactive'];
export const VALID_VOUCHER_TYPES = ['receipt', 'payment', 'journal', 'contra', 'sale', 'purchase'];

// Validate one bulk-voucher row. Mirrors the double-entry guard in addVoucher so
// bad rows are caught in PREVIEW (and skipped) rather than firing per-row toasts at
// import time. Duplicate detection (by `reference`) is handled at import, like Members.
export function validateVoucherRow(
  row: Record<string, string>,
  accounts: LedgerAccount[],
  fyStart: string,
  fyEnd: string,
  rowNum: number,
): RowError[] {
  const errors: RowError[] = [];
  const isExample = (v?: string) => !v || v.trim() === '' || v.trim().startsWith('(');
  const findAcc = (n: string) => accounts.find(a => !a.isGroup && a.name.toLowerCase().trim() === n.toLowerCase().trim());

  const d = (row.date || '').trim();
  if (isExample(d)) errors.push({ row: rowNum, field: 'date', message: `Row ${rowNum}: date खाली/example है (YYYY-MM-DD चाहिए)` });
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))) errors.push({ row: rowNum, field: 'date', message: `Row ${rowNum}: date "${d}" गलत — YYYY-MM-DD format में लिखें` });
  else if (fyStart && (d < fyStart || d > fyEnd)) errors.push({ row: rowNum, field: 'date', message: `Row ${rowNum}: date ${d} चालू वित्त वर्ष (${fyStart} से ${fyEnd}) के बाहर है` });

  const t = (row.type || '').toLowerCase().trim();
  if (isExample(row.type)) errors.push({ row: rowNum, field: 'type', message: `Row ${rowNum}: type खाली/example है` });
  else if (!VALID_VOUCHER_TYPES.includes(t)) errors.push({ row: rowNum, field: 'type', message: `Row ${rowNum}: type "${row.type}" गलत — ${VALID_VOUCHER_TYPES.join('/')} में से एक` });

  const dn = (row.debit_account || '').trim();
  const cn = (row.credit_account || '').trim();
  if (isExample(dn)) errors.push({ row: rowNum, field: 'debit_account', message: `Row ${rowNum}: debit_account खाली/example है` });
  else if (!findAcc(dn)) errors.push({ row: rowNum, field: 'debit_account', message: `Row ${rowNum}: debit_account "${dn}" system में नहीं मिला (Ledger Heads से exact नाम लें)` });
  if (isExample(cn)) errors.push({ row: rowNum, field: 'credit_account', message: `Row ${rowNum}: credit_account खाली/example है` });
  else if (!findAcc(cn)) errors.push({ row: rowNum, field: 'credit_account', message: `Row ${rowNum}: credit_account "${cn}" system में नहीं मिला` });
  if (!isExample(dn) && !isExample(cn) && dn.toLowerCase().trim() === cn.toLowerCase().trim())
    errors.push({ row: rowNum, field: 'credit_account', message: `Row ${rowNum}: debit और credit खाता एक ही नहीं हो सकते` });

  const amt = parseFloat(row.amount);
  if (isExample(row.amount)) errors.push({ row: rowNum, field: 'amount', message: `Row ${rowNum}: amount खाली/example है` });
  else if (isNaN(amt) || amt <= 0) errors.push({ row: rowNum, field: 'amount', message: `Row ${rowNum}: amount "${row.amount}" 0 से बड़ा valid number होना चाहिए` });

  return errors;
}

/** Group a new account lands in when parent_group is blank — a group of the same type that exists in every standard chart. */
export const DEFAULT_PARENT_BY_TYPE: Record<string, string> = { liability: '2100', asset: '3300', expense: '5300', income: '4400', equity: '1200' };

export interface ParentResolution {
  /** The group id to file the account under; null = no group (blank and no usable default). */
  parentId: string | null;
  /** True when the clerk left parent_group blank and the type's default group was used. */
  defaulted: boolean;
  /** Set when parent_group was given but cannot be used — the row must be refused, never silently ungrouped. */
  error?: string;
}

/** Resolve the parent_group cell (a group's name, id or code) to a group of the SAME type. Pure. */
export function resolveParentGroup(row: Record<string, string>, accounts: LedgerAccount[]): ParentResolution {
  const type = (row.account_type || '').toLowerCase().trim();
  const raw = (row.parent_group || '').trim();
  const groups = accounts.filter(a => a.isGroup);
  if (!raw || raw.startsWith('(')) {
    const def = groups.find(g => g.id === DEFAULT_PARENT_BY_TYPE[type] && g.type === type);
    return def ? { parentId: def.id, defaulted: true } : { parentId: null, defaulted: true };
  }
  const key = raw.toLowerCase();
  const hit = groups.filter(g => g.id.toLowerCase() === key || (g.code || '').toLowerCase() === key || g.name.toLowerCase().trim() === key || (g.nameHi || '').trim() === raw);
  if (hit.length === 0) {
    const leaf = accounts.find(a => !a.isGroup && a.name.toLowerCase().trim() === key);
    return { parentId: null, defaulted: false, error: leaf
      ? `parent_group "${raw}" एक खाता है, समूह नहीं — समूह का नाम लिखें (Ledger Heads में 'Group' वाले)`
      : `parent_group "${raw}" इस society में किसी समूह का नाम/कोड नहीं है — Ledger Heads से समूह का exact नाम लें` };
  }
  const same = hit.filter(g => g.type === type);
  if (same.length === 0) return { parentId: null, defaulted: false, error: `parent_group "${raw}" का प्रकार ${hit[0].type} है, जबकि खाता ${type} है — समूह और खाते का प्रकार एक ही होना चाहिए` };
  if (same.length > 1) return { parentId: null, defaulted: false, error: `parent_group "${raw}" के नाम के एक से ज़्यादा समूह हैं — नाम की जगह उसका कोड लिखें` };
  return { parentId: same[0].id, defaulted: false };
}

export function validateAccountRow(row: Record<string, string>, rowNum: number, accounts?: LedgerAccount[]): RowError[] {
  const errors: RowError[] = [];
  if (!row.account_name || row.account_name.startsWith('('))
    errors.push({ row: rowNum, field: 'account_name', message: `Row ${rowNum}: account_name खाली है या example row है` });
  if (!VALID_ACCOUNT_TYPES.includes((row.account_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'account_type', message: `Row ${rowNum}: account_type "${row.account_type}" गलत है — Asset, Liability, Equity, Income, Expense में से एक होना चाहिए` });
  const bal = parseFloat(row.opening_balance);
  if (isNaN(bal) || bal < 0)
    errors.push({ row: rowNum, field: 'opening_balance', message: `Row ${rowNum}: opening_balance "${row.opening_balance}" एक valid number होना चाहिए` });
  if (!VALID_BALANCE_TYPES.includes((row.balance_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'balance_type', message: `Row ${rowNum}: balance_type "${row.balance_type}" गलत है — Debit या Credit होना चाहिए` });
  if (accounts && VALID_ACCOUNT_TYPES.includes((row.account_type || '').toLowerCase())) {
    const r = resolveParentGroup(row, accounts);
    if (r.error) errors.push({ row: rowNum, field: 'parent_group', message: `Row ${rowNum}: ${r.error}` });
  }
  return errors;
}

export function validateMemberRow(row: Record<string, string>, rowNum: number): RowError[] {
  const errors: RowError[] = [];
  if (!row.member_id || row.member_id.startsWith('('))
    errors.push({ row: rowNum, field: 'member_id', message: `Row ${rowNum}: member_id खाली है या example row है` });
  if (!row.name || row.name.startsWith('('))
    errors.push({ row: rowNum, field: 'name', message: `Row ${rowNum}: name (सदस्य का नाम) खाली है` });
  if (!row.father_name || row.father_name.startsWith('('))
    errors.push({ row: rowNum, field: 'father_name', message: `Row ${rowNum}: father_name खाली है` });
  if (!VALID_MEMBER_TYPES.includes((row.member_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'member_type', message: `Row ${rowNum}: member_type "${row.member_type}" गलत है — member या nominal होना चाहिए` });
  if (!row.join_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.join_date))
    errors.push({ row: rowNum, field: 'join_date', message: `Row ${rowNum}: join_date "${row.join_date}" format YYYY-MM-DD होना चाहिए (जैसे 2022-04-01)` });
  if (!VALID_STATUS.includes((row.status || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'status', message: `Row ${rowNum}: status "${row.status}" गलत है — active या inactive होना चाहिए` });
  const sc = parseFloat(row.share_capital);
  if (isNaN(sc) || sc < 0)
    errors.push({ row: rowNum, field: 'share_capital', message: `Row ${rowNum}: share_capital "${row.share_capital}" एक valid number होना चाहिए` });
  return errors;
}

export function validateObRow(row: Record<string, string>, accounts: LedgerAccount[], rowNum: number): RowError[] {
  const errors: RowError[] = [];
  if (!row.account_name || row.account_name.startsWith('('))
    errors.push({ row: rowNum, field: 'account_name', message: `Row ${rowNum}: account_name खाली है या example row है` });
  else {
    // a leaf is preferred if a group happens to share the name; an opening can NEVER go on a group (reports ignore it)
    const sameName = accounts.filter(a => a.name.toLowerCase().trim() === row.account_name.toLowerCase().trim());
    const found = sameName.find(a => !a.isGroup) ?? sameName[0];
    if (found && found.isGroup)
      errors.push({ row: rowNum, field: 'account_name', message: `Row ${rowNum}: "${row.account_name}" एक समूह (parent) खाता है — इस पर शुरुआती बाक़ी नहीं डाल सकते (Trial Balance / Balance Sheet इसे गिनते ही नहीं)। इसके नीचे का असली खाता लिखें` });
    else if (!found)
      errors.push({ row: rowNum, field: 'account_name', message: `Row ${rowNum}: account "${row.account_name}" system में नहीं मिला — पहले Ledger Heads में account बनाएं या नाम check करें` });
  }
  const bal = parseFloat(row.opening_balance);
  if (isNaN(bal) || bal < 0)
    errors.push({ row: rowNum, field: 'opening_balance', message: `Row ${rowNum}: opening_balance "${row.opening_balance}" एक valid number होना चाहिए` });
  if (!VALID_BALANCE_TYPES.includes((row.balance_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'balance_type', message: `Row ${rowNum}: balance_type "${row.balance_type}" गलत है — Debit या Credit होना चाहिए` });
  return errors;
}
