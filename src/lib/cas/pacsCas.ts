/**
 * NABARD Common Accounting System (CAS) for PACS — the statements in the CAS formats. PURE.
 *
 * Source: NABARD DCRR, "Manual on Common Accounting System (CAS) for Primary Agricultural Credit
 * Societies" — Annexure II (Trading Account), III (Profit & Loss Account), IV (Balance Sheet);
 * chapter 2 (Chart of Accounts), 6.3 (interest). Mapping report: docs/research/CAS-MAPPING-PACS-2026-09.md.
 *
 * This is a REPORTING layer: the society's own chart and books are untouched. Every CAS line maps to
 * the app's PACS ledger heads; a head that maps to no CAS line lands in that section's "Others"
 * line and is listed, so NOTHING is dropped — the CAS totals tie to the app's own Balance Sheet /
 * P&L / Trading Account (RULE 2; enforced by test:cas-statements).
 *
 * CAS presentation choices (founder decision, 2026-09-27):
 *  - D2: the Overdue Interest Reserve (2211) is shown as "Less: Provision for overdue interest"
 *    on the ASSET side (Annexure IV, Other Assets 1(b)), not as a liability — both totals fall by
 *    the same amount, so the sheet still balances.
 *  - Interest receivable (3313 + 3312) is split into "accrued but not due (standard)" and
 *    "overdue interest receivable" using the per-loan accruals (loanInterestDue, H2).
 */
import type { AccountBalance } from '@/types';

export type CasSide = 'liabilities' | 'assets' | 'expenditure' | 'income' | 'tradingDr' | 'tradingCr';

export interface CasLineDef {
  id: string;
  label: string;
  labelHi: string;
  /** Explicit ledger heads (PACS chart ids). */
  ids?: string[];
  /** Fallback by subtype (used only if no explicit id matched). */
  subtypes?: string[];
  /** This line receives every head of its side that no other line claimed. */
  catchAll?: boolean;
  /** Filled by the builder from a computed figure, not from ledger heads. */
  key?: string;
  indent?: number;
}

export interface CasSectionDef { id: string; label: string; labelHi: string; lines: CasLineDef[] }

export interface CasRow extends Omit<CasLineDef, 'ids' | 'subtypes'> {
  amount: number;
  /** Ledger heads that make up this row (audit trail). */
  heads: { id: string; name: string; amount: number }[];
}
export interface CasSection { id: string; label: string; labelHi: string; rows: CasRow[]; total: number }

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Annexure IV — Balance Sheet ──────────────────────────────────────────────────────────────
export const CAS_BS_LIABILITIES: CasSectionDef[] = [
  { id: 'L1', label: 'Capital (Paid-up)', labelHi: 'पूँजी (चुकता)', lines: [
    { id: 'L1a', label: 'a) Individuals', labelHi: 'क) व्यक्तिगत सदस्य', ids: ['1102'] },
    { id: 'L1b', label: 'b) Government', labelHi: 'ख) सरकार', ids: ['1101'] },
    { id: 'L1c', label: 'c) Others', labelHi: 'ग) अन्य', ids: ['1103'], subtypes: ['share_capital'] },
  ] },
  { id: 'L2', label: 'Reserves and Funds (created out of surplus)', labelHi: 'संचय एवं निधियाँ (अधिशेष से)', lines: [
    { id: 'L2i', label: 'i. Reserve Fund', labelHi: 'i. संचय निधि', ids: ['1201'] },
    { id: 'L2ii', label: 'ii. Capital Reserve', labelHi: 'ii. पूँजी संचय' },
    { id: 'L2iii', label: 'iii. Agricultural Credit Stabilisation Fund', labelHi: 'iii. कृषि ऋण स्थिरीकरण निधि' },
    { id: 'L2iv', label: 'iv. Dividend Equalization Fund', labelHi: 'iv. लाभांश समीकरण निधि' },
    { id: 'L2v', label: 'v. Common Good Fund', labelHi: 'v. सामान्य हित निधि' },
    { id: 'L2vi', label: 'vi. Building Fund', labelHi: 'vi. भवन निधि', ids: ['1202'] },
    { id: 'L2vii', label: 'vii. Others', labelHi: 'vii. अन्य', ids: ['1203', '1204', '1205', '1206', '1207', '1209', '1210', '1211'], subtypes: ['reserve'] },
  ] },
  { id: 'L3', label: 'Profit and Loss Account (if closing balance is profit)', labelHi: 'लाभ-हानि खाता (यदि लाभ)', lines: [
    { id: 'L3', label: 'Profit and Loss Account', labelHi: 'लाभ-हानि खाता', key: 'plProfit' },
  ] },
  { id: 'L4', label: 'Grants and other Funds', labelHi: 'अनुदान एवं अन्य निधियाँ', lines: [
    { id: 'L4i', label: 'i. Provident Fund', labelHi: 'i. भविष्य निधि' },
    { id: 'L4ii', label: 'ii. Building Fund (from State Government)', labelHi: 'ii. भवन निधि (राज्य सरकार से)' },
    { id: 'L4iii', label: 'iii. Recapitalisation Assistance Fund', labelHi: 'iii. पुनर्पूँजीकरण सहायता निधि' },
    { id: 'L4iv', label: 'iv. Subsidies meant for Society', labelHi: 'iv. समिति हेतु अनुदान' },
    { id: 'L4v', label: 'v. Subsidy meant for members', labelHi: 'v. सदस्यों हेतु अनुदान' },
    { id: 'L4vi', label: 'vi. Others', labelHi: 'vi. अन्य' },
  ] },
  { id: 'L5', label: 'Deposits', labelHi: 'जमाएँ', lines: [
    { id: 'L5i', label: 'i. Savings Deposits', labelHi: 'i. बचत जमा', ids: ['2107'] },
    { id: 'L5ii', label: 'ii. Recurring Deposits', labelHi: 'ii. आवर्ती जमा' },
    { id: 'L5iii', label: 'iii. Fixed Deposits', labelHi: 'iii. सावधि जमा', ids: ['2108'] },
    { id: 'L5iv', label: 'iv. Reinvestment Deposits', labelHi: 'iv. पुनर्निवेश जमा' },
    { id: 'L5v', label: 'v. Others', labelHi: 'v. अन्य', subtypes: ['deposit'] },
  ] },
  { id: 'L6', label: 'Borrowings', labelHi: 'उधार', lines: [
    { id: 'L6a-i', label: '(a) DCCB/SCB — i. ST (SAO) / KCC Credit Limit', labelHi: '(क) DCCB/SCB — i. अल्पकालीन / KCC ऋण-सीमा', ids: ['2305'] },
    { id: 'L6a-ii', label: 'ii. MT/LT Agri Loans', labelHi: 'ii. मध्यम/दीर्घकालीन कृषि ऋण', ids: ['2304'] },
    { id: 'L6a-xv', label: 'iii–xv. Other borrowings from DCCB / SCB', labelHi: 'iii–xv. DCCB/SCB से अन्य उधार', ids: ['2301'] },
    { id: 'L6b', label: '(b) Borrowings from State Government', labelHi: '(ख) राज्य सरकार से उधार' },
    { id: 'L6c', label: '(c) Borrowings from Other Institutions', labelHi: '(ग) अन्य संस्थाओं से उधार', ids: ['2302', '2303', '2306'], subtypes: ['long_term_loan'] },
  ] },
  { id: 'L7', label: 'Other Liabilities', labelHi: 'अन्य देनदारियाँ', lines: [
    { id: 'L7i', label: 'i. Interest Accrued on Deposits', labelHi: 'i. जमा पर उपार्जित ब्याज' },
    { id: 'L7ii', label: 'ii. Interest Accrued on Borrowings', labelHi: 'ii. उधार पर उपार्जित ब्याज' },
    { id: 'L7iii', label: 'iii. Unclaimed Dividend', labelHi: 'iii. अदावी लाभांश', ids: ['2104'] },
    { id: 'L7iv', label: 'iv. Sundry Creditors', labelHi: 'iv. विविध लेनदार', ids: ['2101', '2101-01'] },
    { id: 'L7v', label: 'v. Others', labelHi: 'v. अन्य', catchAll: true },
  ] },
  { id: 'L8', label: 'Bills for Collection (as per contra)', labelHi: 'वसूली हेतु बिल (प्रतिपक्ष)', lines: [
    { id: 'L8', label: 'Bills for Collection', labelHi: 'वसूली हेतु बिल' },
  ] },
  { id: 'L10', label: 'Provisions', labelHi: 'प्रावधान', lines: [
    { id: 'L10i', label: 'i. Provision for PF / Gratuity / Bonus / Pension', labelHi: 'i. PF / उपदान / बोनस / पेंशन प्रावधान' },
    { id: 'L10ii', label: 'ii. Provision for Standard Assets', labelHi: 'ii. मानक परिसंपत्ति प्रावधान' },
    { id: 'L10iii', label: 'iii. Provision for Expenses', labelHi: 'iii. व्यय प्रावधान' },
    { id: 'L10iv', label: 'iv. Others', labelHi: 'iv. अन्य' },
  ] },
];

export const CAS_BS_ASSETS: CasSectionDef[] = [
  { id: 'A1', label: 'Cash on Hand', labelHi: 'हाथ में नकद', lines: [
    { id: 'A1', label: 'Cash on Hand', labelHi: 'हाथ में नकद', ids: ['3301'] },
  ] },
  { id: 'A2', label: 'Balances with DCCB / SCB and other banks', labelHi: 'DCCB / SCB व अन्य बैंकों में शेष', lines: [
    { id: 'A2', label: 'Bank balances (bank-wise split not held in the ledger)', labelHi: 'बैंक शेष (बैंक-वार बँटवारा ledger में नहीं)', ids: ['3302', '3302-01'], subtypes: ['cash_bank'] },
  ] },
  { id: 'A4', label: 'Investments', labelHi: 'निवेश', lines: [
    { id: 'A4i', label: 'i. Government and Trustee Securities', labelHi: 'i. सरकारी व ट्रस्टी प्रतिभूतियाँ' },
    { id: 'A4ii', label: 'ii. Shares in Other Cooperative Institutions', labelHi: 'ii. अन्य सहकारी संस्थाओं में शेयर', ids: ['3208'] },
    { id: 'A4iii', label: 'iii. Term Deposits with DCCB/SCB representing Reserve Funds', labelHi: 'iii. संचय निधि के रूप में DCCB/SCB में सावधि जमा' },
    { id: 'A4iv', label: 'iv–v. Term Deposits with DCCB/SCB (other) and other banks', labelHi: 'iv–v. DCCB/SCB (अन्य) व अन्य बैंकों में सावधि जमा', ids: ['3205'] },
    { id: 'A4vi', label: 'vi. NSC / KVP', labelHi: 'vi. NSC / KVP', ids: ['3207'] },
    { id: 'A4vii', label: 'vii. Staff PF balance with PF Trust / Banks', labelHi: 'vii. कर्मचारी PF शेष' },
    { id: 'A4viii', label: 'viii. Others', labelHi: 'viii. अन्य', ids: ['3206'], subtypes: ['investment'] },
    { id: 'A4b', label: '(b) Less: Provision for depreciation in the value of investment', labelHi: '(ख) घटाएँ: निवेश मूल्य-ह्रास प्रावधान' },
  ] },
  { id: 'A5', label: 'Loans and Advances', labelHi: 'ऋण एवं अग्रिम', lines: [
    { id: 'A5i', label: 'i. ST (SAO) Loans / KCC Loans', labelHi: 'i. अल्पकालीन / KCC ऋण', ids: ['3303'] },
    { id: 'A5ii', label: 'ii. Medium Term / Long Term Agricultural Loans', labelHi: 'ii. मध्यम / दीर्घकालीन कृषि ऋण', ids: ['3304', '3305'] },
    { id: 'A5xi', label: 'xi. Loans to Staff Members', labelHi: 'xi. कर्मचारियों को ऋण', ids: ['3315'] },
    { id: 'A5xii', label: 'iii–x, xii. Other Loans', labelHi: 'iii–x, xii. अन्य ऋण', ids: ['3316'] },
    { id: 'A5b', label: '(b) Less: Provision for NPA', labelHi: '(ख) घटाएँ: NPA प्रावधान' },
  ] },
  { id: 'A6', label: 'Closing Stocks', labelHi: 'समापन माल', lines: [
    { id: 'A6', label: 'Closing stock (category-wise split not held in the ledger)', labelHi: 'समापन माल (श्रेणी-वार बँटवारा ledger में नहीं)', key: 'closingStock', subtypes: ['inventory'] },
  ] },
  { id: 'A7', label: 'Fixed Assets (net of depreciation)', labelHi: 'स्थायी परिसंपत्तियाँ (ह्रास घटाकर)', lines: [
    { id: 'A7i', label: 'i. Land and Buildings / Godowns', labelHi: 'i. भूमि एवं भवन / गोदाम', ids: ['3101', '3102', '3108'] },
    { id: 'A7ii', label: 'ii. Furniture and Fixtures', labelHi: 'ii. फर्नीचर एवं फिक्सचर', ids: ['3103', '3109'] },
    { id: 'A7iii', label: 'iii. Computers and Electrical Installations', labelHi: 'iii. कंप्यूटर व विद्युत उपकरण', ids: ['3107'] },
    { id: 'A7iv', label: 'iv. Vehicles', labelHi: 'iv. वाहन', ids: ['3104', '3110'] },
    { id: 'A7v', label: 'v. Others', labelHi: 'v. अन्य', ids: ['3105', '3106', '3111', '3112'], subtypes: ['fixed_asset', 'accumulated_dep'] },
  ] },
  { id: 'A8', label: 'Other Assets', labelHi: 'अन्य परिसंपत्तियाँ', lines: [
    { id: 'A8-1a-i', label: '1(a) i. Interest Accrued but not due on Standard Loans', labelHi: '1(क) i. मानक ऋणों पर उपार्जित (अदेय) ब्याज', key: 'interestAccruedStandard' },
    { id: 'A8-1a-ii', label: 'ii. Interest accrued but not due on NPA Loans', labelHi: 'ii. NPA ऋणों पर उपार्जित ब्याज' },
    { id: 'A8-1a-iii', label: 'iii. Overdue interest receivable', labelHi: 'iii. अतिदेय प्राप्य ब्याज', key: 'overdueInterestReceivable' },
    { id: 'A8-1b', label: '1(b) Less: Provision for overdue interest (Overdue Interest Reserve)', labelHi: '1(ख) घटाएँ: अतिदेय ब्याज प्रावधान (अतिदेय ब्याज संचय)', key: 'overdueInterestProvision' },
    { id: 'A8-2', label: '2. Interest receivable on Investments (net)', labelHi: '2. निवेश पर प्राप्य ब्याज (शुद्ध)' },
    { id: 'A8-3', label: '3. Miscellaneous Income Receivable', labelHi: '3. विविध प्राप्य आय', ids: ['3314'] },
    { id: 'A8-4', label: '4. Sundry debtors for credit sales (net)', labelHi: '4. उधार बिक्री के देनदार (शुद्ध)' },
    { id: 'A8-5', label: '5. Sundry debtors (others) (net)', labelHi: '5. अन्य देनदार (शुद्ध)' },
    { id: 'A8-6', label: '6. Prepaid expenses', labelHi: '6. अग्रिम व्यय', ids: ['3311'] },
    { id: 'A8-7', label: '7. Tax Deducted at Source', labelHi: '7. स्रोत पर कटा कर (TDS)', ids: ['3307'] },
    { id: 'A8-8', label: '8. Others', labelHi: '8. अन्य', catchAll: true },
    { id: 'A8-11', label: '11. Profit and Loss Account (if balance is loss)', labelHi: '11. लाभ-हानि खाता (यदि हानि)', key: 'plLoss' },
  ] },
];

// Heads the builder handles through a computed line (never via mapping / catch-all).
const BS_COMPUTED_HEADS = new Set(['1208', '3312', '3313', '2211']);

// ── Annexure III — Profit & Loss Account ─────────────────────────────────────────────────────
export const CAS_PL_EXPENDITURE: CasSectionDef[] = [
  { id: 'E', label: 'Expenditure', labelHi: 'व्यय', lines: [
    { id: 'E1', label: '1. Gross loss transferred from Trading a/c', labelHi: '1. व्यापार खाते से सकल हानि', key: 'grossLoss' },
    { id: 'E2i', label: '2. Interest on i. Deposits', labelHi: '2. ब्याज — i. जमा पर' },
    { id: 'E2ii', label: 'ii. Borrowings from DCCB / SCB (incl. deposit interest booked here)', labelHi: 'ii. DCCB / SCB उधार पर (जमा-ब्याज सहित)', ids: ['5604'] },
    { id: 'E2iii', label: 'iii. Loans availed from State Government', labelHi: 'iii. राज्य सरकार के ऋण पर' },
    { id: 'E2iv', label: 'iv. Borrowings from others', labelHi: 'iv. अन्य उधार पर' },
    { id: 'E3i', label: '3.i Salary and Allowances (incl. PF, Bonus, Gratuity, Pension)', labelHi: '3.i वेतन एवं भत्ते (PF, बोनस, उपदान सहित)', ids: ['5201', '5202', '5203', '5204', '5205', '5206', '5207', '5208', '5209'], subtypes: ['employee_expense'] },
    { id: 'E3ii', label: '3.ii Management expenses', labelHi: '3.ii प्रबंधन व्यय (बैठकें)', ids: ['5310'] },
    { id: 'E4', label: '4. Rent, Taxes, Electricity and Repair of Premises', labelHi: '4. किराया, कर, बिजली व मरम्मत', ids: ['5308', '5302', '5602', '5402'] },
    { id: 'E5', label: '5. Insurance', labelHi: '5. बीमा', ids: ['5403'] },
    { id: 'E6', label: '6. Law charges', labelHi: '6. विधि व्यय', ids: ['5305'] },
    { id: 'E7', label: '7. Postage and telephone charges', labelHi: '7. डाक व टेलीफोन', ids: ['5304', '5313'] },
    { id: 'E8', label: '8. Printing and Stationery', labelHi: '8. छपाई व लेखन-सामग्री', ids: ['5303'] },
    { id: 'E9', label: '9. Audit Fees', labelHi: '9. लेखा-परीक्षा शुल्क', ids: ['5306'] },
    { id: 'E10', label: '10. Vehicle expenses', labelHi: '10. वाहन व्यय' },
    { id: 'E11', label: '11. Travelling & Conveyance', labelHi: '11. यात्रा व वाहन-भत्ता', ids: ['5309'] },
    { id: 'E12', label: '12. Donations and Subscriptions', labelHi: '12. दान व चंदा', ids: ['5405'] },
    { id: 'E13', label: '13. Depreciation on properties', labelHi: '13. संपत्तियों पर ह्रास', subtypes: ['depreciation_expense'] },
    { id: 'E14', label: '14. Other expenses', labelHi: '14. अन्य व्यय', catchAll: true },
    { id: 'E15', label: '15. Provisions (Standard / NPA / Bad debts / Overdue interest / Others)', labelHi: '15. प्रावधान (मानक / NPA / अशोध्य / अतिदेय ब्याज / अन्य)' },
    { id: 'E16', label: '16. Profit for the year', labelHi: '16. वर्ष का लाभ', key: 'profit' },
  ] },
];
export const CAS_PL_INCOME: CasSectionDef[] = [
  { id: 'I', label: 'Income', labelHi: 'आय', lines: [
    { id: 'I1', label: '1. Gross profit transferred from Trading a/c', labelHi: '1. व्यापार खाते से सकल लाभ', key: 'grossProfit' },
    { id: 'I2', label: '2. Interest on Loans and Advances (received and receivable)', labelHi: '2. ऋण एवं अग्रिम पर ब्याज (प्राप्त व प्राप्य)', ids: ['4408'] },
    { id: 'I3i', label: '3(i) Interest on Deposits with Banks / institutions', labelHi: '3(i) बैंकों में जमा पर ब्याज', ids: ['4403'] },
    { id: 'I3ii', label: '3(ii) Dividend on other investments', labelHi: '3(ii) निवेश पर लाभांश', ids: ['4404'] },
    { id: 'I4', label: '4. Rental Income', labelHi: '4. किराया आय' },
    { id: 'I5', label: '5. Admission Fees', labelHi: '5. प्रवेश शुल्क', ids: ['4407'] },
    { id: 'I6', label: '6. Miscellaneous Income', labelHi: '6. विविध आय', catchAll: true },
    { id: 'I7', label: '7. Loss for the Year', labelHi: '7. वर्ष की हानि', key: 'loss' },
  ] },
];

// ── Annexure II — Trading Account ────────────────────────────────────────────────────────────
export const CAS_TRADING_DR: CasSectionDef[] = [
  { id: 'TD', label: 'Debit', labelHi: 'नाम (Dr)', lines: [
    { id: 'TD1', label: '1. Opening Stocks', labelHi: '1. प्रारंभिक माल', key: 'openingStock' },
    { id: 'TD2i', label: '2. Purchases — (i) Fertilizers', labelHi: '2. क्रय — (i) उर्वरक', ids: ['5110'] },
    { id: 'TD2ii', label: '(ii) Seeds', labelHi: '(ii) बीज', ids: ['5111'] },
    { id: 'TD2iii', label: '(iii) Pesticides', labelHi: '(iii) कीटनाशक', ids: ['5113'] },
    { id: 'TD2iv', label: '(iv) PDS Commodities', labelHi: '(iv) PDS वस्तुएँ', ids: ['5115'] },
    { id: 'TD2v', label: '(v) Non PDS consumer items', labelHi: '(v) गैर-PDS उपभोक्ता वस्तुएँ', ids: ['5112', '5114'] },
    { id: 'TD2vi', label: '(vi) Foodgrains under Govt. Procurement Scheme', labelHi: '(vi) सरकारी खरीद योजना का अनाज', ids: ['5116'] },
    { id: 'TD2x', label: 'Purchases — not classified by category (5101)', labelHi: 'क्रय — श्रेणी-रहित (5101)', ids: ['5101'], key: 'purchaseGrossUp' },
    { id: 'TD2p', label: 'Purchases — goods procured directly into stock', labelHi: 'क्रय — सीधे स्टॉक में खरीदा माल', key: 'procuredToStock' },
    { id: 'TD11', label: '3–11. Transport, wages, godown and other trading expenses', labelHi: '3–11. ढुलाई, मज़दूरी, गोदाम व अन्य व्यापारिक व्यय', catchAll: true },
    { id: 'TD12', label: '12. Trading Gross Profit carried to P&L', labelHi: '12. सकल लाभ (लाभ-हानि खाते में)', key: 'grossProfit' },
  ] },
];
export const CAS_TRADING_CR: CasSectionDef[] = [
  { id: 'TC', label: 'Credit', labelHi: 'जमा (Cr)', lines: [
    { id: 'TC1i', label: '1. Sales — (i) Fertilizers', labelHi: '1. बिक्री — (i) उर्वरक', ids: ['4101'] },
    { id: 'TC1ii', label: '(ii) Seeds', labelHi: '(ii) बीज', ids: ['4102'] },
    { id: 'TC1iii', label: '(iii) Pesticides', labelHi: '(iii) कीटनाशक', ids: ['4104'] },
    { id: 'TC1iv', label: '(iv) PDS Commodities', labelHi: '(iv) PDS वस्तुएँ', ids: ['4107'] },
    { id: 'TC1v', label: '(v) Non PDS consumer items', labelHi: '(v) गैर-PDS उपभोक्ता वस्तुएँ', ids: ['4103', '4105', '4106'] },
    { id: 'TC1vi', label: '(vi) Foodgrains under Govt. Procurement Scheme', labelHi: '(vi) सरकारी खरीद योजना का अनाज', ids: ['4108'] },
    { id: 'TC5', label: '2–5. Commission, compensation, gunny bags, other trading income', labelHi: '2–5. कमीशन, क्षतिपूर्ति, बोरी व अन्य व्यापारिक आय', catchAll: true },
    { id: 'TC6', label: '6. Closing Stock', labelHi: '6. समापन माल', key: 'closingStock' },
    { id: 'TC7', label: '7. Trading Loss carried to P&L', labelHi: '7. व्यापारिक हानि (लाभ-हानि खाते में)', key: 'grossLoss' },
  ] },
];

// ── The mapping engine ───────────────────────────────────────────────────────────────────────
type Leaf = { id: string; name: string; subtype?: string; amount: number };

/** Assign each leaf to exactly one line: explicit id → subtype → the side's catch-all. */
function assign(sections: CasSectionDef[], leaves: Leaf[], computed: Record<string, number>): CasSection[] {
  const lines = sections.flatMap((s) => s.lines);
  const byId = new Map<string, CasLineDef>();
  for (const l of lines) for (const id of l.ids ?? []) byId.set(id, l);
  const catchAll = lines.find((l) => l.catchAll);
  const bucket = new Map<string, Leaf[]>();
  for (const leaf of leaves) {
    const line = byId.get(leaf.id) ?? lines.find((l) => leaf.subtype && l.subtypes?.includes(leaf.subtype)) ?? catchAll;
    if (!line) throw new Error(`CAS: no line for ${leaf.id} and no catch-all`);
    bucket.set(line.id, [...(bucket.get(line.id) ?? []), leaf]);
  }
  return sections.map((s) => {
    const rows: CasRow[] = s.lines.map(({ ids: _i, subtypes: _s, ...def }) => {
      // Zero-balance heads carry nothing — keep the audit trail to the heads that make up the figure.
      const heads = (bucket.get(def.id) ?? []).filter((l) => Math.abs(l.amount) >= 0.005).map((l) => ({ id: l.id, name: l.name, amount: r2(l.amount) }));
      const amount = r2(heads.reduce((t, h) => t + h.amount, 0) + (def.key ? computed[def.key] ?? 0 : 0));
      return { ...def, amount, heads };
    });
    return { id: s.id, label: s.label, labelHi: s.labelHi, rows, total: r2(rows.reduce((t, r) => t + r.amount, 0)) };
  });
}

const leafOf = (b: AccountBalance, amount: number): Leaf => ({ id: b.account.id, name: b.account.name, subtype: b.account.subtype, amount });
const sum = (xs: CasSection[]) => r2(xs.reduce((t, s) => t + s.total, 0));

export interface CasBalanceSheetInput {
  assetLeaves: readonly AccountBalance[];
  capLiabLeaves: readonly AccountBalance[];
  unpostedStock: number;
  netProfit: number;
  /** Σ over loans (incl. KCC) of the overdue part of their open accrued interest (loanInterestDue). */
  overdueInterestReceivable: number;
}
export interface CasBalanceSheet {
  liabilities: CasSection[];
  assets: CasSection[];
  totalLiabilities: number;
  totalAssets: number;
  /** The Overdue Interest Reserve moved from the liability side to "Less:" on the asset side (D2). */
  overdueInterestProvision: number;
}

export function buildCasBalanceSheet(input: CasBalanceSheetInput): CasBalanceSheet {
  const liabAmt = (b: AccountBalance) => -b.netBalance;       // Cr-side leaves → positive
  const assetAmt = (b: AccountBalance) => b.netBalance;       // Dr-side leaves → positive
  const cap = input.capLiabLeaves, ast = input.assetLeaves;
  const on = (xs: readonly AccountBalance[], id: string, f: (b: AccountBalance) => number) => xs.filter((b) => b.account.id === id).reduce((t, b) => t + f(b), 0);

  // P&L: 1208 (either side) + the current year's result.
  const pl = r2(on(cap, '1208', liabAmt) - on(ast, '1208', assetAmt) + input.netProfit);
  // Overdue Interest Reserve (2211) → "Less:" on the asset side (D2). A Dr-gone 2211 stays an asset.
  const oir = r2(on(cap, '2211', liabAmt));
  // Interest receivable (3313 + 3312) split into standard-accrued and overdue.
  const receivable = r2(on(ast, '3313', assetAmt) + on(ast, '3312', assetAmt));
  const overdue = r2(Math.max(0, Math.min(input.overdueInterestReceivable, receivable)));

  const liabilities = assign(CAS_BS_LIABILITIES,
    cap.filter((b) => !BS_COMPUTED_HEADS.has(b.account.id)).map((b) => leafOf(b, liabAmt(b))),
    { plProfit: pl > 0 ? pl : 0 });
  const assets = assign(CAS_BS_ASSETS,
    [...ast.filter((b) => !BS_COMPUTED_HEADS.has(b.account.id) || b.account.id === '2211').map((b) => leafOf(b, assetAmt(b)))],
    {
      closingStock: input.unpostedStock,
      interestAccruedStandard: r2(receivable - overdue),
      overdueInterestReceivable: overdue,
      overdueInterestProvision: -oir,
      plLoss: pl < 0 ? -pl : 0,
    });
  // A Cr-gone 3312/3313 (asset on the liability side) is unusual — keep it visible, never dropped.
  const strayReceivable = cap.filter((b) => b.account.id === '3312' || b.account.id === '3313');
  if (strayReceivable.length) {
    const others = liabilities.flatMap((s) => s.rows).find((r) => r.catchAll)!;
    for (const b of strayReceivable) { others.heads.push({ id: b.account.id, name: b.account.name, amount: r2(liabAmt(b)) }); others.amount = r2(others.amount + liabAmt(b)); }
    for (const s of liabilities) s.total = r2(s.rows.reduce((t, r) => t + r.amount, 0));
  }
  return { liabilities, assets, totalLiabilities: sum(liabilities), totalAssets: sum(assets), overdueInterestProvision: oir };
}

export interface CasProfitLoss { expenditure: CasSection[]; income: CasSection[]; total: number; netProfit: number }

/**
 * Same account filter as DataContext.getProfitLoss (trading heads 4100/5100 go to the Trading A/c
 * when the society trades; the gross result bridges in) — so netProfit ties exactly.
 */
export function buildCasProfitLoss(trialBalance: readonly AccountBalance[], opts: { hasTrading: boolean; grossProfit: number }): CasProfitLoss {
  const leaves = trialBalance.filter((b) => !b.account.isGroup && b.netBalance !== 0);
  const inc = leaves.filter((b) => b.account.type === 'income' && (!opts.hasTrading || b.account.parentId !== '4100')).map((b) => leafOf(b, -b.netBalance));
  const exp = leaves.filter((b) => b.account.type === 'expense' && (!opts.hasTrading || b.account.parentId !== '5100')).map((b) => leafOf(b, b.netBalance));
  const gp = opts.hasTrading ? r2(opts.grossProfit) : 0;
  const totalInc = r2(inc.reduce((t, l) => t + l.amount, 0) + Math.max(0, gp));
  const totalExp = r2(exp.reduce((t, l) => t + l.amount, 0) + Math.max(0, -gp));
  const net = r2(totalInc - totalExp);
  const expenditure = assign(CAS_PL_EXPENDITURE, exp, { grossLoss: Math.max(0, -gp), profit: Math.max(0, net) });
  const income = assign(CAS_PL_INCOME, inc, { grossProfit: Math.max(0, gp), loss: Math.max(0, -net) });
  return { expenditure, income, total: sum(income), netProfit: net };
}

export interface CasTrading { debit: CasSection[]; credit: CasSection[]; grossProfit: number; total: number }

/**
 * Trading A/c in the CAS layout. Stock figures AND the two purchase adjustments come from the
 * app's own Trading Account (RULE 2):
 *  - procuredToStock: goods bought straight into a 3400 stock head (Dr stock / Cr party) are a
 *    purchase — without them the closing stock has no matching cost and GP is overstated.
 *  - purchaseGrossUp: a LEGACY closing-stock journal credited 5101, so 5101 is shown gross.
 */
export function buildCasTrading(trialBalance: readonly AccountBalance[], opts: { openingStock: number; closingStock: number; procuredToStock?: number; purchaseGrossUp?: number }): CasTrading {
  const procured = r2(opts.procuredToStock ?? 0), grossUp = r2(opts.purchaseGrossUp ?? 0);
  const leaves = trialBalance.filter((b) => !b.account.isGroup && b.netBalance !== 0);
  const sales = leaves.filter((b) => b.account.parentId === '4100').map((b) => leafOf(b, -b.netBalance));
  // 5150 "Closing Stock (Trading A/c)" is the stock itself — carried by the closingStock figure.
  const dr = leaves.filter((b) => b.account.parentId === '5100' && b.account.id !== '5150').map((b) => leafOf(b, b.netBalance));
  const crSide = r2(sales.reduce((t, l) => t + l.amount, 0) + opts.closingStock);
  const drSide = r2(dr.reduce((t, l) => t + l.amount, 0) + opts.openingStock + procured + grossUp);
  const gp = r2(crSide - drSide);
  const debit = assign(CAS_TRADING_DR, dr, { openingStock: opts.openingStock, procuredToStock: procured, purchaseGrossUp: grossUp, grossProfit: Math.max(0, gp) });
  const credit = assign(CAS_TRADING_CR, sales, { closingStock: opts.closingStock, grossLoss: Math.max(0, -gp) });
  return { debit, credit, grossProfit: gp, total: sum(credit) };
}

/**
 * Does the CAS Balance Sheet tie to the app's own? It must (a) balance, and (b) equal the app's
 * asset total after the three CAS presentation moves: the Overdue Interest Reserve becomes a
 * deduction on the asset side, a Dr-gone 1208 leaves the asset leaves, and a loss shows as
 * "P&L (if loss)". Anything else ⇒ a head was dropped or double-counted.
 */
export function casBalanceSheetTies(bs: CasBalanceSheet, app: { assetLeaves: readonly AccountBalance[]; totalAssets: number }): boolean {
  const ast1208 = app.assetLeaves.filter((b) => b.account.id === '1208').reduce((t, b) => t + b.netBalance, 0);
  const plLoss = bs.assets.flatMap((s) => s.rows).find((r) => r.id === 'A8-11')?.amount ?? 0;
  const expected = r2(app.totalAssets - bs.overdueInterestProvision - ast1208 + plLoss);
  return Math.abs(bs.totalAssets - expected) < 0.01 && Math.abs(bs.totalAssets - bs.totalLiabilities) < 0.01;
}

// ── Annexure I — Trial Balance (monthly) ─────────────────────────────────────────────────────
// "LIABILITIES & INCOME" and "ASSETS & EXPENDITURE", each head with: opening balance at the
// beginning of the month, total debit and total credit during the month, closing balance
// (liabilities & income: 3 + 5 − 4; assets & expenditure: 3 + 4 − 5). Heads are grouped by the
// SAME CAS lines the statements use; a few heads have their own CAS GL line in the TB.
export interface CasTbRow { id: string; label: string; labelHi: string; opening: number; debit: number; credit: number; closing: number; heads: { id: string; name: string }[] }
export interface CasTrialBalance { liabilitiesIncome: CasTbRow[]; assetsExpenditure: CasTbRow[]; totals: { liabilitiesIncome: number; assetsExpenditure: number } }

const TB_OWN_LINES: Record<string, { id: string; label: string; labelHi: string }> = {
  '1208': { id: 'TB-PL', label: 'Balance in Profit and Loss Account', labelHi: 'लाभ-हानि खाते का शेष' },
  '2211': { id: 'TB-OIR', label: 'Overdue Interest Reserve', labelHi: 'अतिदेय ब्याज संचय' },
  '3312': { id: 'TB-INT', label: 'Interest accrued / overdue interest receivable on loans', labelHi: 'ऋणों पर उपार्जित / अतिदेय प्राप्य ब्याज' },
  '3313': { id: 'TB-INT', label: 'Interest accrued / overdue interest receivable on loans', labelHi: 'ऋणों पर उपार्जित / अतिदेय प्राप्य ब्याज' },
  '5150': { id: 'TB-CS', label: 'Closing Stock (Trading A/c)', labelHi: 'समापन माल (व्यापार खाता)' },
};

/** Which CAS line a head belongs to, by its NATURAL side (the TB is not sign-reclassified). */
function lineFor(a: { id: string; subtype?: string; type: string; parentId?: string }, hasTrading: boolean): { id: string; label: string; labelHi: string } {
  if (TB_OWN_LINES[a.id]) return TB_OWN_LINES[a.id];
  const pick = (defs: CasSectionDef[]) => {
    const lines = defs.flatMap((s) => s.lines);
    return lines.find((l) => l.ids?.includes(a.id)) ?? lines.find((l) => a.subtype && l.subtypes?.includes(a.subtype)) ?? lines.find((l) => l.catchAll)!;
  };
  const defs = a.type === 'asset' ? CAS_BS_ASSETS
    : a.type === 'liability' || a.type === 'equity' ? CAS_BS_LIABILITIES
    : a.type === 'income' ? (hasTrading && a.parentId === '4100' ? CAS_TRADING_CR : CAS_PL_INCOME)
    : (hasTrading && a.parentId === '5100' ? CAS_TRADING_DR : CAS_PL_EXPENDITURE);
  const l = pick(defs);
  return { id: l.id, label: l.label, labelHi: l.labelHi };
}

/**
 * @param atMonthEnd  trial balance as on the last day of the month
 * @param atPrevEnd   trial balance as on the day before the month starts
 */
export function buildCasTrialBalance(atMonthEnd: readonly AccountBalance[], atPrevEnd: readonly AccountBalance[], opts: { hasTrading: boolean }): CasTrialBalance {
  const prev = new Map(atPrevEnd.map((b) => [b.account.id, b]));
  const rows = new Map<string, CasTbRow & { credSide: boolean }>();
  for (const b of atMonthEnd) {
    if (b.account.isGroup) continue;
    const p = prev.get(b.account.id);
    const debit = r2((b.transactionDebit ?? 0) - (p?.transactionDebit ?? 0));
    const credit = r2((b.transactionCredit ?? 0) - (p?.transactionCredit ?? 0));
    const credSide = ['liability', 'equity', 'income'].includes(b.account.type);
    const openingNet = p ? p.netBalance : r2((b.openingDebit ?? 0) - (b.openingCredit ?? 0));
    if (Math.abs(openingNet) < 0.005 && Math.abs(debit) < 0.005 && Math.abs(credit) < 0.005 && Math.abs(b.netBalance) < 0.005) continue;
    const line = lineFor(b.account, opts.hasTrading);
    const key = `${credSide ? 'C' : 'D'}:${line.id}`;
    const row = rows.get(key) ?? { ...line, opening: 0, debit: 0, credit: 0, closing: 0, heads: [], credSide };
    row.opening = r2(row.opening + (credSide ? -openingNet : openingNet));
    row.debit = r2(row.debit + debit);
    row.credit = r2(row.credit + credit);
    row.closing = r2(credSide ? row.opening + row.credit - row.debit : row.opening + row.debit - row.credit);
    row.heads.push({ id: b.account.id, name: b.account.name });
    rows.set(key, row);
  }
  const strip = ({ credSide: _c, ...r }: CasTbRow & { credSide: boolean }): CasTbRow => r;
  const all = [...rows.values()];
  const liabilitiesIncome = all.filter((r) => r.credSide).map(strip);
  const assetsExpenditure = all.filter((r) => !r.credSide).map(strip);
  return {
    liabilitiesIncome, assetsExpenditure,
    totals: {
      liabilitiesIncome: r2(liabilitiesIncome.reduce((t, r) => t + r.closing, 0)),
      assetsExpenditure: r2(assetsExpenditure.reduce((t, r) => t + r.closing, 0)),
    },
  };
}
