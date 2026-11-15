/**
 * English text for the /software pages — a line-for-line rendering of the Hindi in societyTypes.tsx
 * (introHi, painsHi, solvesHi). Same order, same number of lines, nothing added: a claim that is not in
 * the Hindi must not appear here. scripts/test-software-pages.mjs checks the counts match.
 * PURE — also loadable by scripts/prerender-guide.mjs.
 */
export interface SocietyTypeEn { intro: string; pains: string[]; solves: string[] }

export const SOCIETY_TYPES_EN: Record<string, SocietyTypeEn> = {
  pacs: {
    intro: "A Primary Agricultural Credit Society's whole accounts in one place — member loans, KCC, interest calculation, NPA classification and DCCB/NABARD reports, in line with the Cooperative Act.",
    pains: [
      'Working out member-wise loans and interest, and keeping track of dues',
      'Managing KCC (Kisan Credit Card) accounts',
      'Reports in the formats DCCB/NABARD prescribe',
      'NPA classification and reserve fund compliance',
    ],
    solves: [
      'Loan register — member-wise loans, instalments and interest worked out automatically',
      'A dedicated KCC module with interest calculation',
      'NABARD-style reports + reserve fund appropriation (% as per the state Act / bye-laws)',
      'Member share register, Trial Balance, Balance Sheet and audit certificate',
    ],
  },
  dairy: {
    intro: "Milk collection, member-wise payment, credit sales of cattle feed and commission — a dairy society's whole accounts in plain language, in one place.",
    pains: [
      'Member-wise milk payment and the monthly payment cycle',
      'Credit sales of cattle feed and member dues',
      'Separate accounts for commission / processing income',
      'Correct accounting of stock and its valuation',
    ],
    solves: [
      'Member account + bill-wise matching of payments and dues',
      'Cattle-feed stock register and sales',
      'Activity-wise income and expense heads',
      'TDS/GST summary and RCS audit report',
    ],
  },
  marketing: {
    intro: "MSP procurement, farmer-wise payment, Hafed/FCI agent commission and processing income — a marketing society's whole accounts, in the audit format the cooperative department expects.",
    pains: [
      'Accounts of MSP procurement and farmer-wise payment',
      'Hafed/FCI agent commission and processing income',
      'Separate accounts for each activity’s sales and purchases',
      'Stock valuation and large transactions',
    ],
    solves: [
      'Farmer-wise account + bill-wise payment',
      'Activity-wise sales and purchase heads',
      'Stock register and valuation (FIFO / weighted average)',
      'TDS/GST and RCS audit certificate',
    ],
  },
  consumer: {
    intro: 'Retail sales, GST bills, stock and HSN summary — the shop and the books of a consumer store in one software.',
    pains: [
      'Retail sales and making GST bills',
      'An exact account of stock and its valuation',
      'HSN / rate-wise GST summary',
      'Supplier dues and payments',
    ],
    solves: [
      'GST sales bills and receipts',
      'Inventory + stock valuation report',
      'HSN summary and help with GSTR-1 / 3B',
      'Bill-wise supplier dues and audit',
    ],
  },
  housing: {
    intro: 'Maintenance charges, sinking fund, member dues and meeting records — simple and transparent management of a housing society.',
    pains: [
      'Member-wise maintenance charges and dues',
      'Separate accounts for the sinking / repair fund',
      'Records of meetings and resolutions',
      'Transparent receipts and payments, and audit',
    ],
    solves: [
      'Member account + matching of dues',
      'Fund-wise heads (sinking, repairs and so on)',
      'Meeting register and minutes',
      'Receipts & Payments account, Balance Sheet and audit',
    ],
  },
  sugar: {
    intro: "Cane procurement, farmer-wise payment, sugar and molasses stock, and large-volume transactions — a sugar factory's whole accounts in one place.",
    pains: [
      'Cane procurement and farmer-wise payment',
      'Stock and valuation of sugar / molasses',
      'Large-scale accounts and TDS',
      'The cooperative audit format',
    ],
    solves: [
      'Farmer-wise account + bill-wise payment',
      'Activity-wise purchase and sales heads',
      'Stock valuation and depreciation',
      'TDS/GST and RCS audit certificate',
    ],
  },
  labour: {
    intro: "Contract-work income, wages / salary, TDS 194C and member payments — a labour society's whole accounts in plain language.",
    pains: [
      'Income and bills for contract work',
      'Payment of wages / salary',
      'Compliance with contractor TDS (194C)',
      'Member-wise payments and records',
    ],
    solves: [
      'Salary / wages module',
      'TDS register + quarterly TDS data export (the old 26Q layout)',
      'Activity-wise income heads',
      'Member account, Balance Sheet and audit',
    ],
  },
  multipurpose: {
    intro: 'Mixed activities such as fisheries, weaving, labour, or credit with a store — the accounts of every multipurpose society in one flexible software.',
    pains: [
      'Keeping the accounts of several activities at once',
      'Accounts of both members and trading',
      'Varied compliance (TDS/GST)',
      'The RCS audit format',
    ],
    solves: [
      'Ready chart-of-accounts templates for 8 society types',
      'Activity-wise income and expense heads',
      'Members + loans + stock in one place',
      'TDS/GST and RCS audit certificate',
    ],
  },
};
