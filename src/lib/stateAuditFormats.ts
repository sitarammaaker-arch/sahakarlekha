/**
 * B-2: State-wise Audit Formats
 *
 * Data-driven configuration for state-specific cooperative audit schedules.
 * Each Indian state prescribes its own audit format under its Cooperative
 * Societies Act. This module defines schedule templates, account mappings,
 * and a resolver engine that computes amounts from the trial balance.
 *
 * Adding a new state: define a StateAuditFormat constant and register it
 * in STATE_AUDIT_FORMATS. Zero UI code changes required.
 */

import type { LedgerAccount, AccountBalance } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

/** How a schedule line item resolves its monetary amount */
export type LineItemSource =
  | { kind: 'account'; accountIds: string[] }
  | { kind: 'subtype'; subtypes: string[] }
  | { kind: 'parentGroup'; parentIds: string[] }
  | { kind: 'computed'; key: string }
  | { kind: 'members' }
  | { kind: 'assetDepreciation' };

export interface ScheduleLineItem {
  id: string;
  label: string;
  labelHi: string;
  source: LineItemSource;
  indent?: number;       // 0 = root, 1 = sub-item, 2 = sub-sub
  bold?: boolean;
  isTotal?: boolean;
  note?: string;         // Statutory section reference (e.g., "Sec 65")
}

export type SpecialRenderer = 'depreciation' | 'trading';

export interface ScheduleDefinition {
  id: string;            // e.g., 'sch-I', 'sch-II'
  name: string;
  nameHi: string;
  shortName: string;     // Tab label e.g., "I", "II"
  lineItems: ScheduleLineItem[];
  specialRenderer?: SpecialRenderer;
}

export interface StateAuditFormat {
  stateCode: string;     // Matches INDIAN_STATES value (e.g., 'hr', 'mh')
  actName: string;
  actNameHi: string;
  actYear: number;
  schedules: ScheduleDefinition[];
  reservePct: number;          // Statutory Reserve Fund % (default 25)
  educationFundPct: number;    // Education Fund %
  coopDevFundPct: number;      // Cooperative Development Fund %
  auditFormNumber?: string;    // State form number (e.g., "Form-S")
}

export interface ResolvedLineItem extends ScheduleLineItem {
  currentYear: number;
  previousYear: number;
}

export interface ResolvedSchedule extends Omit<ScheduleDefinition, 'lineItems'> {
  items: ResolvedLineItem[];
}

/** Context required to resolve schedule amounts */
export interface ResolverContext {
  trialBalance: AccountBalance[];
  accounts: LedgerAccount[];
  previousYearBalances: Record<string, number>;
  netProfit: number;
  grossProfit: number;
  reserveFundPct: number;
  totalIncome: number;
  totalExpenses: number;
  totalMembers: number;
  activeMembers: number;
  totalShareCapital: number;
}

// ── Resolver Engine ─────────────────────────────────────────────────────────

function getAccountBalance(
  accountIds: string[],
  trialBalance: AccountBalance[],
  signFlip: boolean = false,
): number {
  return trialBalance
    .filter(b => accountIds.includes(b.account.id) && !b.account.isGroup)
    .reduce((sum, b) => sum + (signFlip ? -b.netBalance : b.netBalance), 0);
}

function getSubtypeBalance(
  subtypes: string[],
  trialBalance: AccountBalance[],
  signFlip: boolean = false,
): number {
  return trialBalance
    .filter(b => !b.account.isGroup && subtypes.includes(b.account.subtype || ''))
    .reduce((sum, b) => sum + (signFlip ? -b.netBalance : b.netBalance), 0);
}

function getParentGroupBalance(
  parentIds: string[],
  trialBalance: AccountBalance[],
  signFlip: boolean = false,
): number {
  return trialBalance
    .filter(b => !b.account.isGroup && parentIds.includes(b.account.parentId || ''))
    .reduce((sum, b) => sum + (signFlip ? -b.netBalance : b.netBalance), 0);
}

function getPreviousYearForSource(
  source: LineItemSource,
  accounts: LedgerAccount[],
  pyBalances: Record<string, number>,
): number {
  if (source.kind === 'computed' || source.kind === 'members' || source.kind === 'assetDepreciation') return 0;

  let ids: string[] = [];
  if (source.kind === 'account') {
    ids = source.accountIds;
  } else if (source.kind === 'subtype') {
    ids = accounts.filter(a => !a.isGroup && source.subtypes.includes(a.subtype || '')).map(a => a.id);
  } else if (source.kind === 'parentGroup') {
    ids = accounts.filter(a => !a.isGroup && source.parentIds.includes(a.parentId || '')).map(a => a.id);
  }

  return ids.reduce((sum, id) => sum + (pyBalances[id] ?? 0), 0);
}

/** Resolve amounts for a single line item */
function resolveLineItem(
  item: ScheduleLineItem,
  ctx: ResolverContext,
): ResolvedLineItem {
  let currentYear = 0;
  const previousYear = getPreviousYearForSource(item.source, ctx.accounts, ctx.previousYearBalances);

  const src = item.source;

  // For equity/liability/income accounts, netBalance is negative for normal credit balances.
  // We flip sign so positive = normal balance (matching BalanceSheet.tsx convention).
  const isCredSide = (ids: string[]): boolean => {
    const accs = ctx.accounts.filter(a => ids.includes(a.id));
    return accs.length > 0 && ['equity', 'liability', 'income'].includes(accs[0]?.type || '');
  };

  switch (src.kind) {
    case 'account': {
      const flip = isCredSide(src.accountIds);
      currentYear = getAccountBalance(src.accountIds, ctx.trialBalance, flip);
      break;
    }
    case 'subtype': {
      // Determine side from first matching account's type
      const sample = ctx.trialBalance.find(b => !b.account.isGroup && src.subtypes.includes(b.account.subtype || ''));
      const flip = sample ? ['equity', 'liability', 'income'].includes(sample.account.type) : false;
      currentYear = getSubtypeBalance(src.subtypes, ctx.trialBalance, flip);
      break;
    }
    case 'parentGroup': {
      const sample = ctx.trialBalance.find(b => !b.account.isGroup && src.parentIds.includes(b.account.parentId || ''));
      const flip = sample ? ['equity', 'liability', 'income'].includes(sample.account.type) : false;
      currentYear = getParentGroupBalance(src.parentIds, ctx.trialBalance, flip);
      break;
    }
    case 'computed':
      switch (src.key) {
        case 'netProfit':        currentYear = ctx.netProfit; break;
        case 'grossProfit':      currentYear = ctx.grossProfit; break;
        case 'reserveFund':      currentYear = ctx.netProfit > 0 ? ctx.netProfit * (ctx.reserveFundPct / 100) : 0; break;
        case 'educationFund':    currentYear = ctx.netProfit > 0 ? ctx.netProfit * 0.01 : 0; break;
        case 'coopDevFund':      currentYear = ctx.netProfit > 0 ? ctx.netProfit * 0.03 : 0; break;
        case 'distribSurplus':   currentYear = ctx.netProfit > 0 ? ctx.netProfit - (ctx.netProfit * (ctx.reserveFundPct / 100)) : 0; break;
        case 'totalIncome':      currentYear = ctx.totalIncome; break;
        case 'totalExpenses':    currentYear = ctx.totalExpenses; break;
        default: currentYear = 0;
      }
      break;
    case 'members':
      currentYear = ctx.activeMembers;
      break;
    case 'assetDepreciation':
      // Handled by special renderer in UI
      currentYear = 0;
      break;
  }

  return { ...item, currentYear, previousYear };
}

/** Resolve all schedules for a state format */
export function resolveAllSchedules(
  format: StateAuditFormat,
  ctx: ResolverContext,
): ResolvedSchedule[] {
  return format.schedules.map(schedule => ({
    ...schedule,
    lineItems: undefined as any,
    items: schedule.lineItems.map(item => resolveLineItem(item, ctx)),
  }));
}

// ── Haryana ─────────────────────────────────────────────────────────────────
// Haryana Cooperative Societies Act, 1984 (Sec 63–68)

const HARYANA_SCHEDULES: ScheduleDefinition[] = [
  // Schedule I: Share Capital
  {
    id: 'sch-I', name: 'Schedule I — Share Capital', nameHi: 'अनुसूची I — शेयर पूंजी', shortName: 'I',
    lineItems: [
      { id: 'I-1', label: 'Government Share Capital', labelHi: 'सरकारी शेयर पूंजी', source: { kind: 'account', accountIds: ['1101'] }, indent: 0 },
      { id: 'I-2', label: 'Individual Member Share Capital', labelHi: 'व्यक्तिगत सदस्य शेयर पूंजी', source: { kind: 'account', accountIds: ['1102'] }, indent: 0 },
      { id: 'I-3', label: 'PACS / Institutional Share Capital', labelHi: 'संस्थागत शेयर पूंजी', source: { kind: 'account', accountIds: ['1103'] }, indent: 0 },
      { id: 'I-4', label: 'Admission Fee (Capital Receipt)', labelHi: 'प्रवेश शुल्क (पूंजी प्राप्ति)', source: { kind: 'account', accountIds: ['4407'] }, indent: 0 },
      { id: 'I-T', label: 'Total Share Capital', labelHi: 'कुल शेयर पूंजी', source: { kind: 'parentGroup', parentIds: ['1100'] }, bold: true, isTotal: true },
    ],
  },
  // Schedule II: Reserves & Surplus
  {
    id: 'sch-II', name: 'Schedule II — Reserves & Surplus', nameHi: 'अनुसूची II — संचय एवं अधिशेष', shortName: 'II',
    lineItems: [
      { id: 'II-1', label: 'Statutory Reserve Fund', labelHi: 'वैधानिक संचय निधि', source: { kind: 'account', accountIds: ['1201'] }, indent: 0, note: 'Sec 65' },
      { id: 'II-2', label: 'Building Fund', labelHi: 'भवन निधि', source: { kind: 'account', accountIds: ['1202'] }, indent: 0 },
      { id: 'II-3', label: 'Education Fund', labelHi: 'शिक्षा निधि', source: { kind: 'account', accountIds: ['1203'] }, indent: 0, note: 'Sec 65(2)' },
      { id: 'II-4', label: 'Risk Fund', labelHi: 'जोखिम निधि', source: { kind: 'account', accountIds: ['1204'] }, indent: 0 },
      { id: 'II-5', label: 'Bad Debt Fund', labelHi: 'अशोध्य ऋण निधि', source: { kind: 'account', accountIds: ['1205'] }, indent: 0 },
      { id: 'II-6', label: 'Depreciation Fund', labelHi: 'ह्रास निधि', source: { kind: 'account', accountIds: ['1206'] }, indent: 0 },
      { id: 'II-7', label: 'Welfare Fund', labelHi: 'कल्याण निधि', source: { kind: 'account', accountIds: ['1207'] }, indent: 0 },
      { id: 'II-8', label: 'Price Stabilization Fund', labelHi: 'मूल्य स्थिरता निधि', source: { kind: 'account', accountIds: ['1209'] }, indent: 0 },
      { id: 'II-9', label: 'Social / Cooperative Dev Fund', labelHi: 'सहकारी विकास निधि', source: { kind: 'account', accountIds: ['1210'] }, indent: 0, note: 'Sec 65(3)' },
      { id: 'II-10', label: 'Dividend Distribution (Contra)', labelHi: 'लाभांश वितरण (विपरीत)', source: { kind: 'account', accountIds: ['1211'] }, indent: 0 },
      { id: 'II-11', label: 'Net Surplus / (Deficit) b/f', labelHi: 'शुद्ध अधिशेष / (घाटा) आ.शे.', source: { kind: 'account', accountIds: ['1208'] }, indent: 0 },
      { id: 'II-12', label: 'Current Year Surplus / (Deficit)', labelHi: 'चालू वर्ष अधिशेष / (घाटा)', source: { kind: 'computed', key: 'netProfit' }, indent: 0, bold: true },
      { id: 'II-T', label: 'Total Reserves & Surplus', labelHi: 'कुल संचय एवं अधिशेष', source: { kind: 'parentGroup', parentIds: ['1200'] }, bold: true, isTotal: true },
    ],
  },
  // Schedule III: Borrowings
  {
    id: 'sch-III', name: 'Schedule III — Borrowings', nameHi: 'अनुसूची III — उधार', shortName: 'III',
    lineItems: [
      { id: 'III-1', label: 'Bank Overdraft', labelHi: 'बैंक अधिविकर्ष', source: { kind: 'account', accountIds: ['2301'] }, indent: 0 },
      { id: 'III-2', label: 'Secured Loan', labelHi: 'सुरक्षित ऋण', source: { kind: 'account', accountIds: ['2302'] }, indent: 0 },
      { id: 'III-3', label: 'Unsecured Loan', labelHi: 'असुरक्षित ऋण', source: { kind: 'account', accountIds: ['2303'] }, indent: 0 },
      { id: 'III-4', label: 'Loan from DCCB / NABARD', labelHi: 'DCCB / नाबार्ड से ऋण', source: { kind: 'account', accountIds: ['2304'] }, indent: 0 },
      { id: 'III-5', label: 'KCC / Crop Loan (DCCB)', labelHi: 'KCC / फसल ऋण (DCCB)', source: { kind: 'account', accountIds: ['2305'] }, indent: 0 },
      { id: 'III-T', label: 'Total Borrowings', labelHi: 'कुल उधार', source: { kind: 'parentGroup', parentIds: ['2300'] }, bold: true, isTotal: true },
    ],
  },
  // Schedule IV: Fixed Assets & Depreciation
  {
    id: 'sch-IV', name: 'Schedule IV — Fixed Assets & Depreciation', nameHi: 'अनुसूची IV — स्थायी संपत्ति एवं ह्रास', shortName: 'IV',
    specialRenderer: 'depreciation',
    lineItems: [
      { id: 'IV-1', label: 'Land', labelHi: 'भूमि', source: { kind: 'account', accountIds: ['3101'] }, indent: 0 },
      { id: 'IV-2', label: 'Building', labelHi: 'भवन', source: { kind: 'account', accountIds: ['3102'] }, indent: 0 },
      { id: 'IV-3', label: 'Furniture & Fixtures', labelHi: 'फर्नीचर एवं जुड़नार', source: { kind: 'account', accountIds: ['3103'] }, indent: 0 },
      { id: 'IV-4', label: 'Vehicle', labelHi: 'वाहन', source: { kind: 'account', accountIds: ['3104'] }, indent: 0 },
      { id: 'IV-5', label: 'Plant & Machinery', labelHi: 'संयंत्र एवं मशीनरी', source: { kind: 'account', accountIds: ['3105'] }, indent: 0 },
      { id: 'IV-6', label: 'Office Equipment', labelHi: 'कार्यालय उपकरण', source: { kind: 'account', accountIds: ['3106'] }, indent: 0 },
      { id: 'IV-7', label: 'Computer / IT Equipment', labelHi: 'कंप्यूटर / IT उपकरण', source: { kind: 'account', accountIds: ['3107'] }, indent: 0 },
      { id: 'IV-T', label: 'Total Fixed Assets (Net)', labelHi: 'कुल स्थायी संपत्ति (शुद्ध)', source: { kind: 'subtype', subtypes: ['fixed_asset'] }, bold: true, isTotal: true },
    ],
  },
  // Schedule V: Investments
  {
    id: 'sch-V', name: 'Schedule V — Investments', nameHi: 'अनुसूची V — निवेश', shortName: 'V',
    lineItems: [
      { id: 'V-1', label: 'Hafed Share', labelHi: 'हैफेड शेयर', source: { kind: 'account', accountIds: ['3201'] }, indent: 0 },
      { id: 'V-2', label: 'IFFCO Share', labelHi: 'इफको शेयर', source: { kind: 'account', accountIds: ['3202'] }, indent: 0 },
      { id: 'V-3', label: 'KRIBHCO Share', labelHi: 'कृभको शेयर', source: { kind: 'account', accountIds: ['3203'] }, indent: 0 },
      { id: 'V-4', label: 'NCEL / NCOL Shares', labelHi: 'NCEL / NCOL शेयर', source: { kind: 'account', accountIds: ['3204'] }, indent: 0 },
      { id: 'V-5', label: 'Fixed Deposits (FDR)', labelHi: 'सावधि जमा (FDR)', source: { kind: 'account', accountIds: ['3205'] }, indent: 0 },
      { id: 'V-6', label: 'Security Deposits', labelHi: 'सुरक्षा जमा', source: { kind: 'account', accountIds: ['3206'] }, indent: 0 },
      { id: 'V-7', label: 'NSC / Post Office Deposits', labelHi: 'NSC / डाकघर जमा', source: { kind: 'account', accountIds: ['3207'] }, indent: 0 },
      { id: 'V-8', label: 'Cooperative Society Shares', labelHi: 'सहकारी समिति शेयर', source: { kind: 'account', accountIds: ['3208'] }, indent: 0 },
      { id: 'V-T', label: 'Total Investments', labelHi: 'कुल निवेश', source: { kind: 'subtype', subtypes: ['investment'] }, bold: true, isTotal: true },
    ],
  },
  // Schedule VI: Current Assets, Loans & Advances
  {
    id: 'sch-VI', name: 'Schedule VI — Current Assets, Loans & Advances', nameHi: 'अनुसूची VI — चालू संपत्ति, ऋण एवं अग्रिम', shortName: 'VI',
    lineItems: [
      { id: 'VI-1', label: 'Cash in Hand', labelHi: 'हाथ में नकद', source: { kind: 'account', accountIds: ['3301'] }, indent: 0 },
      { id: 'VI-2', label: 'Bank Accounts', labelHi: 'बैंक खाते', source: { kind: 'account', accountIds: ['3302'] }, indent: 0 },
      { id: 'VI-3', label: 'Sundry Debtors', labelHi: 'विविध देनदार', source: { kind: 'account', accountIds: ['3303'] }, indent: 0 },
      { id: 'VI-4', label: 'Loans & Advances', labelHi: 'ऋण एवं अग्रिम', source: { kind: 'account', accountIds: ['3304'] }, indent: 0 },
      { id: 'VI-5', label: 'Subsidy Receivable', labelHi: 'प्राप्य अनुदान', source: { kind: 'account', accountIds: ['3305'] }, indent: 0 },
      { id: 'VI-6', label: 'Rent Receivable', labelHi: 'प्राप्य किराया', source: { kind: 'account', accountIds: ['3306'] }, indent: 0 },
      { id: 'VI-7', label: 'TDS Receivable', labelHi: 'प्राप्य TDS', source: { kind: 'account', accountIds: ['3307'] }, indent: 0 },
      { id: 'VI-8', label: 'MSP Receivable', labelHi: 'प्राप्य MSP', source: { kind: 'account', accountIds: ['3308'] }, indent: 0 },
      { id: 'VI-9', label: 'Member Receivable', labelHi: 'सदस्य प्राप्य', source: { kind: 'account', accountIds: ['3309'] }, indent: 0 },
      { id: 'VI-10', label: 'GST Input Credit (ITC)', labelHi: 'GST इनपुट क्रेडिट (ITC)', source: { kind: 'account', accountIds: ['3310'] }, indent: 0 },
      { id: 'VI-11', label: 'Prepaid Expenses', labelHi: 'अग्रिम व्यय', source: { kind: 'account', accountIds: ['3311'] }, indent: 0 },
      { id: 'VI-12', label: 'Interest Receivable', labelHi: 'प्राप्य ब्याज', source: { kind: 'account', accountIds: ['3312'] }, indent: 0 },
      { id: 'VI-13', label: 'Member Loan Interest Receivable', labelHi: 'सदस्य ऋण ब्याज प्राप्य', source: { kind: 'account', accountIds: ['3313'] }, indent: 0 },
      { id: 'VI-14', label: 'Commission Receivable', labelHi: 'प्राप्य कमीशन', source: { kind: 'account', accountIds: ['3314'] }, indent: 0 },
      { id: 'VI-15', label: 'Advance to Employees', labelHi: 'कर्मचारियों को अग्रिम', source: { kind: 'account', accountIds: ['3315'] }, indent: 0 },
      { id: 'VI-16', label: 'Stock in Transit', labelHi: 'पारगमन में माल', source: { kind: 'account', accountIds: ['3316'] }, indent: 0 },
      { id: 'VI-T', label: 'Total Current Assets', labelHi: 'कुल चालू संपत्ति', source: { kind: 'subtype', subtypes: ['cash_bank', 'current_asset'] }, bold: true, isTotal: true },
    ],
  },
  // Schedule VII: Current Liabilities & Provisions
  {
    id: 'sch-VII', name: 'Schedule VII — Current Liabilities & Provisions', nameHi: 'अनुसूची VII — चालू दायित्व एवं प्रावधान', shortName: 'VII',
    lineItems: [
      { id: 'VII-1', label: 'Sundry Creditors', labelHi: 'विविध लेनदार', source: { kind: 'account', accountIds: ['2101'] }, indent: 0 },
      { id: 'VII-2', label: 'Expenses Payable', labelHi: 'देय व्यय', source: { kind: 'account', accountIds: ['2102'] }, indent: 0 },
      { id: 'VII-3', label: 'Salary Payable', labelHi: 'देय वेतन', source: { kind: 'account', accountIds: ['2103'] }, indent: 0 },
      { id: 'VII-4', label: 'Dividend Payable', labelHi: 'देय लाभांश', source: { kind: 'account', accountIds: ['2104'] }, indent: 0 },
      { id: 'VII-5', label: 'MSP Payable to Farmers', labelHi: 'किसानों को देय MSP', source: { kind: 'account', accountIds: ['2105'] }, indent: 0 },
      { id: 'VII-6', label: 'Member Payable', labelHi: 'सदस्य देय', source: { kind: 'account', accountIds: ['2106'] }, indent: 0 },
      { id: 'VII-7', label: 'Member Deposits', labelHi: 'सदस्य जमाराशि', source: { kind: 'account', accountIds: ['2107'] }, indent: 0 },
      { id: 'VII-8', label: 'Interest Payable', labelHi: 'देय ब्याज', source: { kind: 'account', accountIds: ['2208'] }, indent: 0 },
      { id: 'VII-9', label: 'Audit Fee Payable', labelHi: 'देय लेखा परीक्षण शुल्क', source: { kind: 'account', accountIds: ['2209'] }, indent: 0 },
      { id: 'VII-10', label: 'Advance from Members', labelHi: 'सदस्यों से अग्रिम', source: { kind: 'account', accountIds: ['2210'] }, indent: 0 },
      { id: 'VII-11', label: 'GST Payable', labelHi: 'देय GST', source: { kind: 'account', accountIds: ['2201'] }, indent: 0 },
      { id: 'VII-12', label: 'TDS Payable', labelHi: 'देय TDS', source: { kind: 'account', accountIds: ['2202'] }, indent: 0 },
      { id: 'VII-13', label: 'EPF Payable', labelHi: 'देय EPF', source: { kind: 'account', accountIds: ['2203'] }, indent: 0 },
      { id: 'VII-14', label: 'ESI Payable', labelHi: 'देय ESI', source: { kind: 'account', accountIds: ['2204'] }, indent: 0 },
      { id: 'VII-15', label: 'Income Tax Payable', labelHi: 'देय आयकर', source: { kind: 'account', accountIds: ['2206'] }, indent: 0 },
      { id: 'VII-T', label: 'Total Current Liabilities', labelHi: 'कुल चालू दायित्व', source: { kind: 'subtype', subtypes: ['current_liability', 'statutory_liability', 'deposit'] }, bold: true, isTotal: true },
    ],
  },
  // Schedule VIII: Income Details
  {
    id: 'sch-VIII', name: 'Schedule VIII — Income Details', nameHi: 'अनुसूची VIII — आय विवरण', shortName: 'VIII',
    lineItems: [
      { id: 'VIII-h1', label: 'A. Trading Income', labelHi: 'क. व्यापारिक आय', source: { kind: 'subtype', subtypes: ['trading_income'] }, indent: 0, bold: true },
      { id: 'VIII-h2', label: 'B. Commission & Service Income', labelHi: 'ख. कमीशन एवं सेवा आय', source: { kind: 'subtype', subtypes: ['commission_income'] }, indent: 0, bold: true },
      { id: 'VIII-h3', label: 'C. Scheme Income (Govt.)', labelHi: 'ग. योजना आय (सरकारी)', source: { kind: 'subtype', subtypes: ['scheme_income'] }, indent: 0, bold: true },
      { id: 'VIII-h4', label: 'D. Other Income', labelHi: 'घ. अन्य आय', source: { kind: 'subtype', subtypes: ['other_income'] }, indent: 0, bold: true },
      { id: 'VIII-T', label: 'Total Income', labelHi: 'कुल आय', source: { kind: 'computed', key: 'totalIncome' }, bold: true, isTotal: true },
    ],
  },
  // Schedule IX: Expenditure Details
  {
    id: 'sch-IX', name: 'Schedule IX — Expenditure Details', nameHi: 'अनुसूची IX — व्यय विवरण', shortName: 'IX',
    lineItems: [
      { id: 'IX-h1', label: 'A. Direct / Trading Expenses', labelHi: 'क. प्रत्यक्ष / व्यापारिक व्यय', source: { kind: 'subtype', subtypes: ['direct_expense'] }, indent: 0, bold: true },
      { id: 'IX-h2', label: 'B. Employee Expenses', labelHi: 'ख. कर्मचारी व्यय', source: { kind: 'subtype', subtypes: ['employee_expense'] }, indent: 0, bold: true },
      { id: 'IX-h3', label: 'C. Administrative Expenses', labelHi: 'ग. प्रशासनिक व्यय', source: { kind: 'subtype', subtypes: ['admin_expense'] }, indent: 0, bold: true },
      { id: 'IX-h4', label: 'D. Operational Expenses', labelHi: 'घ. परिचालन व्यय', source: { kind: 'subtype', subtypes: ['operational_expense'] }, indent: 0, bold: true },
      { id: 'IX-h5', label: 'E. Depreciation', labelHi: 'ड. ह्रास', source: { kind: 'subtype', subtypes: ['depreciation_expense'] }, indent: 0, bold: true },
      { id: 'IX-h6', label: 'F. Statutory / Financial Expenses', labelHi: 'च. वैधानिक / वित्तीय व्यय', source: { kind: 'subtype', subtypes: ['statutory_expense'] }, indent: 0, bold: true },
      { id: 'IX-T', label: 'Total Expenditure', labelHi: 'कुल व्यय', source: { kind: 'computed', key: 'totalExpenses' }, bold: true, isTotal: true },
    ],
  },
  // Schedule X: Trading Account
  {
    id: 'sch-X', name: 'Schedule X — Trading Account', nameHi: 'अनुसूची X — व्यापार खाता', shortName: 'X',
    specialRenderer: 'trading',
    lineItems: [
      { id: 'X-1', label: 'Total Sales', labelHi: 'कुल बिक्री', source: { kind: 'subtype', subtypes: ['trading_income'] }, indent: 0 },
      { id: 'X-2', label: 'Total Purchases', labelHi: 'कुल क्रय', source: { kind: 'subtype', subtypes: ['direct_expense'] }, indent: 0 },
      { id: 'X-3', label: 'Gross Profit / (Loss)', labelHi: 'सकल लाभ / (हानि)', source: { kind: 'computed', key: 'grossProfit' }, indent: 0, bold: true },
      { id: 'X-T', label: 'Net Profit / (Loss)', labelHi: 'शुद्ध लाभ / (हानि)', source: { kind: 'computed', key: 'netProfit' }, bold: true, isTotal: true },
    ],
  },
];

export const HARYANA_FORMAT: StateAuditFormat = {
  stateCode: 'hr',
  actName: 'Haryana Cooperative Societies Act, 1984',
  actNameHi: 'हरियाणा सहकारी समिति अधिनियम, 1984',
  actYear: 1984,
  schedules: HARYANA_SCHEDULES,
  reservePct: 25,
  educationFundPct: 1,
  coopDevFundPct: 3,
};

// ── Maharashtra ─────────────────────────────────────────────────────────────
// Maharashtra Cooperative Societies Act, 1960 (Sec 63–66)

export const MAHARASHTRA_FORMAT: StateAuditFormat = {
  stateCode: 'mh',
  actName: 'Maharashtra Cooperative Societies Act, 1960',
  actNameHi: 'महाराष्ट्र सहकारी समिति अधिनियम, 1960',
  actYear: 1960,
  auditFormNumber: 'Form-S',
  schedules: HARYANA_SCHEDULES.map(s => ({
    ...s,
    name: s.name.replace('Schedule', 'Annexure'),
    nameHi: s.nameHi.replace('अनुसूची', 'परिशिष्ट'),
  })),
  reservePct: 25,
  educationFundPct: 1,
  coopDevFundPct: 3,
};

// ── Gujarat ──────────────────────────────────────────────────────────────────
// Gujarat Cooperative Societies Act, 1961 (Sec 67–70)

export const GUJARAT_FORMAT: StateAuditFormat = {
  stateCode: 'gj',
  actName: 'Gujarat Cooperative Societies Act, 1961',
  actNameHi: 'गुजरात सहकारी समिति अधिनियम, 1961',
  actYear: 1961,
  auditFormNumber: 'Form 6-A',
  schedules: HARYANA_SCHEDULES.map(s => ({
    ...s,
    name: s.name.replace('Schedule', 'Statement'),
    nameHi: s.nameHi.replace('अनुसूची', 'विवरण'),
  })),
  reservePct: 25,
  educationFundPct: 2,
  coopDevFundPct: 2,
};

// ── Karnataka ────────────────────────────────────────────────────────────────
// Karnataka Cooperative Societies Act, 1959 (Sec 57–60)

export const KARNATAKA_FORMAT: StateAuditFormat = {
  stateCode: 'ka',
  actName: 'Karnataka Cooperative Societies Act, 1959',
  actNameHi: 'कर्नाटक सहकारी समिति अधिनियम, 1959',
  actYear: 1959,
  schedules: HARYANA_SCHEDULES,
  reservePct: 25,
  educationFundPct: 1,
  coopDevFundPct: 3,
};

// ── Kerala ───────────────────────────────────────────────────────────────────
// Kerala Cooperative Societies Act, 1969 (Sec 56–59)

export const KERALA_FORMAT: StateAuditFormat = {
  stateCode: 'kl',
  actName: 'Kerala Cooperative Societies Act, 1969',
  actNameHi: 'केरल सहकारी समिति अधिनियम, 1969',
  actYear: 1969,
  schedules: HARYANA_SCHEDULES,
  reservePct: 25,
  educationFundPct: 5,   // Kerala mandates 5% education fund
  coopDevFundPct: 2,
};

// ── UP & Bihar (PACS-focused) ────────────────────────────────────────────────

const UP_BIHAR_SCHEDULES: ScheduleDefinition[] = HARYANA_SCHEDULES.map(s => ({
  ...s,
  name: s.name.replace('Schedule', 'Proforma'),
  nameHi: s.nameHi.replace('अनुसूची', 'प्रपत्र'),
}));

export const UP_FORMAT: StateAuditFormat = {
  stateCode: 'up',
  actName: 'Uttar Pradesh Cooperative Societies Act, 1965',
  actNameHi: 'उत्तर प्रदेश सहकारी समिति अधिनियम, 1965',
  actYear: 1965,
  auditFormNumber: 'Form-14',
  schedules: UP_BIHAR_SCHEDULES,
  reservePct: 25,
  educationFundPct: 1,
  coopDevFundPct: 2,
};

export const BIHAR_FORMAT: StateAuditFormat = {
  stateCode: 'br',
  actName: 'Bihar Self-Supporting Cooperative Societies Act, 1996',
  actNameHi: 'बिहार स्वावलंबी सहकारी समिति अधिनियम, 1996',
  actYear: 1996,
  schedules: UP_BIHAR_SCHEDULES,
  reservePct: 25,
  educationFundPct: 1,
  coopDevFundPct: 2,
};

// ── Punjab (same structure as Haryana, different act) ────────────────────────

export const PUNJAB_FORMAT: StateAuditFormat = {
  stateCode: 'pb',
  actName: 'Punjab Cooperative Societies Act, 1961',
  actNameHi: 'पंजाब सहकारी समिति अधिनियम, 1961',
  actYear: 1961,
  schedules: HARYANA_SCHEDULES,
  reservePct: 25,
  educationFundPct: 1,
  coopDevFundPct: 3,
};

// ── Rajasthan ────────────────────────────────────────────────────────────────

export const RAJASTHAN_FORMAT: StateAuditFormat = {
  stateCode: 'rj',
  actName: 'Rajasthan Cooperative Societies Act, 2001',
  actNameHi: 'राजस्थान सहकारी समिति अधिनियम, 2001',
  actYear: 2001,
  auditFormNumber: 'Form-14',
  schedules: HARYANA_SCHEDULES,
  reservePct: 25,
  educationFundPct: 1,
  coopDevFundPct: 3,
};

// ── Generic Format (for unconfigured states) ────────────────────────────────

export const GENERIC_FORMAT: StateAuditFormat = {
  stateCode: 'generic',
  actName: 'Multi-State Cooperative Societies Act, 2002',
  actNameHi: 'बहु-राज्य सहकारी समिति अधिनियम, 2002',
  actYear: 2002,
  schedules: HARYANA_SCHEDULES, // Generic uses same structure
  reservePct: 25,
  educationFundPct: 1,
  coopDevFundPct: 3,
};

// ── Registry ────────────────────────────────────────────────────────────────

const STATE_AUDIT_FORMATS: Record<string, StateAuditFormat> = {
  hr: HARYANA_FORMAT,
  mh: MAHARASHTRA_FORMAT,
  gj: GUJARAT_FORMAT,
  ka: KARNATAKA_FORMAT,
  kl: KERALA_FORMAT,
  up: UP_FORMAT,
  br: BIHAR_FORMAT,
  pb: PUNJAB_FORMAT,
  rj: RAJASTHAN_FORMAT,
};

/** Retrieve audit format for a state code. Falls back to generic if not configured. */
export function getStateAuditFormat(stateCode: string): StateAuditFormat {
  return STATE_AUDIT_FORMATS[stateCode] || { ...GENERIC_FORMAT, stateCode };
}

/** List all states that have specific configurations */
export function getConfiguredStates(): { code: string; name: string }[] {
  return Object.values(STATE_AUDIT_FORMATS).map(f => ({
    code: f.stateCode,
    name: f.actName,
  }));
}
