/**
 * Capability metadata (C6) — UI CONTENT for the Features screen only (names, descriptions,
 * category, future docs link). This is presentation data, NOT resolution logic — the
 * resolver never reads it. Adding a capability here never changes navigation behaviour.
 */
import type { Capability } from './capabilities';
import { MODULE_CATALOG, type ModuleDefinition } from './moduleCatalog';

export interface CapabilityCategory {
  key: string;
  nameHi: string;
  nameEn: string;
}

/** Categories in display order (only those that back at least one capability). */
export const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  { key: 'dairy',       nameHi: 'दुग्ध',            nameEn: 'Dairy' },
  { key: 'trading',     nameHi: 'व्यापार एवं बिक्री', nameEn: 'Trading & Sales' },
  { key: 'inventory',   nameHi: 'भंडार',            nameEn: 'Inventory & Warehouse' },
  { key: 'lending',     nameHi: 'ऋण',              nameEn: 'Lending & Credit' },
  { key: 'procurement', nameHi: 'खरीद एवं MSP',     nameEn: 'Procurement & MSP' },
  { key: 'billing',     nameHi: 'बिलिंग',           nameEn: 'Billing & POS' },
  { key: 'transport',   nameHi: 'परिवहन',           nameEn: 'Transport' },
  { key: 'compliance',  nameHi: 'कर एवं अनुपालन',    nameEn: 'Compliance & Tax' },
];

export interface CapabilityMeta {
  id: Capability;
  category: string;
  nameHi: string;
  nameEn: string;
  descHi: string;
  descEn: string;
  docsUrl?: string;  // future-ready (rendered, not yet wired)
}

export const CAPABILITY_META: CapabilityMeta[] = [
  { id: 'dairy_collection', category: 'dairy', nameHi: 'दुग्ध संकलन', nameEn: 'Dairy Collection',
    descHi: 'सदस्य-वार दूध संकलन — मात्रा, फैट, SNF, दर और भुगतान पत्रक।', descEn: 'Member-wise milk collection — quantity, fat, SNF, rate and payout sheet.', docsUrl: '#' },
  { id: 'trading', category: 'trading', nameHi: 'व्यापार', nameEn: 'Trading',
    descHi: 'माल की खरीद-बिक्री, ग्राहक, आपूर्तिकर्ता और स्टॉक से जुड़े मॉड्यूल।', descEn: 'Buying and selling of goods — customers, suppliers and stock modules.', docsUrl: '#' },
  { id: 'warehousing', category: 'inventory', nameHi: 'भंडारण', nameEn: 'Warehousing',
    descHi: 'गोदाम-आधारित स्टॉक मूल्यांकन और भंडार प्रबंधन।', descEn: 'Warehouse-based stock valuation and inventory management.', docsUrl: '#' },
  { id: 'lending', category: 'lending', nameHi: 'ऋण', nameEn: 'Lending',
    descHi: 'सदस्यों को ऋण, ब्याज और KCC से जुड़े रजिस्टर।', descEn: 'Member loans, interest and KCC-related registers.', docsUrl: '#' },
  { id: 'procurement_msp', category: 'procurement', nameHi: 'खरीद / MSP', nameEn: 'Procurement / MSP',
    descHi: 'न्यूनतम समर्थन मूल्य पर खरीद, मंडी और फेडरेशन रिपोर्ट।', descEn: 'MSP procurement, mandi and federation reporting.', docsUrl: '#' },
  { id: 'fertilizer_distribution', category: 'procurement', nameHi: 'उर्वरक वितरण', nameEn: 'Fertilizer Distribution',
    descHi: 'उर्वरक स्टॉक और वितरण।', descEn: 'Fertilizer stock and distribution.', docsUrl: '#' },
  { id: 'seed_distribution', category: 'procurement', nameHi: 'बीज वितरण', nameEn: 'Seed Distribution',
    descHi: 'बीज स्टॉक और वितरण।', descEn: 'Seed stock and distribution.', docsUrl: '#' },
  { id: 'pos_billing', category: 'billing', nameHi: 'POS बिलिंग', nameEn: 'POS Billing',
    descHi: 'काउंटर बिलिंग और पॉइंट-ऑफ-सेल।', descEn: 'Counter billing and point-of-sale.', docsUrl: '#' },
  { id: 'transport', category: 'transport', nameHi: 'परिवहन', nameEn: 'Transport',
    descHi: 'वाहन और ढुलाई प्रबंधन।', descEn: 'Vehicle and freight management.', docsUrl: '#' },
  { id: 'gst', category: 'compliance', nameHi: 'जीएसटी', nameEn: 'GST',
    descHi: 'GST सारांश, e-Way बिल और HSN मास्टर।', descEn: 'GST summary, e-Way bill and HSN master.', docsUrl: '#' },
  { id: 'tds', category: 'compliance', nameHi: 'टीडीएस', nameEn: 'TDS',
    descHi: 'TDS रजिस्टर और फॉर्म 16A।', descEn: 'TDS register and Form 16A.', docsUrl: '#' },
];

/** Modules that require a given capability — i.e. what a feature toggle shows/hides. */
export function modulesForCapability(capability: Capability): ModuleDefinition[] {
  return MODULE_CATALOG.filter((m) => m.requiredCapabilities.includes(capability));
}
