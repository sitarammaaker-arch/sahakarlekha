/**
 * Canonical-by-intent cross-links between the /blog (narrative "why") and the
 * /guide (in-depth reference). Constitution Law L7: where a topic exists in BOTH
 * systems, they must link to each other rather than duplicate — the blog stays the
 * short narrative, the guide chapter is the depth. Only genuine overlaps are paired;
 * topics with no real counterpart (loan-and-interest, bank-reconciliation, the
 * marketing/narrative posts) are intentionally left unpaired.
 */
import { findEntry, type GuideEntry } from '@/content/guide';
import { findPost, type BlogPost } from '@/content/blog';

const PAIRS: { blog: string; guide: string }[] = [
  { blog: 'cooperative-accounting-basics', guide: 'accounting-foundations' },
  { blog: 'voucher-entry-guide', guide: 'voucher-types' },
  { blog: 'member-and-share-accounting', guide: 'member-management' },
  { blog: 'inventory-and-stock-management', guide: 'inventory-management' },
  { blog: 'how-to-read-financial-reports', guide: 'trial-balance' },
  { blog: 'audit-preparation-checklist', guide: 'audit-preparation' },
  { blog: 'common-accounting-mistakes', guide: 'troubleshooting-guide' },
  { blog: 'profit-distribution-and-reserves', guide: 'profit-distribution' },
];

/** The in-depth guide chapter for a blog post (or null if unpaired). */
export function guideForBlog(blogSlug: string): GuideEntry | null {
  const pair = PAIRS.find((p) => p.blog === blogSlug);
  return pair ? findEntry(pair.guide) : null;
}

/** The narrative blog post for a guide chapter (or null if unpaired). */
export function blogForGuide(guideSlug: string): BlogPost | null {
  const pair = PAIRS.find((p) => p.guide === guideSlug);
  return pair ? findPost(pair.blog) : null;
}
