/**
 * Next-step workflow map (audit HP-6, part 2). Part 1 gave every page a "where am I"
 * breadcrumb; this gives the high-traffic pages a "what now" — after you finish a task
 * the app suggests the natural next module, so a new secretary is not left staring at a
 * saved voucher wondering where the trial balance lives.
 *
 * Keyed by the module's EXACT route (matches useLocation().pathname, which excludes the
 * query string). Values are module IDs from MODULE_CATALOG; the renderer filters them to
 * what the current user can actually see (same visibility source as the sidebar) and drops
 * anything unknown — so a wrong/renamed id degrades to "no suggestion", never a broken link.
 *
 * Deliberately partial: only the well-trodden flows are mapped. An unmapped route renders
 * nothing, which is correct — not every screen has an obvious single next step.
 */
export const NEXT_STEPS: Record<string, string[]> = {
  // ── setup / onboarding ──
  '/society-setup':     ['openingBalances', 'members'],
  '/opening-balances':  ['trialBalance', 'members'],
  '/ledger-heads':      ['vouchers'],

  // ── daily entry → review ──
  '/vouchers':          ['dayBook', 'trialBalance'],
  '/compound-voucher':  ['dayBook', 'trialBalance'],
  '/cash-book':         ['dayBook', 'vouchers'],
  '/bank-book':         ['bankReconciliation', 'dayBook'],
  '/bank-reconciliation': ['bankBook'],
  '/day-book':          ['trialBalance', 'ledger'],
  '/ledger':            ['trialBalance'],

  // ── members & shares ──
  '/members':           ['shareRegister', 'memberApplication'],
  '/member-application': ['members'],
  '/share-register':    ['members', 'profitDistribution'],

  // ── sales / purchases / payments ──
  '/sales':             ['receivePayment', 'saleRegister'],
  '/receive-payment':   ['billsOutstanding', 'saleRegister'],
  '/purchases':         ['makePayment', 'purchaseRegister'],
  '/make-payment':      ['billsOutstanding', 'purchaseRegister'],
  '/inventory':         ['stockValuation', 'purchases'],
  '/suppliers':         ['purchases'],
  '/customers':         ['sales'],

  // ── payroll ──
  '/salary':            ['payroll', 'tdsRegister'],
  '/payroll':           ['tdsRegister', 'tdsForm16A'],

  // ── reports chain ──
  '/trial-balance':     ['profitLoss', 'balanceSheet'],
  '/trading-account':   ['profitLoss'],
  '/profit-loss':       ['balanceSheet', 'profitDistribution'],
  '/balance-sheet':     ['reports'],
  '/gst-summary':       ['gstr9', 'eWayBill'],
  '/tds-register':      ['tdsForm16A'],

  // ── registers / year-end ──
  '/profit-distribution': ['reserveFund', 'balanceSheet'],
  '/loan-register':     ['loanInterest'],
  '/asset-register':    ['depreciationSchedule'],
  '/depreciation-schedule': ['balanceSheet'],
};
