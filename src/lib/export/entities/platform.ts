/**
 * Export Registry — assets, compliance, governance, evidence, system (T-11).
 *
 * This file completes the registry. It is deliberately a multi-domain file: what unites
 * these tables is not a business domain but a CUSTODY decision. Three of the four
 * backup policies appear here for the first time, and each one is a promise about what
 * leaves the database.
 *
 *   full     — assets, compliance/tax, governance registers. Ordinary society data.
 *   sidecar  — audit_log, guide_certificates. Immutable EVIDENCE. Exported so a society
 *              can hand its non-repudiable trail to an auditor; NEVER restored, because
 *              writing rows back into a WORM log forges history. The restore emits one
 *              `restore` event instead (blueprint §6.5).
 *   exclude  — secrets, credentials and cross-tenant registries. These never leave the
 *              database in any format. `formats: []` makes them unreachable from every
 *              export path, and validateRegistry fails the build if anyone adds one.
 *
 * WHY society_capabilities IS EXCLUDED. Capabilities are ENTITLEMENT. Per the source
 * trust model in navigation/capabilities.ts, only server/service-role code may write a
 * `grant` — plan, plugin, state, trial, system. A restorable capabilities table would
 * let a society re-grant itself paid capabilities by editing a JSON file and restoring
 * it. The server re-derives entitlement after a restore; losing the rows is correct.
 *
 * ASSETS. `assets` has no natural home in the domain taxonomy — it is the fixed asset
 * register, a core accounting register. It is declared with domain 'core' and lives here
 * only because the file budget for T-11 would not stretch to a fourth entities file.
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

// ═══ CORE REGISTER ═══════════════════════════════════════════════════════════════════

// Soft-deleted since ECR-02.
const asset: EntityDescriptor = {
  key: 'asset',
  table: 'assets',
  domain: 'core',
  label: 'Fixed Assets',
  labelHi: 'स्थायी संपत्ति',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'voucher'],
  naturalKey: ['assetNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('assetNo', 'Asset No.', 'संपत्ति संख्या'),
    c('name', 'Asset Name', 'संपत्ति नाम'),
    c('category', 'Category', 'श्रेणी', { type: 'enum' }),
    c('purchaseDate', 'Purchase Date', 'क्रय तिथि', { type: 'date' }),
    money('cost', 'Cost', 'लागत'),
    num('depreciationRate', 'Depreciation Rate %', 'मूल्यह्रास दर %'),
    c('depreciationMethod', 'Depreciation Method', 'मूल्यह्रास विधि', { type: 'enum' }),
    num('usefulLife', 'Useful Life (years)', 'उपयोगी आयु (वर्ष)'),
    money('residualValue', 'Residual Value', 'अवशिष्ट मूल्य'),
    c('location', 'Location', 'स्थान'),
    c('description', 'Description', 'विवरण'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('disposalDate', 'Disposal Date', 'निपटान तिथि', { type: 'date' }),
    money('saleProceeds', 'Sale Proceeds', 'विक्रय आय'),
    internal('depreciationPostedFY', 'Depreciation Posted FY', 'मूल्यह्रास पोस्ट वर्ष'),
    internal('acquisitionVoucherId', 'Acquisition Voucher', 'अधिग्रहण वाउचर'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
  ],
};

// ═══ COMPLIANCE & TAX ════════════════════════════════════════════════════════════════

const bankReconciliation: EntityDescriptor = {
  key: 'bank_reconciliation',
  table: 'bank_reconciliations',
  domain: 'compliance',
  label: 'Bank Reconciliations',
  labelHi: 'बैंक समाधान',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'account'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('bankAccountId', 'Bank Account', 'बैंक खाता'),
    c('bankAccountName', 'Bank Account Name', 'बैंक खाता नाम'),
    c('asOfDate', 'As On Date', 'तिथि तक', { type: 'date' }),
    money('statementBalance', 'Statement Balance', 'विवरण शेष'),
    money('bookBalance', 'Book Balance', 'बही शेष'),
    money('unclearedDepositsTotal', 'Uncleared Deposits', 'अनक्लियर जमा'),
    money('unclearedPaymentsTotal', 'Uncleared Payments', 'अनक्लियर भुगतान'),
    internal('unclearedDepositIds', 'Uncleared Deposit IDs', 'अनक्लियर जमा आईडी', { type: 'json' }),
    internal('unclearedPaymentIds', 'Uncleared Payment IDs', 'अनक्लियर भुगतान आईडी', { type: 'json' }),
    money('difference', 'Difference', 'अंतर'),
    c('isReconciled', 'Reconciled', 'समाधानित', { type: 'boolean' }),
    internal('reconciledBy', 'Reconciled By', 'समाधानकर्ता'),
    internal('reconciledAt', 'Reconciled At', 'समाधान समय', { type: 'date' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
  ],
};

// `deducteePan` is one of the keys lib/auditLog.ts masks — it MUST be classified.
const tdsEntry: EntityDescriptor = {
  key: 'tds_entry',
  table: 'tds_entries',
  domain: 'compliance',
  label: 'TDS Entries',
  labelHi: 'टीडीएस प्रविष्टियाँ',
  capability: 'tds',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'voucher', 'purchase', 'tds_challan'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('deducteeName', 'Deductee Name', 'कटौती-अधीन का नाम'),
    c('deducteePan', 'Deductee PAN', 'कटौती-अधीन पैन', { piiClass: 'identity' }),
    c('deducteeType', 'Deductee Type', 'कटौती-अधीन प्रकार', { type: 'enum' }),
    c('section', 'TDS Section', 'टीडीएस धारा'),
    c('natureOfPayment', 'Nature of Payment', 'भुगतान की प्रकृति'),
    money('grossAmount', 'Gross Amount', 'सकल राशि'),
    num('tdsRate', 'TDS Rate %', 'टीडीएस दर %'),
    money('tdsAmount', 'TDS Amount', 'टीडीएस राशि'),
    c('quarter', 'Quarter', 'तिमाही'),
    c('financialYear', 'Financial Year', 'वित्तीय वर्ष'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('challanId', 'Challan', 'चालान'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('purchaseId', 'Purchase', 'खरीद'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

const tdsChallan: EntityDescriptor = {
  key: 'tds_challan',
  table: 'tds_challans',
  domain: 'compliance',
  label: 'TDS Challans',
  labelHi: 'टीडीएस चालान',
  capability: 'tds',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('bsrCode', 'BSR Code', 'बीएसआर कोड'),
    c('challanDate', 'Challan Date', 'चालान तिथि', { type: 'date' }),
    c('challanSerial', 'Challan Serial', 'चालान क्रमांक'),
    money('amount', 'Amount', 'राशि'),
    c('bankName', 'Bank Name', 'बैंक नाम'),
    c('quarter', 'Quarter', 'तिमाही'),
    c('financialYear', 'Financial Year', 'वित्तीय वर्ष'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// No surrogate id: the primary key is (society_id, entryId), so society_id is identity
// here, not tenant scoping — the same exception the procurement counters carry.
const tdsChallanLink: EntityDescriptor = {
  key: 'tds_challan_link',
  table: 'tds_challan_links',
  domain: 'compliance',
  label: 'TDS Challan Links',
  labelHi: 'टीडीएस चालान लिंक',
  capability: 'tds',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'tds_entry', 'tds_challan'],
  naturalKey: ['society_id', 'entryId'],
  formats: ['csv', 'json'],
  backupPolicy: 'full',
  columns: [
    c('society_id', 'Society', 'समिति'),
    c('entryId', 'TDS Entry', 'टीडीएस प्रविष्टि'),
    c('challanId', 'Challan', 'चालान'),
  ],
};

const ewayBill: EntityDescriptor = {
  key: 'eway_bill',
  table: 'eway_bills',
  domain: 'compliance',
  label: 'e-Way Bills',
  labelHi: 'ई-वे बिल',
  capability: 'gst',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['docNo'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('type', 'Type', 'प्रकार', { type: 'enum' }),
    c('docNo', 'Document No.', 'दस्तावेज़ संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('partyName', 'Party Name', 'पक्षकार नाम'),
    c('partyGst', 'Party GSTIN', 'पक्षकार जीएसटीआईएन', { piiClass: 'identity' }),
    internal('items', 'Line Items', 'पंक्ति आइटम', { type: 'json' }),
    money('totalTaxable', 'Total Taxable', 'कुल कर योग्य'),
    money('totalGst', 'Total GST', 'कुल जीएसटी'),
    money('grandTotal', 'Grand Total', 'महायोग'),
    c('transportMode', 'Transport Mode', 'परिवहन माध्यम', { type: 'enum' }),
    c('vehicleNo', 'Vehicle No.', 'वाहन संख्या'),
    num('distance', 'Distance (km)', 'दूरी (कि.मी.)'),
    c('ewbNo', 'EWB No.', 'ईडब्ल्यूबी संख्या'),
    internal('transporterName', 'Transporter Name', 'परिवहनकर्ता नाम'),
    internal('transporterGstin', 'Transporter GSTIN', 'परिवहनकर्ता जीएसटीआईएन', { piiClass: 'identity' }),
    internal('transDocNo', 'Transport Doc No.', 'परिवहन दस्तावेज़ संख्या'),
    internal('transDocDate', 'Transport Doc Date', 'परिवहन दस्तावेज़ तिथि', { type: 'date' }),
  ],
};

const complianceFiling: EntityDescriptor = {
  key: 'compliance_filing',
  table: 'compliance_filings',
  domain: 'compliance',
  label: 'Compliance Filings',
  labelHi: 'अनुपालन फाइलिंग',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('itemId', 'Compliance Item', 'अनुपालन मद'),
    c('filedAt', 'Filed At', 'फाइल तिथि', { type: 'date' }),
    c('filedBy', 'Filed By', 'फाइलकर्ता'),
    c('note', 'Note', 'टिप्पणी'),
  ],
};

// ─── T-12: the three tables that had no DDL until now ────────────────────────────────
// DataContext has always read and written these; their schema existed only in whichever
// database someone hand-created them in. T-12 writes it down (supabase-tables.sql) and
// declares them here, so the drift detector can never lose them again.
//
// NO softDeleteField, deliberately. `recoverables` and `kachi_aarat_entries` carry an
// `isDeleted` column, but DataContext HARD-deletes all three (`.delete()`). Declaring a
// softDeleteField would tell the exporter to filter on a flag nothing ever sets, and
// would tell a reader these rows survive deletion. They do not. This is a live RULE 5
// gap, recorded here rather than papered over.

const recoverable: EntityDescriptor = {
  key: 'recoverable',
  table: 'recoverables',
  domain: 'compliance',
  label: 'Recoverables Register',
  labelHi: 'वसूली रजिस्टर',
  capability: 'haryana_compliance',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('partyName', 'Party Name', 'पक्षकार नाम'),
    c('category', 'Category', 'श्रेणी', { type: 'enum' }),
    c('legalStage', 'Legal Stage', 'कानूनी चरण', { type: 'enum' }),
    money('openingBalance', 'Opening Balance', 'प्रारंभिक शेष'),
    money('additions', 'Additions', 'वृद्धि'),
    money('recoveries', 'Recoveries', 'वसूली'),
    c('fyStartDate', 'FY Start Date', 'वित्तीय वर्ष प्रारंभ', { type: 'date' }),
    c('narration', 'Narration', 'विवरण'),
    internal('isDeleted', 'Deleted (unused — rows are hard-deleted)', 'हटाया गया (अप्रयुक्त)', { type: 'boolean' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

const kachiAaratEntry: EntityDescriptor = {
  key: 'kachi_aarat_entry',
  table: 'kachi_aarat_entries',
  domain: 'compliance',
  label: 'Kachi Aarat Register',
  labelHi: 'कच्ची आढ़त रजिस्टर',
  capability: 'haryana_compliance',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('fyStartDate', 'FY Start Date', 'वित्तीय वर्ष प्रारंभ', { type: 'date' }),
    c('crop', 'Crop', 'फसल', { type: 'enum' }),
    c('partyName', 'Farmer / Party', 'किसान / पक्षकार'),
    money('businessValue', 'Business Value', 'व्यापार मूल्य'),
    money('damiEarned', 'Dami Earned', 'दामी आय'),
    c('narration', 'Narration', 'विवरण'),
    internal('isDeleted', 'Deleted (unused — rows are hard-deleted)', 'हटाया गया (अप्रयुक्त)', { type: 'boolean' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

const p7Entry: EntityDescriptor = {
  key: 'p7_entry',
  table: 'p7_entries',
  domain: 'compliance',
  label: 'P-7 Annual Review Data',
  labelHi: 'पी-7 वार्षिक समीक्षा डेटा',
  capability: 'haryana_compliance',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['fyStartDate'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('fyStartDate', 'FY Start Date', 'वित्तीय वर्ष प्रारंभ', { type: 'date' }),
    num('rentedGodownCount', 'Rented Godowns', 'किराए के गोदाम'),
    num('rentedCapacityMT', 'Rented Capacity (MT)', 'किराए की क्षमता (मी.टन)'),
    money('godownRentPaid', 'Godown Rent Paid', 'गोदाम किराया भुगतान'),
    num('truckCount', 'Trucks Operated', 'संचालित ट्रक'),
    money('transportChargesPaid', 'Transport Charges Paid', 'परिवहन शुल्क भुगतान'),
    money('sugarCattleFeedSales', 'Sugar / Cattle Feed Sales', 'चीनी / पशु आहार बिक्री'),
    money('consumerProductSales', 'Consumer Product Sales', 'उपभोक्ता उत्पाद बिक्री'),
    c('narration', 'Narration', 'विवरण'),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ═══ GOVERNANCE ══════════════════════════════════════════════════════════════════════

const budget: EntityDescriptor = {
  key: 'budget',
  table: 'budgets',
  domain: 'governance',
  label: 'Budgets',
  labelHi: 'बजट',
  minRole: 'accountant',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['financialYear'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('financialYear', 'Financial Year', 'वित्तीय वर्ष'),
    internal('heads', 'Budget Heads', 'बजट शीर्षक', { type: 'json' }),
    internal('approvedBy', 'Approved By', 'अनुमोदक'),
    internal('approvedAt', 'Approved At', 'अनुमोदन समय', { type: 'date' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('createdBy', 'Created By', 'निर्माता'),
  ],
};

const auditObjection: EntityDescriptor = {
  key: 'audit_objection',
  table: 'audit_objections',
  domain: 'governance',
  label: 'Audit Objections',
  labelHi: 'ऑडिट आपत्तियाँ',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['objectionNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('objectionNo', 'Objection No.', 'आपत्ति संख्या'),
    c('auditYear', 'Audit Year', 'ऑडिट वर्ष'),
    c('paraNo', 'Para No.', 'पैरा संख्या'),
    c('category', 'Category', 'श्रेणी', { type: 'enum' }),
    c('objection', 'Objection', 'आपत्ति'),
    money('amountInvolved', 'Amount Involved', 'संलग्न राशि'),
    c('dueDate', 'Due Date', 'देय तिथि', { type: 'date' }),
    c('actionTaken', 'Action Taken', 'की गई कार्रवाई'),
    c('rectifiedDate', 'Rectified Date', 'सुधार तिथि', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('remarks', 'Remarks', 'टिप्पणी'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

const meeting: EntityDescriptor = {
  key: 'meeting',
  table: 'meeting_register',
  domain: 'governance',
  label: 'Meeting Register',
  labelHi: 'बैठक रजिस्टर',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['meetingNo'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('meetingNo', 'Meeting No.', 'बैठक संख्या'),
    c('type', 'Meeting Type', 'बैठक प्रकार', { type: 'enum' }),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('time', 'Time', 'समय'),
    c('venue', 'Venue', 'स्थान'),
    c('agenda', 'Agenda', 'कार्यसूची'),
    c('attendees', 'Attendees', 'उपस्थित'),
    c('resolutions', 'Resolutions', 'संकल्प'),
    c('minutes', 'Minutes', 'कार्यवृत्त'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

const election: EntityDescriptor = {
  key: 'election',
  table: 'elections',
  domain: 'governance',
  label: 'Elections',
  labelHi: 'चुनाव',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'member'],
  naturalKey: ['electionNo'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('electionNo', 'Election No.', 'चुनाव संख्या'),
    c('title', 'Title', 'शीर्षक'),
    c('post', 'Post', 'पद'),
    c('electionDate', 'Election Date', 'चुनाव तिथि', { type: 'date' }),
    c('nominationDeadline', 'Nomination Deadline', 'नामांकन अंतिम तिथि', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('candidates', 'Candidates', 'उम्मीदवार', { type: 'json' }),
    num('totalVoters', 'Total Voters', 'कुल मतदाता'),
    num('votesCast', 'Votes Cast', 'डाले गए मत'),
    c('winnerId', 'Winner', 'विजेता'),
    c('remarks', 'Remarks', 'टिप्पणी'),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('createdBy', 'Created By', 'निर्माता'),
  ],
};

// ═══ EVIDENCE — exported for custody, NEVER restored ═════════════════════════════════

// WORM. INSERT + SELECT policies only; no UPDATE, no DELETE. A restore that wrote rows
// back into this table would fabricate a non-repudiable trail. nature 'evidence' forces
// backupPolicy 'sidecar' via validateRegistry.
const auditLog: EntityDescriptor = {
  key: 'audit_log',
  table: 'audit_log',
  domain: 'evidence',
  label: 'Audit Log',
  labelHi: 'ऑडिट लॉग',
  minRole: 'admin',
  scope: 'society',
  nature: 'evidence',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'json'],
  backupPolicy: 'sidecar',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('created_at', 'When', 'कब', { type: 'date' }),
    c('actor_name', 'Actor', 'कर्ता'),
    c('actor_email', 'Actor Email', 'कर्ता ईमेल', { piiClass: 'contact' }),
    c('actor_role', 'Actor Role', 'कर्ता भूमिका'),
    c('entity_type', 'Entity Type', 'इकाई प्रकार'),
    c('entity_id', 'Entity ID', 'इकाई आईडी'),
    c('action', 'Action', 'क्रिया', { type: 'enum' }),
    internal('before', 'Before', 'पूर्व', { type: 'json' }),
    internal('after', 'After', 'पश्चात', { type: 'json' }),
    c('reason', 'Reason', 'कारण'),
    internal('source', 'Source', 'स्रोत'),
  ],
};

const guideCertificate: EntityDescriptor = {
  key: 'guide_certificate',
  table: 'guide_certificates',
  domain: 'evidence',
  label: 'Guide Certificates',
  labelHi: 'गाइड प्रमाणपत्र',
  minRole: 'admin',
  scope: 'society',
  nature: 'evidence',
  dependsOn: [],
  naturalKey: ['cert_no'],
  formats: ['csv', 'json'],
  backupPolicy: 'sidecar',
  columns: [
    c('cert_no', 'Certificate No.', 'प्रमाणपत्र संख्या'),
    c('holder_name', 'Holder Name', 'धारक नाम'),
    c('email', 'Email', 'ईमेल', { piiClass: 'contact' }),
    c('society_name', 'Society Name', 'समिति नाम'),
    num('parts_passed', 'Parts Passed', 'उत्तीर्ण भाग'),
    c('issued_at', 'Issued At', 'जारी तिथि', { type: 'date' }),
  ],
};

// ═══ SYSTEM — never leaves the database ══════════════════════════════════════════════
// `formats: []` makes these unreachable from every export path. validateRegistry fails
// the build if a format is ever added to an `exclude` entity.

const societies: EntityDescriptor = {
  key: 'societies',
  table: 'societies',
  domain: 'system',
  label: 'Societies Registry',
  labelHi: 'समिति रजिस्ट्री',
  minRole: 'admin',
  scope: 'global',
  nature: 'system',
  dependsOn: [],
  naturalKey: ['registration_no'],
  formats: [],
  backupPolicy: 'exclude',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('registration_no', 'Registration No.', 'पंजीकरण संख्या'),
    c('name', 'Name', 'नाम'),
  ],
};

// Contains `password` and `mfa_secret`. Credentials never leave.
const societyUsers: EntityDescriptor = {
  key: 'society_user',
  table: 'society_users',
  domain: 'system',
  label: 'Society Users',
  labelHi: 'समिति उपयोगकर्ता',
  minRole: 'admin',
  scope: 'society',
  nature: 'system',
  dependsOn: [],
  naturalKey: ['email'],
  formats: [],
  backupPolicy: 'exclude',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('email', 'Email', 'ईमेल', { piiClass: 'contact' }),
    c('password', 'Password Hash', 'पासवर्ड हैश', { piiClass: 'identity', defaultVisible: false }),
    c('mfa_secret', 'MFA Secret', 'एमएफए सीक्रेट', { piiClass: 'identity', defaultVisible: false }),
    c('role', 'Role', 'भूमिका', { type: 'enum' }),
  ],
};

// Entitlement, not data. See the header note.
const societyCapabilities: EntityDescriptor = {
  key: 'society_capability',
  table: 'society_capabilities',
  domain: 'system',
  label: 'Society Capabilities',
  labelHi: 'समिति क्षमताएँ',
  minRole: 'admin',
  scope: 'society',
  nature: 'system',
  dependsOn: [],
  naturalKey: ['id'],
  formats: [],
  backupPolicy: 'exclude',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('capability', 'Capability', 'क्षमता'),
    c('mode', 'Mode', 'विधि', { type: 'enum' }),
    c('source', 'Source', 'स्रोत', { type: 'enum' }),
  ],
};

const platformAdmins: EntityDescriptor = {
  key: 'platform_admin',
  table: 'platform_admins',
  domain: 'system',
  label: 'Platform Admins',
  labelHi: 'प्लेटफ़ॉर्म व्यवस्थापक',
  minRole: 'admin',
  scope: 'global',
  nature: 'system',
  dependsOn: [],
  naturalKey: ['email'],
  formats: [],
  backupPolicy: 'exclude',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('email', 'Email', 'ईमेल', { piiClass: 'contact' }),
    c('name', 'Name', 'नाम'),
  ],
};

const userMfa: EntityDescriptor = {
  key: 'user_mfa',
  table: 'user_mfa',
  domain: 'system',
  label: 'User MFA',
  labelHi: 'उपयोगकर्ता एमएफए',
  minRole: 'admin',
  scope: 'global',
  nature: 'system',
  dependsOn: [],
  naturalKey: ['email'],
  formats: [],
  backupPolicy: 'exclude',
  columns: [
    c('email', 'Email', 'ईमेल', { piiClass: 'contact' }),
    c('secret', 'TOTP Secret', 'टीओटीपी सीक्रेट', { piiClass: 'identity', defaultVisible: false }),
  ],
};

const userMfaRecovery: EntityDescriptor = {
  key: 'user_mfa_recovery',
  table: 'user_mfa_recovery',
  domain: 'system',
  label: 'User MFA Recovery Codes',
  labelHi: 'एमएफए रिकवरी कोड',
  minRole: 'admin',
  scope: 'global',
  nature: 'system',
  dependsOn: [],
  naturalKey: ['id'],
  formats: [],
  backupPolicy: 'exclude',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('email', 'Email', 'ईमेल', { piiClass: 'contact' }),
    c('code_hash', 'Recovery Code Hash', 'रिकवरी कोड हैश', { piiClass: 'identity', defaultVisible: false }),
  ],
};

export const PLATFORM_ENTITIES: EntityDescriptor[] = [
  asset,
  bankReconciliation, tdsEntry, tdsChallan, tdsChallanLink, ewayBill, complianceFiling,
  recoverable, kachiAaratEntry, p7Entry,
  budget, auditObjection, meeting, election,
  auditLog, guideCertificate,
  societies, societyUsers, societyCapabilities, platformAdmins, userMfa, userMfaRecovery,
];
