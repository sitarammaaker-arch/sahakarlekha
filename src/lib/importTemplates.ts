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
import { matchImportAccount, candidateList } from '@/lib/importAccountMatch';
import { tr, uiLanguage } from '@/lib/uiLang';

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
/** The English marker. It starts with "(" too, so an example row left in by mistake is refused the same way. */
const EXAMPLE_EN = "(Example) ";

// The templates follow the reader's language AT DOWNLOAD TIME (each builder reads uiLanguage() when called). The header
// row (the column keys the importer parses) is the same in both languages; only the hint row and the example rows change.
function buildAccountsTemplate(en: boolean): string {
  const ex = en ? EXAMPLE_EN : EXAMPLE;
  return [
    'account_name,account_type,opening_balance,balance_type,parent_group',
    en
      ? '(Write the account name here),(Asset/Liability/Equity/Income/Expense),(Opening amount in rupees),(Debit/Credit),(Which group it goes under — group name or code; left blank the usual group of that type is used)'
      : '(यहाँ Account का नाम लिखें),(Asset/Liability/Equity/Income/Expense),(शुरुआती राशि रुपये में),(Debit/Credit),(किस समूह के नीचे — समूह का नाम या कोड; खाली छोड़ें तो प्रकार का सामान्य समूह लगेगा)',
    // A bank must sit under 3302 "Bank Accounts": getBankAccountIds() only treats 3302's children as banks, so a bank
    // under "Current Assets" never reached the Bank Book, bank pickers or the BRS (2026-10-20).
    ex + 'Bank - SBI,Asset,120000,Debit,Bank Accounts',
    // A borrowing sits under 2300 — named "Loans" in most charts but "Borrowings" in PACS, so the example uses the code.
    ex + 'Loan from Bank,Liability,200000,Credit,2300',
    ex + 'Anniversary Fund,Equity,80000,Credit,Reserves & Surplus',
    ex + 'Interest Received,Income,0,Credit,4400',
    ex + 'Office Expense,Expense,0,Debit,Admin Expenses',
  ].join('\n');
}

/** The Hindi accounts template (kept for existing callers). Prefer accountsTemplate(), which follows the language. */
export const ACCOUNTS_TEMPLATE = buildAccountsTemplate(false);
/** The accounts template in the reader's current language (read when called, i.e. at download time). */
export function accountsTemplate(): string {
  return buildAccountsTemplate(uiLanguage() === 'en');
}

function buildOpeningBalancesTemplate(en: boolean): string {
  const ex = en ? EXAMPLE_EN : EXAMPLE;
  return [
    'account_name,opening_balance,balance_type',
    en
      ? '(Account name — exactly as it is in the system; not a group but the real account under it),(Amount in rupees),(Debit/Credit)'
      : '(Account का नाम — बिल्कुल वैसा जैसा system में है; समूह नहीं, उसके नीचे का असली खाता),(राशि रुपये में),(Debit/Credit)',
    ex + 'Cash in Hand,45000,Debit',
    ex + 'Bank Account (Main),115000,Debit',
    ex + 'Individual Share Capital,500000,Credit',
    ex + 'Statutory Reserve Fund,80000,Credit',
  ].join('\n');
}

/** The Hindi opening-balances template (kept for existing callers). Prefer openingBalancesTemplate(). */
export const OPENING_BALANCES_TEMPLATE = buildOpeningBalancesTemplate(false);
/** The opening-balances template in the reader's current language (read when called, i.e. at download time). */
export function openingBalancesTemplate(): string {
  return buildOpeningBalancesTemplate(uiLanguage() === 'en');
}

const isRealDate = (iso: string): boolean => { const d = new Date(iso + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso; };
const isoDate = (s: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10));
const plusDays = (iso: string, n: number): string => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** The voucher template carries example dates INSIDE the society's current financial year (it starts on `fyStart`). */
export function vouchersTemplate(fyStart: string): string {
  const start = isoDate(fyStart);
  const en = uiLanguage() === 'en';
  const ex = en ? EXAMPLE_EN : EXAMPLE;
  return [
    "date,type,debit_account,credit_account,amount,narration,reference",
    en
      ? "(YYYY-MM-DD),(receipt/payment/journal/contra/sale/purchase),(Debit account — exact name in the system),(Credit account — exact name),(Amount in rupees),(Narration),(Outside ref such as gate-pass no. — stops a duplicate on a second import)"
      : "(YYYY-MM-DD),(receipt/payment/journal/contra/sale/purchase),(Debit खाता — system में exact नाम),(Credit खाता — exact नाम),(राशि रुपये),(विवरण),(बाहरी ref जैसे गेट-पास नं — दोबारा import पर duplicate रोकता है)",
    ex + plusDays(start, 14) + (en ? ',receipt,Cash in Hand,Admission Fee,100,New member admission fee,RCPT-1001' : ',receipt,Cash in Hand,Admission Fee,100,नया सदस्य प्रवेश शुल्क,RCPT-1001'),
    ex + plusDays(start, 19) + (en ? ',payment,Salary,Cash in Hand,15000,Monthly salary,PAY-1001' : ',payment,Salary,Cash in Hand,15000,मासिक वेतन,PAY-1001'),
  ].join('\n');
}

/**
 * Members import template. Old vs new member is decided by join_date against the current FY (the SAME rule
 * the import uses — members/joiningReceipts.isHistoricalJoin): before the FY starts → OLD member, no receipt
 * (share goes to the opening balances); in this FY → NEW member, a cash/bank receipt is posted. The examples
 * show both: M001/M002 old, M003 new (dated the FY's first day).
 */
export function membersTemplate(fyStart: string): string {
  const start = isoDate(fyStart);
  const header = `member_id,name,father_name,age,occupation,caste,address,post_office,tehsil,district,state,pin_code,phone,share_capital,admission_fee,payment_mode,member_type,join_date,status,share_count,share_face_value,nominee_name,nominee_father_name,nominee_relation,nominee_age,nominee_occupation,nominee_address,nominee_shares,nominee_phone`;
  if (uiLanguage() === 'en') {
    return [
      header,
      `(Member no.),(Full name),(Father's/husband's name),(Age),(Occupation),(General/Backward Class/Schedule Caste/Schedule Tribe),(Address),(Post office),(Tehsil),(District),(State),(PIN code),(Mobile no.),(Share capital in rupees),(Admission fee),(cash/cheque/online),(member/nominal),(YYYY-MM-DD — a date before the financial year starts = earlier member: no receipt / share goes into opening; a date in this financial year = new member: a receipt is made),(active/inactive),(Number of shares),(Value per share),(Nominee's name),(Nominee's father),(Relation),(Nominee's age),(Nominee's occupation),(Nominee's address),(Nominee's shares),(Nominee's mobile)`,
      `${EXAMPLE_EN}M001,Ram Kumar Sharma,Shri Hari Sharma,35,Farmer,General,Village - Rampur,Rampur,Rania,Sirsa,Haryana,125076,9876543210,5000,100,cash,member,2020-04-01,active,10,500,Sita Devi,Shri Ram Kumar,Wife,30,Homemaker,Village - Rampur,10,9876543211`,
      `${EXAMPLE_EN}M002,Suresh Yadav,Shri Mahesh Yadav,28,Trader,Backward Class,Village - Shivpur,Shivpur,Rania,Sirsa,Haryana,125076,9988776655,2500,100,cheque,member,2021-06-15,active,5,500,,,,,,,,`,
      `${EXAMPLE_EN}M003,Geeta Devi,Shri Mohan Lal,42,Farmer,General,Village - Rampur,Rampur,Rania,Sirsa,Haryana,125076,9812345678,1000,100,cash,member,${start},active,2,500,,,,,,,,`,
    ].join('\n');
  }
  return [
    header,
    `(सदस्य क्रमांक),(पूरा नाम),(पिता/पति का नाम),(आयु),(व्यवसाय),(General/Backward Class/Schedule Caste/Schedule Tribe),(पता),(डाकघर),(तहसील),(जिला),(राज्य),(पिन कोड),(मोबाइल नं),(शेयर पूंजी रुपये),(प्रवेश शुल्क),(cash/cheque/online),(member/nominal),(YYYY-MM-DD — वित्त वर्ष शुरू होने से पहले की तारीख़ = पुराना सदस्य: रसीद नहीं बनेगी / शेयर opening में; इसी वित्त वर्ष की = नया सदस्य: रसीद बनेगी),(active/inactive),(शेयर संख्या),(प्रति शेयर मूल्य),(नामिनी का नाम),(नामिनी के पिता),(संबंध),(नामिनी आयु),(नामिनी व्यवसाय),(नामिनी पता),(नामिनी शेयर),(नामिनी मोबाइल)`,
    `(उदाहरण) M001,राम कुमार शर्मा,श्री हरि शर्मा,35,किसान,General,ग्राम - रामपुर,रामपुर,राणिया,सिरसा,Haryana,125076,9876543210,5000,100,cash,member,2020-04-01,active,10,500,सीता देवी,श्री राम कुमार,पत्नी,30,गृहिणी,ग्राम - रामपुर,10,9876543211`,
    `(उदाहरण) M002,सुरेश यादव,श्री महेश यादव,28,व्यापारी,Backward Class,ग्राम - शिवपुर,शिवपुर,राणिया,सिरसा,Haryana,125076,9988776655,2500,100,cheque,member,2021-06-15,active,5,500,,,,,,,,`,
    `(उदाहरण) M003,गीता देवी,श्री मोहन लाल,42,किसान,General,ग्राम - रामपुर,रामपुर,राणिया,सिरसा,Haryana,125076,9812345678,1000,100,cash,member,${start},active,2,500,,,,,,,,`,
  ].join('\n');
}

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * IMP-01 (audit 2026-11-17): an amount from a sheet, as people type it — "1,20,000", "₹ 5,000.50", "Rs. 2500", "300/-".
 * parseFloat('1,20,000') is 1: the import validated, previewed the raw text and saved ONE rupee. This strips the rupee
 * sign, "Rs" / "INR", spaces, thousands commas (Indian or Western grouping) and a trailing "/-", then accepts only a plain
 * number. Anything else (blank, "12a", "1.2.3") is NaN — the row is refused, never saved as a wrong figure.
 */
export function parseImportNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  let s = String(raw ?? '').trim();
  if (!s) return NaN;
  s = s.replace(/^(₹|rs\.?|inr)\s*/i, '').replace(/\s*\/-$/, '').replace(/[\s,]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export const VALID_ACCOUNT_TYPES = ['asset', 'liability', 'income', 'expense', 'equity'];
export const VALID_BALANCE_TYPES = ['debit', 'credit'];
export const VALID_MEMBER_TYPES = ['member', 'nominal', 'associate'];
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
  // One rule with the commit step (lib/importAccountMatch): a code, or a name carried by exactly one ledger.
  const accErr = (field: 'debit_account' | 'credit_account', n: string): RowError | null => {
    const m = matchImportAccount(n, accounts);
    if (m.status === 'ok') return null;
    if (m.status === 'ambiguous') return { row: rowNum, field, message: tr(`Row ${rowNum}: ${field} "${n}" नाम के ${m.candidates.length} खाते हैं — नाम की जगह खाते का कोड लिखें: ${candidateList(m.candidates)}`, `Row ${rowNum}: ${field} "${n}" matches ${m.candidates.length} accounts — write the account code instead of the name: ${candidateList(m.candidates)}`) };
    if (m.status === 'group') return { row: rowNum, field, message: tr(`Row ${rowNum}: ${field} "${n}" एक समूह (parent) खाता है — उसके नीचे का खाता लिखें`, `Row ${rowNum}: ${field} "${n}" is a group (parent) account — write an account under it`) };
    return { row: rowNum, field, message: tr(`Row ${rowNum}: ${field} "${n}" system में नहीं मिला (Ledger Heads से exact नाम या कोड लें)`, `Row ${rowNum}: ${field} "${n}" not found in the system (take the exact name or code from Ledger Heads)`) };
  };

  const d = (row.date || '').trim();
  if (isExample(d)) errors.push({ row: rowNum, field: 'date', message: tr(`Row ${rowNum}: date खाली/example है (YYYY-MM-DD चाहिए)`, `Row ${rowNum}: date is blank/example (YYYY-MM-DD needed)`) });
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))) errors.push({ row: rowNum, field: 'date', message: tr(`Row ${rowNum}: date "${d}" गलत — YYYY-MM-DD format में लिखें`, `Row ${rowNum}: date "${d}" is wrong — write it in YYYY-MM-DD format`) });
  else if (fyStart && (d < fyStart || d > fyEnd)) errors.push({ row: rowNum, field: 'date', message: tr(`Row ${rowNum}: date ${d} चालू वित्त वर्ष (${fyStart} से ${fyEnd}) के बाहर है`, `Row ${rowNum}: date ${d} is outside the current financial year (${fyStart} to ${fyEnd})`) });

  const t = (row.type || '').toLowerCase().trim();
  if (isExample(row.type)) errors.push({ row: rowNum, field: 'type', message: tr(`Row ${rowNum}: type खाली/example है`, `Row ${rowNum}: type is blank/example`) });
  else if (!VALID_VOUCHER_TYPES.includes(t)) errors.push({ row: rowNum, field: 'type', message: tr(`Row ${rowNum}: type "${row.type}" गलत — ${VALID_VOUCHER_TYPES.join('/')} में से एक`, `Row ${rowNum}: type "${row.type}" is wrong — must be one of ${VALID_VOUCHER_TYPES.join('/')}`) });

  const dn = (row.debit_account || '').trim();
  const cn = (row.credit_account || '').trim();
  if (isExample(dn)) errors.push({ row: rowNum, field: 'debit_account', message: tr(`Row ${rowNum}: debit_account खाली/example है`, `Row ${rowNum}: debit_account is blank/example`) });
  else { const e = accErr('debit_account', dn); if (e) errors.push(e); }
  if (isExample(cn)) errors.push({ row: rowNum, field: 'credit_account', message: tr(`Row ${rowNum}: credit_account खाली/example है`, `Row ${rowNum}: credit_account is blank/example`) });
  else { const e = accErr('credit_account', cn); if (e) errors.push(e); }
  // Same ledger on both sides — compared by the RESOLVED account, so "5308" and "Rent Expense" count as one.
  const dm = isExample(dn) ? null : matchImportAccount(dn, accounts);
  const cm = isExample(cn) ? null : matchImportAccount(cn, accounts);
  if ((dm?.status === 'ok' && cm?.status === 'ok' && dm.account.id === cm.account.id)
    || (!isExample(dn) && !isExample(cn) && dn.toLowerCase().trim() === cn.toLowerCase().trim()))
    errors.push({ row: rowNum, field: 'credit_account', message: tr(`Row ${rowNum}: debit और credit खाता एक ही नहीं हो सकते`, `Row ${rowNum}: debit and credit account cannot be the same`) });

  const amt = parseImportNumber(row.amount);
  if (isExample(row.amount)) errors.push({ row: rowNum, field: 'amount', message: tr(`Row ${rowNum}: amount खाली/example है`, `Row ${rowNum}: amount is blank/example`) });
  else if (isNaN(amt) || amt <= 0) errors.push({ row: rowNum, field: 'amount', message: tr(`Row ${rowNum}: amount "${row.amount}" 0 से बड़ा valid number होना चाहिए`, `Row ${rowNum}: amount "${row.amount}" must be a valid number above 0`) });

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
      ? tr(`parent_group "${raw}" एक खाता है, समूह नहीं — समूह का नाम लिखें (Ledger Heads में 'Group' वाले)`, `parent_group "${raw}" is an account, not a group — write a group name (the 'Group' ones in Ledger Heads)`)
      : tr(`parent_group "${raw}" इस society में किसी समूह का नाम/कोड नहीं है — Ledger Heads से समूह का exact नाम लें`, `parent_group "${raw}" is not the name/code of any group in this society — take the exact group name from Ledger Heads`) };
  }
  const same = hit.filter(g => g.type === type);
  if (same.length === 0) return { parentId: null, defaulted: false, error: tr(`parent_group "${raw}" का प्रकार ${hit[0].type} है, जबकि खाता ${type} है — समूह और खाते का प्रकार एक ही होना चाहिए`, `parent_group "${raw}" is of type ${hit[0].type}, but the account is ${type} — the group and the account must be of the same type`) };
  if (same.length > 1) return { parentId: null, defaulted: false, error: tr(`parent_group "${raw}" के नाम के एक से ज़्यादा समूह हैं — नाम की जगह उसका कोड लिखें`, `more than one group is named parent_group "${raw}" — write its code instead of the name`) };
  return { parentId: same[0].id, defaulted: false };
}

export function validateAccountRow(row: Record<string, string>, rowNum: number, accounts?: LedgerAccount[]): RowError[] {
  const errors: RowError[] = [];
  if (!row.account_name || row.account_name.startsWith('('))
    errors.push({ row: rowNum, field: 'account_name', message: tr(`Row ${rowNum}: account_name खाली है या example row है`, `Row ${rowNum}: account_name is blank or this is an example row`) });
  if (!VALID_ACCOUNT_TYPES.includes((row.account_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'account_type', message: tr(`Row ${rowNum}: account_type "${row.account_type}" गलत है — Asset, Liability, Equity, Income, Expense में से एक होना चाहिए`, `Row ${rowNum}: account_type "${row.account_type}" is wrong — must be one of Asset, Liability, Equity, Income, Expense`) });
  const bal = parseImportNumber(row.opening_balance);
  if (isNaN(bal) || bal < 0)
    errors.push({ row: rowNum, field: 'opening_balance', message: tr(`Row ${rowNum}: opening_balance "${row.opening_balance}" एक valid number होना चाहिए`, `Row ${rowNum}: opening_balance "${row.opening_balance}" must be a valid number`) });
  if (!VALID_BALANCE_TYPES.includes((row.balance_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'balance_type', message: tr(`Row ${rowNum}: balance_type "${row.balance_type}" गलत है — Debit या Credit होना चाहिए`, `Row ${rowNum}: balance_type "${row.balance_type}" is wrong — must be Debit or Credit`) });
  if (accounts && VALID_ACCOUNT_TYPES.includes((row.account_type || '').toLowerCase())) {
    const r = resolveParentGroup(row, accounts);
    if (r.error) errors.push({ row: rowNum, field: 'parent_group', message: `Row ${rowNum}: ${r.error}` });
  }
  return errors;
}

export function validateMemberRow(row: Record<string, string>, rowNum: number, today: string = new Date().toISOString().slice(0, 10)): RowError[] {
  const errors: RowError[] = [];
  if (!row.member_id || row.member_id.startsWith('('))
    errors.push({ row: rowNum, field: 'member_id', message: tr(`Row ${rowNum}: member_id खाली है या example row है`, `Row ${rowNum}: member_id is blank or this is an example row`) });
  if (!row.name || row.name.startsWith('('))
    errors.push({ row: rowNum, field: 'name', message: tr(`Row ${rowNum}: name (सदस्य का नाम) खाली है`, `Row ${rowNum}: name (member's name) is blank`) });
  if (!row.father_name || row.father_name.startsWith('('))
    errors.push({ row: rowNum, field: 'father_name', message: tr(`Row ${rowNum}: father_name खाली है`, `Row ${rowNum}: father_name is blank`) });
  if (!VALID_MEMBER_TYPES.includes((row.member_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'member_type', message: tr(`Row ${rowNum}: member_type "${row.member_type}" गलत है — member या nominal होना चाहिए`, `Row ${rowNum}: member_type "${row.member_type}" is wrong — must be member or nominal`) });
  // join_date decides OLD vs NEW member (receipt or opening balance): mandatory, a real date, not in the future.
  if (!row.join_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.join_date))
    errors.push({ row: rowNum, field: 'join_date', message: tr(`Row ${rowNum}: join_date "${row.join_date ?? ''}" ज़रूरी है, format YYYY-MM-DD (जैसे 2022-04-01) — इसी से तय होता है कि सदस्य पुराना है या नया`, `Row ${rowNum}: join_date "${row.join_date ?? ''}" is required, format YYYY-MM-DD (e.g. 2022-04-01) — it decides whether the member is earlier or new`) });
  else if (!isRealDate(row.join_date))
    errors.push({ row: rowNum, field: 'join_date', message: tr(`Row ${rowNum}: join_date "${row.join_date}" कैलेंडर में नहीं है`, `Row ${rowNum}: join_date "${row.join_date}" is not a real calendar date`) });
  else if (row.join_date > today)
    errors.push({ row: rowNum, field: 'join_date', message: tr(`Row ${rowNum}: join_date "${row.join_date}" भविष्य की तारीख़ है`, `Row ${rowNum}: join_date "${row.join_date}" is a future date`) });
  if (!VALID_STATUS.includes((row.status || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'status', message: tr(`Row ${rowNum}: status "${row.status}" गलत है — active या inactive होना चाहिए`, `Row ${rowNum}: status "${row.status}" is wrong — must be active or inactive`) });
  const sc = parseImportNumber(row.share_capital);
  if (isNaN(sc) || sc < 0)
    errors.push({ row: rowNum, field: 'share_capital', message: tr(`Row ${rowNum}: share_capital "${row.share_capital}" एक valid number होना चाहिए`, `Row ${rowNum}: share_capital "${row.share_capital}" must be a valid number`) });
  return errors;
}

export function validateObRow(row: Record<string, string>, accounts: LedgerAccount[], rowNum: number): RowError[] {
  const errors: RowError[] = [];
  if (!row.account_name || row.account_name.startsWith('('))
    errors.push({ row: rowNum, field: 'account_name', message: tr(`Row ${rowNum}: account_name खाली है या example row है`, `Row ${rowNum}: account_name is blank or this is an example row`) });
  else {
    // One rule with the commit step (lib/importAccountMatch): a code, or a name carried by exactly one ledger.
    // An opening can NEVER go on a group (reports ignore it), and never on a guess between two same-named ledgers.
    const m = matchImportAccount(row.account_name, accounts);
    const found = m.status === 'ok' || m.status === 'group' ? m.account : m.status === 'ambiguous' ? m.candidates[0] : undefined;
    if (m.status === 'ambiguous')
      errors.push({ row: rowNum, field: 'account_name', message: tr(`Row ${rowNum}: "${row.account_name}" नाम के ${m.candidates.length} खाते हैं — नाम की जगह खाते का कोड लिखें: ${candidateList(m.candidates)}`, `Row ${rowNum}: "${row.account_name}" matches ${m.candidates.length} accounts — write the account code instead of the name: ${candidateList(m.candidates)}`) });
    else if (found && found.isGroup)
      errors.push({ row: rowNum, field: 'account_name', message: tr(`Row ${rowNum}: "${row.account_name}" एक समूह (parent) खाता है — इस पर शुरुआती बाक़ी नहीं डाल सकते (Trial Balance / Balance Sheet इसे गिनते ही नहीं)। इसके नीचे का असली खाता लिखें`, `Row ${rowNum}: "${row.account_name}" is a group (parent) account — an opening balance cannot go on it (Trial Balance / Balance Sheet do not count it). Write the real account under it`) });
    else if (!found)
      errors.push({ row: rowNum, field: 'account_name', message: tr(`Row ${rowNum}: account "${row.account_name}" system में नहीं मिला — पहले Ledger Heads में account बनाएं या नाम check करें`, `Row ${rowNum}: account "${row.account_name}" not found in the system — first create the account in Ledger Heads or check the name`) });
  }
  const bal = parseImportNumber(row.opening_balance);
  if (isNaN(bal) || bal < 0)
    errors.push({ row: rowNum, field: 'opening_balance', message: tr(`Row ${rowNum}: opening_balance "${row.opening_balance}" एक valid number होना चाहिए`, `Row ${rowNum}: opening_balance "${row.opening_balance}" must be a valid number`) });
  if (!VALID_BALANCE_TYPES.includes((row.balance_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'balance_type', message: tr(`Row ${rowNum}: balance_type "${row.balance_type}" गलत है — Debit या Credit होना चाहिए`, `Row ${rowNum}: balance_type "${row.balance_type}" is wrong — must be Debit or Credit`) });
  return errors;
}
