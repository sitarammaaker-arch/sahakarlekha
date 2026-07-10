/**
 * Export Registry — cooperative marketing masters (T-11).
 *
 * Declares the 10 master tables owned by MarketingDataContext: crops, varieties,
 * seasons, agencies, centres, MSP rates, deduction rules, quality specs, bardana types,
 * and transporters.
 *
 * These are the reference data the procurement ENGINE (T-09) consumes. Now that they
 * exist as entities, `procurement_lots` CAN finally express its real dependencies
 * (cropId / varietyId / seasonId / centreId). Those edges are added in T-12's
 * full-graph pass, together with the deferred branchId edges — see the DAG notes in
 * entities/procurement.ts and entities/inventory.ts. Restore order is unaffected today:
 * none of those columns carries a database foreign key.
 *
 * `transporter` is gated on `transport`, everything else on `procurement_msp`, matching
 * moduleCatalog.ts.
 */
import type { ColumnDescriptor, EntityDescriptor } from '../registry.types';

const c = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  ({ key, header, headerHi, type: 'string', piiClass: 'none', defaultVisible: true, ...over });

const num = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { type: 'number', ...over });

const internal = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { defaultVisible: false, ...over });

const CAP = 'procurement_msp' as const;

/** Every marketing master carries these two timestamps. */
const stamps = (): ColumnDescriptor[] => [
  internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
];

const crop: EntityDescriptor = {
  key: 'procurement_crop',
  table: 'procurement_crops',
  domain: 'marketing',
  label: 'Crops',
  labelHi: 'फसलें',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['code'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('code', 'Crop Code', 'फसल कोड'),
    c('name', 'Crop Name', 'फसल नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    ...stamps(),
  ],
};

const variety: EntityDescriptor = {
  key: 'procurement_variety',
  table: 'procurement_varieties',
  domain: 'marketing',
  label: 'Varieties',
  labelHi: 'किस्में',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'procurement_crop'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('cropId', 'Crop', 'फसल'),
    c('name', 'Variety Name', 'किस्म नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    ...stamps(),
  ],
};

const season: EntityDescriptor = {
  key: 'procurement_season',
  table: 'procurement_seasons',
  domain: 'marketing',
  label: 'Seasons',
  labelHi: 'मौसम',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('name', 'Season Name', 'मौसम नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('cropYear', 'Crop Year', 'फसल वर्ष'),
    c('startDate', 'Start Date', 'प्रारंभ तिथि', { type: 'date' }),
    c('endDate', 'End Date', 'समाप्ति तिथि', { type: 'date' }),
    ...stamps(),
  ],
};

const agency: EntityDescriptor = {
  key: 'procurement_agency',
  table: 'procurement_agencies',
  domain: 'marketing',
  label: 'Procurement Agencies',
  labelHi: 'खरीद एजेंसियाँ',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['code'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('code', 'Agency Code', 'एजेंसी कोड'),
    c('name', 'Agency Name', 'एजेंसी नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('kind', 'Kind', 'प्रकार', { type: 'enum' }),
    num('commissionRate', 'Commission Rate %', 'कमीशन दर %'),
    ...stamps(),
  ],
};

const centre: EntityDescriptor = {
  key: 'procurement_centre',
  table: 'procurement_centres',
  domain: 'marketing',
  label: 'Procurement Centres',
  labelHi: 'खरीद केंद्र',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'procurement_agency'],
  naturalKey: ['code'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('code', 'Centre Code', 'केंद्र कोड'),
    c('name', 'Centre Name', 'केंद्र नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('agencyId', 'Agency', 'एजेंसी'),
    ...stamps(),
  ],
};

const mspRate: EntityDescriptor = {
  key: 'procurement_msp_rate',
  table: 'procurement_msp_rates',
  domain: 'marketing',
  label: 'MSP Rates',
  labelHi: 'एमएसपी दरें',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'procurement_crop', 'procurement_season'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('cropId', 'Crop', 'फसल'),
    c('seasonId', 'Season', 'मौसम'),
    internal('rate', 'Rate', 'दर', { type: 'json' }),
    c('effectiveFrom', 'Effective From', 'प्रभावी तिथि', { type: 'date' }),
    ...stamps(),
  ],
};

const deductionRule: EntityDescriptor = {
  key: 'procurement_deduction_rule',
  table: 'procurement_deduction_rules',
  domain: 'marketing',
  label: 'Deduction Rules',
  labelHi: 'कटौती नियम',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'account'],
  naturalKey: ['code'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('code', 'Rule Code', 'नियम कोड'),
    c('name', 'Rule Name', 'नियम नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('basis', 'Basis', 'आधार', { type: 'enum' }),
    internal('rate', 'Rate', 'दर', { type: 'json' }),
    internal('accountId', 'Ledger Account', 'बही खाता'),
    ...stamps(),
  ],
};

const qualitySpec: EntityDescriptor = {
  key: 'procurement_quality_spec',
  table: 'procurement_quality_specs',
  domain: 'marketing',
  label: 'Quality Specs',
  labelHi: 'गुणवत्ता मानक',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'procurement_crop', 'procurement_season'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('cropId', 'Crop', 'फसल'),
    c('seasonId', 'Season', 'मौसम'),
    c('parameter', 'Parameter', 'मापदंड'),
    num('maxLimit', 'Max Limit', 'अधिकतम सीमा'),
    ...stamps(),
  ],
};

const bardanaType: EntityDescriptor = {
  key: 'procurement_bardana_type',
  table: 'procurement_bardana_types',
  domain: 'marketing',
  label: 'Bardana Types',
  labelHi: 'बारदाना प्रकार',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('name', 'Bardana Name', 'बारदाना नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    num('capacityKg', 'Capacity (kg)', 'क्षमता (कि.ग्रा.)'),
    ...stamps(),
  ],
};

const transporter: EntityDescriptor = {
  key: 'marketing_transporter',
  table: 'marketing_transporters',
  domain: 'marketing',
  label: 'Transporters',
  labelHi: 'परिवहनकर्ता',
  capability: 'transport',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('name', 'Transporter Name', 'परिवहनकर्ता नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('vehicleNo', 'Vehicle No.', 'वाहन संख्या'),
    c('phone', 'Phone', 'फ़ोन', { piiClass: 'contact' }),
    num('ratePerQtl', 'Rate per Quintal', 'दर प्रति क्विंटल'),
    ...stamps(),
  ],
};

export const MARKETING_ENTITIES: EntityDescriptor[] = [
  crop, variety, season, agency, centre, mspRate,
  deductionRule, qualitySpec, bardanaType, transporter,
];
