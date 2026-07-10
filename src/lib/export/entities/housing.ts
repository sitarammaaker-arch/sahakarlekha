/**
 * Export Registry — housing cooperative entities (T-10).
 *
 * Declares: housing_buildings, housing_flats, housing_charge_heads, maintenance_bills,
 * housing_fund_investments, housing_complaints, housing_parking, housing_transfers,
 * housing_insurance, housing_amc, housing_documents.
 *
 * All eleven are gated on `housing`, matching moduleCatalog.ts exactly.
 *
 * PII. `housing_flats` carries its own nominee block (nomineeName / nomineeRelation /
 * nomineePhone) separate from the member register — the Share & Nomination Register is
 * printed from it. `nomineePhone` is one of the keys lib/auditLog.ts masks, so it must
 * be classified here too, or a redacted export would leak it.
 *
 * CACHE WARNING. `maintenance_bills.paidAmount` is a running total maintained beside the
 * receipt vouchers. Hidden by default (RULE 2), like every other cached total in the
 * registry.
 *
 * DAG NOTE. `housing_flats.buildingId` arrived via a later ALTER, so buildings must
 * restore before flats. Every other housing table hangs off a flat.
 */
import type { ColumnDescriptor, EntityDescriptor } from '../registry.types';

const c = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  ({ key, header, headerHi, type: 'string', piiClass: 'none', defaultVisible: true, ...over });

const money = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { type: 'currency', ...over });

const num = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { type: 'number', ...over });

const internal = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { defaultVisible: false, ...over });

const CAP = 'housing' as const;

/** Every housing table is soft-deleted and stamped; these two columns repeat verbatim. */
const trailer = (): ColumnDescriptor[] => [
  c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
  internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
];

// ─── housing_buildings ───────────────────────────────────────────────────────────────
const building: EntityDescriptor = {
  key: 'housing_building',
  table: 'housing_buildings',
  domain: 'housing',
  label: 'Buildings',
  labelHi: 'भवन',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('name', 'Building Name', 'भवन नाम'),
    c('address', 'Address', 'पता', { piiClass: 'contact' }),
    num('floors', 'Floors', 'मंज़िलें'),
    num('totalUnits', 'Total Units', 'कुल इकाइयाँ'),
    c('remarks', 'Remarks', 'टिप्पणी'),
    ...trailer(),
  ],
};

// ─── housing_flats ───────────────────────────────────────────────────────────────────
const flat: EntityDescriptor = {
  key: 'housing_flat',
  table: 'housing_flats',
  domain: 'housing',
  label: 'Flats',
  labelHi: 'फ्लैट',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'member', 'housing_building', 'account'],
  naturalKey: ['flatNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('flatNo', 'Flat No.', 'फ्लैट संख्या'),
    c('blockNo', 'Block No.', 'ब्लॉक संख्या'),
    internal('buildingId', 'Building', 'भवन'),
    internal('floor', 'Floor', 'मंज़िल', { type: 'number' }),
    internal('unitType', 'Unit Type', 'इकाई प्रकार', { type: 'enum' }),
    c('memberId', 'Owner (Member)', 'स्वामी (सदस्य)'),
    internal('associateMemberId', 'Associate Member', 'सह-सदस्य'),
    c('ownerType', 'Owner Type', 'स्वामित्व प्रकार', { type: 'enum' }),
    internal('occupancy', 'Occupancy', 'अधिभोग', { type: 'enum' }),
    num('area', 'Area', 'क्षेत्रफल'),
    money('monthlyMaintenance', 'Monthly Maintenance', 'मासिक रखरखाव'),
    c('registrationDate', 'Registration Date', 'पंजीकरण तिथि', { type: 'date' }),

    // Share block — printed on the Share & Nomination Register.
    c('shareCertNo', 'Share Certificate No.', 'अंश प्रमाणपत्र संख्या'),
    num('shareCount', 'Shares Held', 'अंशों की संख्या'),
    money('shareFaceValue', 'Face Value', 'अंकित मूल्य'),

    // Nomination block — flat-level, separate from the member register.
    c('nomineeName', 'Nominee Name', 'नामिती का नाम', { piiClass: 'contact' }),
    c('nomineeRelation', 'Nominee Relation', 'नामिती संबंध'),
    c('nomineePhone', 'Nominee Phone', 'नामिती फ़ोन', { piiClass: 'contact' }),

    internal('chargeOverrides', 'Charge Overrides', 'शुल्क अपवाद', { type: 'json' }),
    internal('receivableAccountId', 'Receivable Account', 'प्राप्य खाता'),
    ...trailer(),
  ],
};

// ─── housing_charge_heads ────────────────────────────────────────────────────────────
const chargeHead: EntityDescriptor = {
  key: 'housing_charge_head',
  table: 'housing_charge_heads',
  domain: 'housing',
  label: 'Charge Heads',
  labelHi: 'शुल्क शीर्षक',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'account'],
  naturalKey: ['code'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('code', 'Code', 'कोड'),
    c('nameEn', 'Name (English)', 'नाम (अंग्रेज़ी)'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    internal('kind', 'Kind', 'प्रकार', { type: 'enum' }),
    c('basis', 'Basis', 'आधार', { type: 'enum' }),
    num('rate', 'Rate', 'दर'),
    c('isFund', 'Is Fund', 'निधि है', { type: 'boolean' }),
    internal('gstable', 'GST Applicable', 'जीएसटी लागू', { type: 'boolean' }),
    internal('accountId', 'Ledger Account', 'बही खाता'),
    internal('order', 'Display Order', 'प्रदर्शन क्रम', { type: 'number' }),
    c('isActive', 'Active', 'सक्रिय', { type: 'boolean' }),
    ...trailer(),
  ],
};

// ─── maintenance_bills ───────────────────────────────────────────────────────────────
const maintenanceBill: EntityDescriptor = {
  key: 'maintenance_bill',
  table: 'maintenance_bills',
  domain: 'housing',
  label: 'Maintenance Bills',
  labelHi: 'रखरखाव बिल',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'housing_flat', 'member', 'account', 'voucher'],
  naturalKey: ['billNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('billNo', 'Bill No.', 'बिल संख्या'),
    c('flatId', 'Flat', 'फ्लैट'),
    c('flatNo', 'Flat No.', 'फ्लैट संख्या'),
    c('memberId', 'Member', 'सदस्य'),
    c('period', 'Period', 'अवधि'),
    c('date', 'Bill Date', 'बिल तिथि', { type: 'date' }),
    money('amount', 'Amount', 'राशि'),
    internal('paidAmount', 'Paid Amount (cached)', 'भुगतान राशि (कैश्ड)', { type: 'currency' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('lines', 'Bill Lines', 'बिल पंक्तियाँ', { type: 'json' }),
    internal('receivableAccountId', 'Receivable Account', 'प्राप्य खाता'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    ...trailer(),
  ],
};

// ─── housing_fund_investments ────────────────────────────────────────────────────────
const fundInvestment: EntityDescriptor = {
  key: 'housing_fund_investment',
  table: 'housing_fund_investments',
  domain: 'housing',
  label: 'Fund Investments',
  labelHi: 'निधि निवेश',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'account', 'voucher'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('instrument', 'Instrument', 'साधन', { type: 'enum' }),
    c('institution', 'Institution', 'संस्था'),
    money('amount', 'Amount', 'राशि'),
    c('date', 'Investment Date', 'निवेश तिथि', { type: 'date' }),
    c('maturityDate', 'Maturity Date', 'परिपक्वता तिथि', { type: 'date' }),
    num('interestRate', 'Interest Rate %', 'ब्याज दर %'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('fundAccountId', 'Fund Account', 'निधि खाता'),
    internal('investmentAccountId', 'Investment Account', 'निवेश खाता'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('redemptionVoucherId', 'Redemption Voucher', 'मोचन वाउचर'),
    ...trailer(),
  ],
};

// ─── housing_complaints ──────────────────────────────────────────────────────────────
const complaint: EntityDescriptor = {
  key: 'housing_complaint',
  table: 'housing_complaints',
  domain: 'housing',
  label: 'Complaints',
  labelHi: 'शिकायतें',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'housing_flat', 'member'],
  naturalKey: ['complaintNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('complaintNo', 'Complaint No.', 'शिकायत संख्या'),
    c('flatId', 'Flat', 'फ्लैट'),
    c('flatNo', 'Flat No.', 'फ्लैट संख्या'),
    c('memberId', 'Member', 'सदस्य'),
    c('category', 'Category', 'श्रेणी', { type: 'enum' }),
    c('title', 'Title', 'शीर्षक'),
    c('description', 'Description', 'विवरण'),
    c('raisedDate', 'Raised Date', 'दर्ज तिथि', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('resolution', 'Resolution', 'समाधान'),
    c('resolvedDate', 'Resolved Date', 'समाधान तिथि', { type: 'date' }),
    ...trailer(),
  ],
};

// ─── housing_parking ─────────────────────────────────────────────────────────────────
const parking: EntityDescriptor = {
  key: 'housing_parking',
  table: 'housing_parking',
  domain: 'housing',
  label: 'Parking Slots',
  labelHi: 'पार्किंग स्लॉट',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'housing_flat', 'member'],
  naturalKey: ['slotNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('slotNo', 'Slot No.', 'स्लॉट संख्या'),
    c('flatId', 'Flat', 'फ्लैट'),
    c('flatNo', 'Flat No.', 'फ्लैट संख्या'),
    c('memberId', 'Member', 'सदस्य'),
    c('vehicleType', 'Vehicle Type', 'वाहन प्रकार', { type: 'enum' }),
    c('vehicleNo', 'Vehicle No.', 'वाहन संख्या'),
    money('monthlyCharge', 'Monthly Charge', 'मासिक शुल्क'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    ...trailer(),
  ],
};

// ─── housing_transfers ───────────────────────────────────────────────────────────────
const transfer: EntityDescriptor = {
  key: 'housing_transfer',
  table: 'housing_transfers',
  domain: 'housing',
  label: 'Flat Transfers',
  labelHi: 'फ्लैट हस्तांतरण',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'housing_flat', 'member', 'voucher'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('flatId', 'Flat', 'फ्लैट'),
    c('flatNo', 'Flat No.', 'फ्लैट संख्या'),
    c('fromMemberId', 'From Member', 'हस्तांतरक सदस्य'),
    c('toMemberId', 'To Member', 'हस्तांतरिती सदस्य'),
    internal('transferType', 'Transfer Type', 'हस्तांतरण प्रकार', { type: 'enum' }),
    c('date', 'Transfer Date', 'हस्तांतरण तिथि', { type: 'date' }),
    money('transferFee', 'Transfer Fee', 'हस्तांतरण शुल्क'),
    money('premium', 'Premium', 'प्रीमियम'),
    c('resolutionNo', 'Resolution No.', 'संकल्प संख्या'),
    c('resolutionDate', 'Resolution Date', 'संकल्प तिथि', { type: 'date' }),
    c('remarks', 'Remarks', 'टिप्पणी'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    ...trailer(),
  ],
};

// ─── housing_insurance ───────────────────────────────────────────────────────────────
const insurance: EntityDescriptor = {
  key: 'housing_insurance',
  table: 'housing_insurance',
  domain: 'housing',
  label: 'Insurance Policies',
  labelHi: 'बीमा पॉलिसी',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['policyNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('policyNo', 'Policy No.', 'पॉलिसी संख्या'),
    c('insurer', 'Insurer', 'बीमाकर्ता'),
    c('coverageType', 'Coverage Type', 'कवरेज प्रकार', { type: 'enum' }),
    money('sumInsured', 'Sum Insured', 'बीमित राशि'),
    money('premium', 'Premium', 'प्रीमियम'),
    c('startDate', 'Start Date', 'प्रारंभ तिथि', { type: 'date' }),
    c('expiryDate', 'Expiry Date', 'समाप्ति तिथि', { type: 'date' }),
    c('remarks', 'Remarks', 'टिप्पणी'),
    ...trailer(),
  ],
};

// ─── housing_amc ─────────────────────────────────────────────────────────────────────
const amc: EntityDescriptor = {
  key: 'housing_amc',
  table: 'housing_amc',
  domain: 'housing',
  label: 'AMC Contracts',
  labelHi: 'एएमसी अनुबंध',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['contractNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('contractNo', 'Contract No.', 'अनुबंध संख्या'),
    c('vendor', 'Vendor', 'विक्रेता'),
    c('equipment', 'Equipment', 'उपकरण'),
    money('amount', 'Amount', 'राशि'),
    c('startDate', 'Start Date', 'प्रारंभ तिथि', { type: 'date' }),
    c('expiryDate', 'Expiry Date', 'समाप्ति तिथि', { type: 'date' }),
    c('remarks', 'Remarks', 'टिप्पणी'),
    ...trailer(),
  ],
};

// ─── housing_documents ───────────────────────────────────────────────────────────────
// NOTE: this table stores document METADATA. The underlying files are not backed up —
// attachment backup is an explicit non-goal of the blueprint (§13), deferred to v2.
const document: EntityDescriptor = {
  key: 'housing_document',
  table: 'housing_documents',
  domain: 'housing',
  label: 'Legal Documents',
  labelHi: 'वैधानिक दस्तावेज़',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('docType', 'Document Type', 'दस्तावेज़ प्रकार', { type: 'enum' }),
    c('title', 'Title', 'शीर्षक'),
    c('reference', 'Reference', 'संदर्भ'),
    c('authority', 'Authority', 'प्राधिकरण'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('expiryDate', 'Expiry Date', 'समाप्ति तिथि', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('remarks', 'Remarks', 'टिप्पणी'),
    ...trailer(),
  ],
};

export const HOUSING_ENTITIES: EntityDescriptor[] = [
  building, flat, chargeHead, maintenanceBill, fundInvestment,
  complaint, parking, transfer, insurance, amc, document,
];
