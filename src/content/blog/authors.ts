/**
 * Blog authors — real people who write for SahakarLekha (E-E-A-T). Kept separate
 * from post metadata: a post's author defaults to DEFAULT_AUTHOR_SLUG, so a
 * single-author site needs no per-post field. Add an optional `author` slug to a
 * post later to attribute it to someone else.
 */
export interface Author {
  slug: string;
  name: string;
  /** role shown next to the name (e.g. Editor) */
  designation: string;
  /** one-line summary for the byline + meta description */
  tagline: string;
  /** qualifications, shown as a list on the profile */
  credentials: string[];
  /** experience rows */
  experience: { years: string; field: string }[];
  /** institutions, for schema alumniOf */
  alumniOf: string[];
  /** topics the author writes about, for schema knowsAbout */
  knowsAbout: string[];
  /** optional /public image path; falls back to initials */
  photo?: string;
  /** optional external links (X, LinkedIn, website) */
  socials?: { label: string; href: string }[];
}

export const AUTHORS: Record<string, Author> = {
  sitaram: {
    slug: 'sitaram',
    name: 'Sitaram',
    designation: 'Editor',
    tagline: '26+ वर्ष मार्केटिंग एवं 6+ वर्ष सहकारी क्षेत्र का अनुभव।',
    credentials: [
      'HDCM (Higher Diploma in Cooperative Management) — RICM, Chandigarh',
      'Certificate Course on Cooperative Law and Practice — NCUI, New Delhi',
      'Digital Personal Data Protection Law in India — NCUI, New Delhi',
      'Use of RTI Act, 2005 for Good Governance — NCUI, New Delhi',
      'Certificate in Cooperatives and Farmers’ Organizations — IGNOU, New Delhi',
    ],
    experience: [
      { years: '26+', field: 'मार्केटिंग / Marketing' },
      { years: '6+', field: 'सहकारी क्षेत्र / Cooperative Sector' },
    ],
    alumniOf: ['RICM, Chandigarh', 'NCUI, New Delhi', 'IGNOU, New Delhi'],
    knowsAbout: [
      'सहकारी लेखांकन', 'Cooperative Law', 'ऑडिट व अनुपालन', 'GST', 'TDS', 'RTI Act 2005',
    ],
    photo: '/authors/sitaram.webp',
  },
};

export const DEFAULT_AUTHOR_SLUG = 'sitaram';

/** Resolve a post/byline author; unknown or missing → the default author. */
export function getAuthor(slug?: string): Author {
  return AUTHORS[slug || DEFAULT_AUTHOR_SLUG] || AUTHORS[DEFAULT_AUTHOR_SLUG];
}

/** Up to two initials from a name, for the avatar fallback. */
export function authorInitials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
