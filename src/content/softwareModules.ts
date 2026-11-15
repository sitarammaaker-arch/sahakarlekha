/**
 * What a society of each type actually gets in the app — for the /software/<type> pages.
 *
 * Nothing here is written by hand. The list is the app's own menu for an admin of that society type:
 * the same capability template (SOCIETY_TYPE_CAPABILITIES via resolveCapabilities) and the same
 * visibility rule (getVisibleGroups) the sidebar uses. So the marketing page cannot promise a module
 * the product does not show, and a module added to the catalogue appears on the page by itself.
 *
 * State-specific modules (jurisdiction packs) are left out on purpose: the pages are not state pages.
 * PURE — also loaded by scripts/prerender-guide.mjs for the static HTML.
 */
import type { SocietyType } from '@/types';
import { getVisibleGroups } from '@/lib/navigation/navVisibility';
import { resolveCapabilities } from '@/lib/navigation/capabilityResolver';
import { translations } from '@/contexts/LanguageContext';
import { minPlanFor } from '@/lib/plans';
import type { NavDomain } from '@/lib/navigation/capabilities';

/** /software/<slug> → the app's society type. */
export const SOFTWARE_SLUG_TYPE: Record<string, SocietyType> = {
  pacs: 'pacs',
  dairy: 'dairy',
  marketing: 'marketing_processing',
  consumer: 'consumer',
  housing: 'housing',
  sugar: 'sugar',
  labour: 'labour',
  multipurpose: 'multipurpose',
};

export interface SoftwareModuleItem { hi: string; en: string; /** 'plus' | 'pro' when the page opens only on that plan or higher */ plan?: 'plus' | 'pro' }
export interface SoftwareModuleGroup { domain: NavDomain; hi: string; en: string; items: SoftwareModuleItem[] }

/** Setup screens and dashboards are not what a buyer is asking about. */
const SKIP_DOMAINS: ReadonlySet<NavDomain> = new Set<NavDomain>(['administration']);
const SKIP_IDS: ReadonlySet<string> = new Set(['dashboard', 'myDashboard', 'analytics']);

const HEADING: Record<NavDomain, { hi: string; en: string }> = {
  core: { hi: 'रोज़ का हिसाब', en: 'Daily books' },
  operations: { hi: 'खरीद, बिक्री और स्टाफ', en: 'Purchases, sales and staff' },
  consumer: { hi: 'उपभोक्ता भंडार', en: 'Consumer store' },
  marketing: { hi: 'खरीद (MSP) और विपणन', en: 'Procurement (MSP) and marketing' },
  transport: { hi: 'परिवहन', en: 'Transport' },
  dairy: { hi: 'दुग्ध संग्रह', en: 'Dairy' },
  labour: { hi: 'श्रमिक और कार्य-आदेश', en: 'Labour and work orders' },
  housing: { hi: 'आवास समिति', en: 'Housing' },
  reports: { hi: 'रिपोर्ट', en: 'Reports' },
  registers: { hi: 'रजिस्टर', en: 'Registers' },
  administration: { hi: 'सेटिंग्स', en: 'Settings' },
};

const label = (titleKey: string): { hi: string; en: string } => {
  const t = translations[titleKey];
  return t ? { hi: t.hi, en: t.en } : { hi: titleKey, en: titleKey };
};

/** The module groups an admin of this society type sees. Empty for an unknown slug. */
export function softwareModuleGroups(slug: string): SoftwareModuleGroup[] {
  const societyType = SOFTWARE_SLUG_TYPE[slug];
  if (!societyType) return [];
  const groups = getVisibleGroups({
    societyType,
    capabilities: resolveCapabilities(societyType),
    hasRole: () => true, // the admin's menu
  });
  return groups
    .filter((g) => !SKIP_DOMAINS.has(g.domain))
    .map((g) => ({
      domain: g.domain,
      ...HEADING[g.domain],
      items: g.items
        .filter((m) => !SKIP_IDS.has(m.id))
        .map((m) => ({ ...label(m.titleKey), ...(m.requiredPlanFeature ? { plan: minPlanFor(m.requiredPlanFeature) } : {}) })),
    }))
    .filter((g) => g.items.length > 0);
}

/** Total modules on the page for this type (for a one-line summary). */
export const softwareModuleCount = (slug: string): number =>
  softwareModuleGroups(slug).reduce((n, g) => n + g.items.length, 0);
