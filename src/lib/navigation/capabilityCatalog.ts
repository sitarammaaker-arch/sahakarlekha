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

/** Categories in display order (only those that back at least one MAPPED capability). */
export const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  { key: 'dairy',       nameHi: 'दुग्ध',            nameEn: 'Dairy' },
  { key: 'trading',     nameHi: 'व्यापार एवं बिक्री', nameEn: 'Trading & Sales' },
  { key: 'lending',     nameHi: 'ऋण',              nameEn: 'Lending & Credit' },
  { key: 'procurement', nameHi: 'खरीद एवं MSP',     nameEn: 'Procurement & MSP' },
  { key: 'housing',     nameHi: 'गृह निर्माण',       nameEn: 'Housing' },
  { key: 'labour',      nameHi: 'श्रमिक',           nameEn: 'Labour' },
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
  { id: 'inventory_sales', category: 'trading', nameHi: 'भंडार एवं बिक्री', nameEn: 'Inventory & Sales',
    descHi: 'माल का स्टॉक, ग्राहक, बिक्री, बिक्री रजिस्टर और स्टॉक मूल्यांकन।', descEn: 'Goods stock, customers, sales, sale register and stock valuation.', docsUrl: '#' },
  { id: 'lending', category: 'lending', nameHi: 'ऋण', nameEn: 'Lending',
    descHi: 'सदस्यों को ऋण, ब्याज और KCC से जुड़े रजिस्टर।', descEn: 'Member loans, interest and KCC-related registers.', docsUrl: '#' },
  { id: 'procurement_msp', category: 'procurement', nameHi: 'खरीद / MSP', nameEn: 'Procurement / MSP',
    descHi: 'न्यूनतम समर्थन मूल्य पर खरीद, मंडी और फेडरेशन रिपोर्ट।', descEn: 'MSP procurement, mandi and federation reporting.', docsUrl: '#' },
  { id: 'housing', category: 'housing', nameHi: 'गृह निर्माण', nameEn: 'Housing',
    descHi: 'फ्लैट/यूनिट रजिस्टर — सदस्य-वार flats और मासिक रखरखाव।', descEn: 'Flats/units register — member-wise flats and monthly maintenance.', docsUrl: '#' },
  { id: 'labour', category: 'labour', nameHi: 'श्रमिक', nameEn: 'Labour',
    descHi: 'कार्य आदेश/श्रम ठेका रजिस्टर — मस्टर रोल व मज़दूरी की नींव।', descEn: 'Work orders / labour-contract register — basis for muster roll and wages.', docsUrl: '#' },
  { id: 'gst', category: 'compliance', nameHi: 'जीएसटी', nameEn: 'GST',
    descHi: 'GST सारांश, e-Way बिल और HSN मास्टर।', descEn: 'GST summary, e-Way bill and HSN master.', docsUrl: '#' },
  { id: 'tds', category: 'compliance', nameHi: 'टीडीएस', nameEn: 'TDS',
    descHi: 'TDS रजिस्टर और फॉर्म 16A।', descEn: 'TDS register and Form 16A.', docsUrl: '#' },
];

/** Modules that require a given capability — i.e. what a feature toggle shows/hides. */
export function modulesForCapability(capability: Capability): ModuleDefinition[] {
  return MODULE_CATALOG.filter((m) => m.requiredCapabilities.includes(capability));
}
