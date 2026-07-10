/**
 * Export Registry — MSP procurement engine (T-09).
 *
 * Declares the 12 tables owned by DataContext's procurement engine. The 10 procurement
 * MASTERS (crops, varieties, seasons, agencies, centres, msp_rates, deduction_rules,
 * quality_specs, bardana_types, marketing_transporters) belong to MarketingDataContext
 * and are declared in T-11.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * DELIBERATE DEVIATION FROM THE ROADMAP: posting_rule_results is `full`, NOT `replay`.
 *
 * ROADMAP-DATA-PORTABILITY T-09 classifies `procurement_posting_rule_results` as a
 * replay entity, by analogy with `voucher_entries`. The schema says otherwise.
 *
 *   voucher_entries  — a mechanical projection of vouchers.lines. Same input, same
 *                      output, forever. Safe to regenerate and assert.
 *   posting_rule_results — carries `profile` (which posting-rule profile was applied)
 *                      and `legs` (the ledger legs that profile PRODUCED). It is the
 *                      output of a VERSIONED rule engine, not a pure projection.
 *
 * If a society's posting profile changes — a new deduction head, a rerouted account —
 * replaying an old request under today's rules yields different legs than the ones that
 * actually hit the ledger years ago. The restore would then "assert" a trace that
 * contradicts the vouchers it sits beside, and pass.
 *
 * This is the SSOT audit trace (Payment → EngineVoucher → PostingRuleResult → jformId).
 * A trace you regenerate is not a trace. It is exported and restored VERBATIM.
 *
 * `voucher_entries` therefore remains the only `replay` entity in the registry.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * DAG NOTE. `procurement_lots` references crops / varieties / seasons / centres, which
 * are declared in T-11. Those edges are added when those entities exist; declaring them
 * now would point dependsOn at undeclared keys and fail validateRegistry.
 */
import type { ColumnDescriptor, EntityDescriptor } from '../registry.types';

const c = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  ({ key, header, headerHi, type: 'string', piiClass: 'none', defaultVisible: true, ...over });

const internal = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { defaultVisible: false, ...over });

const CAP = 'procurement_msp' as const;

// ─── procurement_farmers ─────────────────────────────────────────────────────────────
const farmer: EntityDescriptor = {
  key: 'procurement_farmer',
  table: 'procurement_farmers',
  domain: 'procurement',
  label: 'Farmers',
  labelHi: 'किसान',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['farmerCode'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('farmerCode', 'Farmer Code', 'किसान कोड'),
    c('farmerName', 'Farmer Name', 'किसान का नाम'),
    c('fatherName', 'Father Name', 'पिता का नाम'),
    c('mobile', 'Mobile', 'मोबाइल', { piiClass: 'contact' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── procurement_lots ────────────────────────────────────────────────────────────────
const lot: EntityDescriptor = {
  key: 'procurement_lot',
  table: 'procurement_lots',
  domain: 'procurement',
  label: 'Procurement Lots',
  labelHi: 'खरीद लॉट',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'procurement_farmer'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'Lot ID', 'लॉट आईडी'),
    c('farmerId', 'Farmer', 'किसान'),
    c('centreId', 'Centre', 'केंद्र'),
    c('seasonId', 'Season', 'मौसम'),
    c('cropId', 'Crop', 'फसल'),
    c('varietyId', 'Variety', 'किस्म'),
    internal('arhtiyaId', 'Arhtiya', 'आढ़तिया'),
    internal('quantity', 'Quantity', 'मात्रा', { type: 'json' }),
    internal('mspRate', 'MSP Rate', 'एमएसपी दर', { type: 'json' }),
    c('operationalStatus', 'Operational Status', 'परिचालन स्थिति', { type: 'enum' }),
    c('financialStatus', 'Financial Status', 'वित्तीय स्थिति', { type: 'enum' }),
    c('reconciliationStatus', 'Reconciliation Status', 'समाधान स्थिति', { type: 'enum' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── procurement_events ──────────────────────────────────────────────────────────────
// The engine's event stream. Business state, not audit evidence: the lots' lifecycle is
// reconstructed from it, so it restores like any other transaction table.
const event: EntityDescriptor = {
  key: 'procurement_event',
  table: 'procurement_events',
  domain: 'procurement',
  label: 'Procurement Events',
  labelHi: 'खरीद घटनाएँ',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('name', 'Event Name', 'घटना नाम'),
    c('correlationId', 'Correlation ID', 'सहसंबंध आईडी'),
    c('occurredAt', 'Occurred At', 'घटित समय', { type: 'date' }),
    internal('recordedAt', 'Recorded At', 'दर्ज समय', { type: 'date' }),
    c('actor', 'Actor', 'कर्ता'),
    internal('payload', 'Payload', 'पेलोड', { type: 'json' }),
  ],
};

// ─── procurement_quality_tests ───────────────────────────────────────────────────────
const qualityTest: EntityDescriptor = {
  key: 'procurement_quality_test',
  table: 'procurement_quality_tests',
  domain: 'procurement',
  label: 'Quality Tests',
  labelHi: 'गुणवत्ता परीक्षण',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'procurement_lot'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('lotId', 'Lot', 'लॉट'),
    c('result', 'Result', 'परिणाम', { type: 'enum' }),
    c('inspectedBy', 'Inspected By', 'निरीक्षक'),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── procurement_moisture_records ────────────────────────────────────────────────────
const moistureRecord: EntityDescriptor = {
  key: 'procurement_moisture_record',
  table: 'procurement_moisture_records',
  domain: 'procurement',
  label: 'Moisture Records',
  labelHi: 'नमी रिकॉर्ड',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'procurement_lot'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('lotId', 'Lot', 'लॉट'),
    c('moisture', 'Moisture', 'नमी', { type: 'json' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── procurement_jforms ──────────────────────────────────────────────────────────────
const jform: EntityDescriptor = {
  key: 'procurement_jform',
  table: 'procurement_jforms',
  domain: 'procurement',
  label: 'J-Forms',
  labelHi: 'जे-फॉर्म',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'procurement_lot'],
  naturalKey: ['documentNo'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('documentNo', 'J-Form No.', 'जे-फॉर्म संख्या'),
    c('lotId', 'Lot', 'लॉट'),
    internal('gross', 'Gross', 'सकल', { type: 'json' }),
    internal('deductions', 'Deductions', 'कटौतियाँ', { type: 'json' }),
    internal('net', 'Net', 'शुद्ध', { type: 'json' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── procurement_financial_intents ───────────────────────────────────────────────────
const financialIntent: EntityDescriptor = {
  key: 'procurement_financial_intent',
  table: 'procurement_financial_intents',
  domain: 'procurement',
  label: 'Financial Intents',
  labelHi: 'वित्तीय आशय',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'procurement_lot', 'procurement_jform'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('lotId', 'Lot', 'लॉट'),
    c('jformId', 'J-Form', 'जे-फॉर्म'),
    c('intentType', 'Intent Type', 'आशय प्रकार', { type: 'enum' }),
    internal('amount', 'Amount', 'राशि', { type: 'json' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── procurement_posting_requests ────────────────────────────────────────────────────
const postingRequest: EntityDescriptor = {
  key: 'procurement_posting_request',
  table: 'procurement_posting_requests',
  domain: 'procurement',
  label: 'Posting Requests',
  labelHi: 'पोस्टिंग अनुरोध',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'procurement_financial_intent'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('lotId', 'Lot', 'लॉट'),
    c('jformId', 'J-Form', 'जे-फॉर्म'),
    c('financialIntentId', 'Financial Intent', 'वित्तीय आशय'),
    c('requestType', 'Request Type', 'अनुरोध प्रकार', { type: 'enum' }),
    internal('amount', 'Amount', 'राशि', { type: 'json' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── procurement_posting_rule_results — FULL, not replay. See header. ────────────────
const postingRuleResult: EntityDescriptor = {
  key: 'procurement_posting_rule_result',
  table: 'procurement_posting_rule_results',
  domain: 'procurement',
  label: 'Posting Rule Results',
  labelHi: 'पोस्टिंग नियम परिणाम',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'procurement_posting_request'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('postingRequestId', 'Posting Request', 'पोस्टिंग अनुरोध'),
    c('lotId', 'Lot', 'लॉट'),
    c('jformId', 'J-Form', 'जे-फॉर्म'),
    c('financialIntentId', 'Financial Intent', 'वित्तीय आशय'),
    c('requestType', 'Request Type', 'अनुरोध प्रकार', { type: 'enum' }),
    // Which rule profile produced `legs`. This is exactly why the row cannot be replayed.
    c('profile', 'Rule Profile', 'नियम प्रोफ़ाइल'),
    internal('legs', 'Ledger Legs', 'बही पंक्तियाँ', { type: 'json' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── procurement_settlements ─────────────────────────────────────────────────────────
const settlement: EntityDescriptor = {
  key: 'procurement_settlement',
  table: 'procurement_settlements',
  domain: 'procurement',
  label: 'Farmer Settlements',
  labelHi: 'किसान भुगतान',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'procurement_jform', 'voucher'],
  naturalKey: ['settlementNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('settlementNo', 'Settlement No.', 'भुगतान संख्या'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('gross', 'Gross', 'सकल', { type: 'json' }),
    internal('deductionLines', 'Deduction Lines', 'कटौती पंक्तियाँ', { type: 'json' }),
    internal('netPayable', 'Net Payable', 'शुद्ध देय', { type: 'json' }),
    internal('amountPaid', 'Amount Paid', 'भुगतान राशि', { type: 'json' }),
    // The SSOT trace links: engine voucher, then the settlement voucher.
    c('engineVoucherId', 'Engine Voucher', 'इंजन वाउचर'),
    c('settlementVoucherId', 'Settlement Voucher', 'भुगतान वाउचर'),
    internal('approvedBy', 'Approved By', 'अनुमोदक'),
    internal('approvedAt', 'Approved At', 'अनुमोदन समय', { type: 'date' }),
    internal('createdBy', 'Created By', 'निर्माता'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── counters ────────────────────────────────────────────────────────────────────────
// One row per society; `society_id` IS the primary key here, not tenant scoping. These
// hold the last issued J-Form / settlement number. If a restore drops them, numbering
// restarts at 1 and the society re-issues document numbers that already exist. They are
// small, they are boring, and forgetting them corrupts a statutory document series.
const jformCounter: EntityDescriptor = {
  key: 'procurement_jform_counter',
  table: 'procurement_jform_counters',
  domain: 'procurement',
  label: 'J-Form Counter',
  labelHi: 'जे-फॉर्म काउंटर',
  capability: CAP,
  minRole: 'admin',
  scope: 'society',
  nature: 'system',
  dependsOn: ['society'],
  naturalKey: ['society_id'],
  formats: ['json'],
  backupPolicy: 'full',
  columns: [
    c('society_id', 'Society', 'समिति'),
    c('last_no', 'Last Issued No.', 'अंतिम जारी संख्या', { type: 'number' }),
  ],
};

const settlementCounter: EntityDescriptor = {
  key: 'procurement_settlement_counter',
  table: 'procurement_settlement_counters',
  domain: 'procurement',
  label: 'Settlement Counter',
  labelHi: 'भुगतान काउंटर',
  capability: CAP,
  minRole: 'admin',
  scope: 'society',
  nature: 'system',
  dependsOn: ['society'],
  naturalKey: ['society_id'],
  formats: ['json'],
  backupPolicy: 'full',
  columns: [
    c('society_id', 'Society', 'समिति'),
    c('last_no', 'Last Issued No.', 'अंतिम जारी संख्या', { type: 'number' }),
  ],
};

export const PROCUREMENT_ENTITIES: EntityDescriptor[] = [
  farmer, lot, event, qualityTest, moistureRecord, jform,
  financialIntent, postingRequest, postingRuleResult, settlement,
  jformCounter, settlementCounter,
];
