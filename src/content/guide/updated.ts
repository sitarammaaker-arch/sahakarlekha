/**
 * Last real content change per guide chapter — shown as "अंतिम अपडेट" on the chapter page and used for the
 * sitemap <lastmod> / Article dateModified by scripts/prerender-guide.mjs. index.ts is auto-generated, so the
 * dates live here. Bump a chapter's date whenever its markdown changes in substance (test:content-standards
 * checks the format). PURE — no imports.
 */
export const GUIDE_DEFAULT_UPDATED = '2026-06-20';

export const GUIDE_UPDATED: Record<string, string> = {
  'audit-preparation': '2026-10-10',
  'balance-sheet': '2026-10-04',
  'bill-wise-settlement': '2026-10-09',
  'chart-of-accounts': '2026-10-04',
  'comprehensive-faq': '2026-10-04',
  'data-security-and-backup': '2026-10-04',
  'daybook-and-ledger': '2026-10-04',
  'depreciation': '2026-10-04',
  'error-rectification-entries': '2026-10-09',
  'financial-ratios-and-lifecycle': '2026-10-04',
  'gst-management': '2026-10-08',
  'income-and-expenditure': '2026-10-10',
  'inventory-management': '2026-10-10',
  'member-management': '2026-10-04',
  'msp-procurement-entries': '2026-10-04',
  'opening-balances': '2026-10-08',
  'profit-distribution': '2026-10-10',
  'purchase-entries': '2026-10-08',
  'receipts-and-payments': '2026-10-04',
  'salary-management': '2026-10-04',
  'sales-entries': '2026-10-09',
  'society-setup-and-roles': '2026-10-04',
  'society-type-entries': '2026-10-04',
  'special-registers': '2026-10-04',
  'statutory-returns': '2026-10-04',
  'stock-valuation': '2026-10-04',
  'tds-and-26q': '2026-10-04',
  'trading-account': '2026-10-04',
  'trial-balance': '2026-10-08',
  'voucher-types': '2026-10-09',
  'year-end-and-fy-lock': '2026-10-04',
  'standard-chart-of-accounts': '2026-10-04',
};

export function guideUpdated(slug: string): string {
  return GUIDE_UPDATED[slug] ?? GUIDE_DEFAULT_UPDATED;
}
