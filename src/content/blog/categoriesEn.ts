/**
 * English text of the blog categories (keyed by slug) — display only; the Hindi `name` in ./categories.ts stays the
 * data key everywhere (post.category, URLs). ONE source for the React pages (BlogCards' categoryLabel, BlogCategory's
 * English meta/intro) and the English prerender (scripts/prerender-guide.mjs, /en/blog/category/<slug>).
 * Pure (no imports) so the prerender can load it. test-content-en.mjs checks every category has an entry.
 */
export interface BlogCategoryEn {
  /** label on chips, headings and breadcrumbs */
  name: string;
  /** <title> of the English hub page */
  metaTitle: string;
  /** meta description of the English hub page */
  description: string;
  /** one or two lines under the hub's h1 */
  intro: string;
}

export const BLOG_CATEGORIES_EN: Record<string, BlogCategoryEn> = {
  'accounting-basics': {
    name: 'Accounting basics',
    metaTitle: 'Accounting basics for cooperative societies | SahakarLekha Blog',
    description: 'Double entry, the ledger, the chart of accounts, the financial year and depreciation — the basics of a cooperative society\'s accounts in plain language.',
    intro: 'New to bookkeeping? From debit and credit to the ledger and depreciation — start here.',
  },
  'vouchers-daily-accounts': {
    name: 'Vouchers & daily accounts',
    metaTitle: 'Vouchers, cash book & bank reconciliation: daily accounts | SahakarLekha Blog',
    description: 'Voucher entry, payment approval, the cash book, bank reconciliation (BRS), stock and salary — articles on a cooperative society\'s day-to-day accounting work.',
    intro: 'The accountant\'s and treasurer\'s daily work: filling vouchers, handling cash and bank, the monthly reconciliation.',
  },
  'members-shares-loans': {
    name: 'Members, shares, deposits & loans',
    metaTitle: 'Accounting for members, shares, deposits & loans | SahakarLekha Blog',
    description: 'Membership, share capital, interest on member deposits, KCC and crop loans, recovery and dividend — articles on the accounts connected with members.',
    intro: 'From membership to shares, deposits, loans and recovery — for secretaries and accountants.',
  },
  'reports-audit-year-end': {
    name: 'Reports, audit & year-end',
    metaTitle: 'Reports, audit & year-end preparation | SahakarLekha Blog',
    description: 'Trial balance, financial reports, audit classification, internal control, profit distribution and year-end — articles on a cooperative society\'s reporting and audit.',
    intro: 'From reading a trial balance to preparing for audit and closing the year.',
  },
  'tax-statutory-returns': {
    name: 'Tax & statutory returns',
    metaTitle: 'GST, TDS & statutory returns for cooperative societies | SahakarLekha Blog',
    description: 'GST, TDS and 26Q, the quarterly compliance calendar, annual and NABARD/federation returns — articles on a cooperative society\'s taxes and returns.',
    intro: 'Which tax, which return, by when — for the accountant.',
  },
  'law-governance': {
    name: 'Law, registration & governance',
    metaTitle: 'Cooperative law, registration, bye-laws & meetings | SahakarLekha Blog',
    description: 'Registration, bye-laws, the Act and Rules, board meetings, the AGM, elections, office-bearers\' powers and staff service rules — articles on a cooperative society\'s law and governance.',
    intro: 'For secretaries and office-bearers: what the rules say, how a meeting should run, who has which powers.',
  },
  'society-types': {
    name: 'Types of societies',
    metaTitle: 'PACS, CM-PACS, dairy, consumer & housing societies | SahakarLekha Blog',
    description: 'PACS, CM-PACS, dairy, consumer stores, housing and women\'s societies — the work and the accounts of each type of cooperative society.',
    intro: 'What type is your society? The special points of its work and accounts are here.',
  },
  'schemes-procurement': {
    name: 'Schemes, procurement & government updates',
    metaTitle: 'Cooperative schemes, MSP procurement & government updates | SahakarLekha Blog',
    description: 'HAFED/MSP procurement, warehouses, PM-KUSUM, CSC, NCDC schemes, PACS computerisation and cooperative policy — government schemes and updates for cooperative societies.',
    intro: 'Updates on government schemes, procurement and policy. These articles change over time, so check the date on each one.',
  },
  'cooperative-movement': {
    name: 'The cooperative movement',
    metaTitle: 'The cooperative movement: history, institutions & success stories | SahakarLekha Blog',
    description: 'Cooperative principles, history, the role of NABARD/NCDC, Amul, IFFCO, NDDB and success stories — articles on the cooperative movement.',
    intro: 'What cooperation is, where it came from, and the institutions that made it big.',
  },
  'digital-accounting': {
    name: 'Digital accounting & SahakarLekha',
    metaTitle: 'Digital accounting & using SahakarLekha | SahakarLekha Blog',
    description: 'Choosing the right software, migrating from Tally/Excel, roles and permissions, data backup and getting started with SahakarLekha — articles on digital accounting.',
    intro: 'How to move from paper or Excel to digital accounts, and how to use SahakarLekha.',
  },
};
