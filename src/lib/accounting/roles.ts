/**
 * Accounting roles (Phase-3 S1 · M1-3 · RM-05).
 *
 * The target posting engine never names an account code; it asks for a ROLE ("member share
 * capital", "GST output CGST") and each society's account_roles map (migration 074) says which of
 * ITS accounts plays that role. Today the code hard-codes ids ('1102', '2201', '3303' …), but the
 * same id means different things in different charts — 3303 is Sundry Debtors in CMS, KCC loans
 * in PACS and Maintenance Receivable in Housing. See Phase-3 design, section A-6.
 *
 * This module is PURE and has no consumer yet:
 *   - ROLE_CATALOG   — the first set of roles, the account type each expects, and how to
 *                      recognise a candidate account in an existing chart;
 *   - REPORT_CLASSES — values for the new accounts.report_class column;
 *   - proposeRoleMap — a READ-ONLY proposal of role → account for one society's chart, with the
 *                      basis of each match, so a person can review it before anything is seeded.
 * Nothing here writes, and no proposal is applied automatically (decision 3, 2026-09-27).
 */

export type AccountType = 'asset' | 'liability' | 'income' | 'expense' | 'equity';

export type RoleCapability =
  | 'core' | 'member' | 'lending' | 'parties' | 'gst' | 'tds' | 'msp' | 'payroll'
  | 'trading' | 'assets' | 'interest' | 'year_end';

export interface RoleDef {
  /** Stable key stored in account_roles.role. */
  role: string;
  capability: RoleCapability;
  /** Account types a mapped account may have (a liability role never maps to an asset). */
  types: AccountType[];
  /** Recognises a candidate by its name / nameHi (case-insensitive). */
  match: RegExp;
  /** Also recognise by accounts.subtype. */
  subtypes?: string[];
  /** Names that look similar but are NOT this role. */
  exclude?: RegExp;
  /** Conventional template ids, in preference order — used to break ties and to flag collisions. */
  preferIds?: string[];
  /** Transitional role that a later remediation item retires. */
  legacy?: string;
  label: string;
}

export const ROLE_CATALOG: readonly RoleDef[] = [
  // Cash / bank
  { role: 'cash', capability: 'core', types: ['asset'], match: /cash in hand|रोकड़|नकद/i, preferIds: ['3301'], label: 'Cash in hand' },
  { role: 'bank.default', capability: 'core', types: ['asset'], match: /^bank accounts?\b|^bank\b/i, preferIds: ['3302-01', '3302'], label: 'Default bank' },

  // Member
  { role: 'member.share_capital', capability: 'member', types: ['equity'], match: /individual share capital|member share capital|व्यक्तिगत शेयर/i, preferIds: ['1102'], label: 'Member share capital' },
  { role: 'member.admission_fee', capability: 'member', types: ['income'], match: /admission fee|प्रवेश शुल्क/i, preferIds: ['4407'], label: 'Admission fee' },
  { role: 'member.loan.short_term', capability: 'lending', types: ['asset'], match: /short[- ]?term loan/i, preferIds: ['3303'], label: 'Member loan — short term' },
  { role: 'member.loan.medium_term', capability: 'lending', types: ['asset'], match: /medium[- ]?term loan/i, preferIds: ['3304'], label: 'Member loan — medium term' },
  { role: 'member.loan.kcc', capability: 'lending', types: ['asset'], match: /\bkcc\b/i, preferIds: ['3303'], label: 'Member loan — KCC' },

  // Loan income / provisions
  { role: 'loan.interest_receivable', capability: 'lending', types: ['asset'], match: /interest receivable|loan interest rec/i, preferIds: ['3313', '3312'], label: 'Loan interest receivable' },
  { role: 'loan.interest_income', capability: 'lending', types: ['income'], match: /interest on member loans?/i, preferIds: ['4408'], label: 'Interest on member loans' },
  { role: 'loan.overdue_interest_reserve', capability: 'lending', types: ['liability', 'equity'], match: /overdue interest reserve/i, label: 'Overdue interest reserve' },
  { role: 'loan.provision.npa', capability: 'lending', types: ['liability', 'equity'], match: /provision.*(npa|bad|doubtful)|npa provision/i, label: 'NPA / bad & doubtful provision' },

  // Parties
  { role: 'customer.receivable', capability: 'parties', types: ['asset'], match: /sundry debtors|trade receivables?/i, preferIds: ['3303-01', '3303'], label: 'Customers (sundry debtors)' },
  { role: 'supplier.payable', capability: 'parties', types: ['liability'], match: /sundry creditors|trade payables?/i, preferIds: ['2101-01', '2101'], label: 'Suppliers (sundry creditors)' },

  // GST — head-wise target roles (RM-17 splits today's single accounts into these)
  { role: 'gst.output.cgst', capability: 'gst', types: ['liability'], match: /output.*\bcgst\b|\bcgst\b.*(output|payable)/i, label: 'GST output — CGST' },
  { role: 'gst.output.sgst', capability: 'gst', types: ['liability'], match: /output.*\bsgst\b|\bsgst\b.*(output|payable)/i, label: 'GST output — SGST' },
  { role: 'gst.output.igst', capability: 'gst', types: ['liability'], match: /output.*\bigst\b|\bigst\b.*(output|payable)/i, label: 'GST output — IGST' },
  { role: 'gst.input.cgst', capability: 'gst', types: ['asset'], match: /input.*\bcgst\b|\bcgst\b.*(input|itc)/i, label: 'GST input — CGST' },
  { role: 'gst.input.sgst', capability: 'gst', types: ['asset'], match: /input.*\bsgst\b|\bsgst\b.*(input|itc)/i, label: 'GST input — SGST' },
  { role: 'gst.input.igst', capability: 'gst', types: ['asset'], match: /input.*\bigst\b|\bigst\b.*(input|itc)/i, label: 'GST input — IGST' },
  { role: 'gst.rcm.payable', capability: 'gst', types: ['liability'], match: /\brcm\b|reverse charge/i, label: 'GST RCM payable' },
  { role: 'gst.itc.ineligible_expense', capability: 'gst', types: ['expense'], match: /ineligible|blocked itc/i, label: 'Ineligible ITC (expense)' },
  // GST — today's single accounts; retired when RM-17 splits the heads.
  { role: 'gst.output.combined', capability: 'gst', types: ['liability'], match: /^gst payable\b|देय gst/i, preferIds: ['2201'], legacy: 'RM-17', label: 'GST payable (single account, legacy)' },
  { role: 'gst.input.combined', capability: 'gst', types: ['asset'], match: /gst input credit|\bitc\b/i, preferIds: ['3310'], legacy: 'RM-17', label: 'GST input credit (single account, legacy)' },

  // TDS / TCS
  { role: 'tds.payable', capability: 'tds', types: ['liability'], match: /\btds payable|देय tds/i, preferIds: ['2202'], label: 'TDS payable' },
  { role: 'tds.tcs.receivable', capability: 'tds', types: ['asset'], match: /(tds|tcs).*receivable|प्राप्य tds/i, preferIds: ['3307'], label: 'TDS / TCS receivable' },

  // MSP procurement
  { role: 'msp.receivable', capability: 'msp', types: ['asset'], match: /msp receivable/i, preferIds: ['3308'], label: 'MSP receivable' },
  { role: 'msp.farmer_payable', capability: 'msp', types: ['liability'], match: /msp payable/i, preferIds: ['2105'], label: 'MSP payable to farmers' },

  // Payroll
  { role: 'salary.expense', capability: 'payroll', types: ['expense'], match: /^salar(y|ies)\b|^वेतन/i, preferIds: ['5201'], label: 'Salary expense' },
  { role: 'salary.payable', capability: 'payroll', types: ['liability'], match: /salary payable|देय वेतन/i, preferIds: ['2103'], label: 'Salary payable' },
  { role: 'pf.payable', capability: 'payroll', types: ['liability'], match: /\b(e?pf) payable|provident fund payable/i, preferIds: ['2203'], label: 'PF payable' },
  { role: 'esi.payable', capability: 'payroll', types: ['liability'], match: /\besi payable/i, preferIds: ['2204'], label: 'ESI payable' },
  { role: 'pf.employer_expense', capability: 'payroll', types: ['expense'], match: /^e?pf$|^provident fund|भविष्य निधि/i, exclude: /edli|admin/i, preferIds: ['5203'], label: 'PF — employer contribution' },
  { role: 'esi.employer_expense', capability: 'payroll', types: ['expense'], match: /^esi$|कर्मचारी बीमा/i, preferIds: ['5204'], label: 'ESI — employer contribution' },
  { role: 'professional_tax.payable', capability: 'payroll', types: ['liability'], match: /professional tax payable/i, preferIds: ['2207'], label: 'Professional tax payable' },

  // Trading
  { role: 'sales.default', capability: 'trading', types: ['income'], match: /\bsales\b|बिक्री/i, subtypes: ['trading_income'], exclude: /(profit|loss) on sale|asset|संपत्ति/i, preferIds: ['4101'], label: 'Default sales (when an item has none)' },
  { role: 'purchase.default', capability: 'trading', types: ['expense'], match: /^purchases?\b|क्रय/i, preferIds: ['5101'], label: 'Default purchase (when an item has none)' },
  // NOT matched by subtype 'inventory' alone: every chart gets 3406 Packing Material (subtype inventory)
  // from ACCOUNTS_TO_ADD, so a subtype match made it the "only candidate" — the default stock — in
  // housing / dairy charts (M1-4c review, 2026-09-28). Name or the conventional 3403 only.
  { role: 'inventory.default', capability: 'trading', types: ['asset'], match: /trading goods|trading stock/i, preferIds: ['3403'], label: 'Default inventory' },
  { role: 'closing_stock.contra', capability: 'trading', types: ['income', 'expense'], match: /closing stock/i, label: 'Closing stock (contra)' },

  // Assets
  { role: 'asset.disposal.gain', capability: 'assets', types: ['income'], match: /profit on sale of assets?/i, preferIds: ['4410'], label: 'Profit on sale of assets' },
  { role: 'asset.disposal.loss', capability: 'assets', types: ['expense'], match: /loss on sale of assets?/i, preferIds: ['5406'], label: 'Loss on sale of assets' },

  // Interest expense (today both live in 5604 — CAS mapping G3)
  { role: 'interest_expense.deposits', capability: 'interest', types: ['expense'], match: /interest on (member )?deposits?/i, label: 'Interest on deposits' },
  { role: 'interest_expense.borrowings', capability: 'interest', types: ['expense'], match: /interest on borrowings?/i, preferIds: ['5604'], label: 'Interest on borrowings' },

  // Equity / year-end
  { role: 'surplus.unappropriated', capability: 'year_end', types: ['equity'], match: /net surplus|शुद्ध अधिशेष/i, subtypes: ['surplus'], preferIds: ['1208'], label: 'Net surplus / (deficit)' },
  { role: 'reserve.statutory', capability: 'year_end', types: ['equity'], match: /statutory reserve|वैधानिक संचय/i, preferIds: ['1201'], label: 'Statutory reserve fund' },
  { role: 'fund.education', capability: 'year_end', types: ['equity'], match: /education fund|शिक्षा निधि/i, preferIds: ['1203'], label: 'Education fund' },
  { role: 'fund.bad_debt', capability: 'year_end', types: ['equity'], match: /bad (debts?|and doubtful( debts?)?) fund|अशोध्य ऋण निधि/i, preferIds: ['1205'], label: 'Bad debt fund' },
  { role: 'dividend.payable', capability: 'year_end', types: ['liability'], match: /dividend payable|देय लाभांश/i, preferIds: ['2104'], label: 'Dividend payable' },
  { role: 'prior_period.adjustment', capability: 'year_end', types: ['expense', 'income'], match: /prior period/i, preferIds: ['5407'], label: 'Prior-period adjustment' },
  { role: 'rounding', capability: 'year_end', types: ['expense', 'income'], match: /round(ing)?[- ]?off|\brounding\b/i, label: 'Rounding off' },
];

/** Values for accounts.report_class (migration 074). Reports will read this instead of parentId '4100'/'5100'. */
export const REPORT_CLASSES = [
  'trading_income', 'trading_expense', 'inventory', 'closing_stock_contra',
  'indirect_income', 'indirect_expense', 'reserve', 'provision', 'fund',
] as const;
export type ReportClass = typeof REPORT_CLASSES[number];

export interface ChartAccount {
  id: string;
  name: string;
  nameHi?: string;
  type: string;
  subtype?: string | null;
  isGroup?: boolean;
}

export type ProposalBasis = 'matched' | 'preferred_id' | 'ambiguous' | 'missing';

export interface RoleProposal {
  role: string;
  capability: RoleCapability;
  /** Proposed account, or null when missing / ambiguous. */
  accountId: string | null;
  basis: ProposalBasis;
  /** Every account that looks like this role (ids), for review. */
  candidates: string[];
  /**
   * A conventional id for this role exists in the chart but is something ELSE
   * (e.g. PACS 3303 = KCC loans for customer.receivable). Hard-coding that id is the bug RM-05 removes.
   */
  idCollision: { id: string; name: string } | null;
  legacy?: string;
}

const textOf = (a: ChartAccount) => `${a.name || ''} ${a.nameHi || ''}`.trim();

function isCandidate(def: RoleDef, a: ChartAccount): boolean {
  if (a.isGroup) return false;
  if (!def.types.includes(a.type as AccountType)) return false;
  const text = textOf(a);
  if (def.exclude && def.exclude.test(text)) return false;
  return def.match.test(a.name || '') || def.match.test(a.nameHi || '')
    || (!!def.subtypes && !!a.subtype && def.subtypes.includes(a.subtype));
}

/** READ-ONLY: propose role → account for one chart. Never guesses between look-alikes. */
export function proposeRoleMap(accounts: readonly ChartAccount[], catalog: readonly RoleDef[] = ROLE_CATALOG): RoleProposal[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return catalog.map((def) => {
    const cands = accounts.filter((a) => isCandidate(def, a));
    const candidates = cands.map((a) => a.id);
    const collisionAcc = (def.preferIds || []).map((id) => byId.get(id)).find((a) => a && !a.isGroup && !isCandidate(def, a));
    const idCollision = collisionAcc && !cands.some((c) => c.id === collisionAcc.id)
      ? { id: collisionAcc.id, name: collisionAcc.name } : null;
    let accountId: string | null = null;
    let basis: ProposalBasis;
    if (cands.length === 0) basis = 'missing';
    else if (cands.length === 1) { accountId = cands[0].id; basis = 'matched'; }
    else {
      const preferred = (def.preferIds || []).find((id) => candidates.includes(id));
      if (preferred) { accountId = preferred; basis = 'preferred_id'; } else basis = 'ambiguous';
    }
    return { role: def.role, capability: def.capability, accountId, basis, candidates, idCollision, ...(def.legacy ? { legacy: def.legacy } : {}) };
  });
}
