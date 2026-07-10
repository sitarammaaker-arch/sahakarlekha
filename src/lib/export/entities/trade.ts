/**
 * Export Registry — trade entities (T-07).
 *
 * Declares: suppliers, customers, sales, purchases, sales_returns, purchase_returns,
 * hsn_master.
 *
 * SCOPE CORRECTION. The blueprint assumed `hsn_master` was global reference data.
 * It is not — the table carries `society_id`, so it is declared `scope: 'society'` and
 * belongs in a society backup like any other row.
 *
 * ROLE NOTE. `suppliers` and `customers` are the only entities here that require
 * `accountant`. They carry bank account numbers, IFSC codes, PAN and GSTIN — a payments
 * dataset, not a trade listing. A viewer can export the sale/purchase registers that
 * reference them without ever seeing the beneficiary bank details.
 *
 * SCHEMA HAZARD. `suppliers` and `customers` are each declared TWICE in
 * supabase-tables.sql (the second `create table if not exists` is a no-op, and the two
 * bodies disagree — the second drops `not null` on name, and customers' second body
 * omits `gstNo`). Harmless today; flagged for T-12 to resolve.
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

/** Tax + total columns shared verbatim by sales and purchases. */
const taxColumns = (): ColumnDescriptor[] => [
  money('totalAmount', 'Total Amount', 'कुल राशि'),
  money('discount', 'Discount', 'छूट'),
  money('netAmount', 'Net Amount', 'शुद्ध राशि'),
  internal('cgstPct', 'CGST %', 'सीजीएसटी %', { type: 'number' }),
  internal('sgstPct', 'SGST %', 'एसजीएसटी %', { type: 'number' }),
  internal('igstPct', 'IGST %', 'आईजीएसटी %', { type: 'number' }),
  money('cgstAmount', 'CGST', 'सीजीएसटी'),
  money('sgstAmount', 'SGST', 'एसजीएसटी'),
  money('igstAmount', 'IGST', 'आईजीएसटी'),
  internal('tdsPct', 'TDS %', 'टीडीएस %', { type: 'number' }),
  money('tdsAmount', 'TDS', 'टीडीएस'),
  money('taxAmount', 'Total Tax', 'कुल कर'),
  money('grandTotal', 'Grand Total', 'महायोग'),
];

/** Bank + statutory identity columns shared by suppliers and customers. */
const partyColumns = (codeKey: string, codeHeader: string, codeHeaderHi: string): ColumnDescriptor[] => [
  c('id', 'ID', 'आईडी', { defaultVisible: false }),
  c(codeKey, codeHeader, codeHeaderHi),
  c('name', 'Name', 'नाम'),
  c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
  internal('legalName', 'Legal Name', 'वैधानिक नाम'),
  internal('tradeName', 'Trade Name', 'व्यापारिक नाम'),
  internal('mailingName', 'Mailing Name', 'डाक नाम'),

  c('address', 'Address', 'पता', { piiClass: 'contact' }),
  internal('addressLine1', 'Address Line 1', 'पता पंक्ति 1', { piiClass: 'contact' }),
  internal('addressLine2', 'Address Line 2', 'पता पंक्ति 2', { piiClass: 'contact' }),
  c('city', 'City', 'शहर'),
  c('state', 'State', 'राज्य'),
  internal('country', 'Country', 'देश'),
  internal('pincode', 'PIN Code', 'पिन कोड'),

  c('phone', 'Phone', 'फ़ोन', { piiClass: 'contact' }),
  internal('mobile', 'Mobile', 'मोबाइल', { piiClass: 'contact' }),
  internal('landline', 'Landline', 'लैंडलाइन', { piiClass: 'contact' }),
  c('email', 'Email', 'ईमेल', { piiClass: 'contact' }),
  internal('website', 'Website', 'वेबसाइट'),
  internal('contactPerson', 'Contact Person', 'संपर्क व्यक्ति', { piiClass: 'contact' }),
  internal('contactDesignation', 'Designation', 'पदनाम'),

  c('gstin', 'GSTIN', 'जीएसटीआईएन', { piiClass: 'identity' }),
  c('pan', 'PAN', 'पैन', { piiClass: 'identity' }),
  internal('registrationType', 'GST Registration Type', 'जीएसटी पंजीकरण प्रकार', { type: 'enum' }),
  internal('placeOfSupply', 'Place of Supply', 'आपूर्ति स्थान'),

  // Payments dataset — this is why these two entities require `accountant`.
  internal('bankName', 'Bank Name', 'बैंक नाम', { piiClass: 'financial' }),
  internal('accountNo', 'Bank Account No.', 'बैंक खाता संख्या', { piiClass: 'financial' }),
  internal('ifsc', 'IFSC', 'आईएफ़एससी', { piiClass: 'financial' }),
  internal('branch', 'Bank Branch', 'बैंक शाखा', { piiClass: 'financial' }),
  // NOTE: `beneficiaryName` exists on suppliers ONLY — declared on that entity, not here.
  internal('upiId', 'UPI ID', 'यूपीआई आईडी', { piiClass: 'financial' }),

  internal('accountId', 'Ledger Account', 'बही खाता'),
  money('openingBalance', 'Opening Balance', 'ओपनिंग बैलेंस'),
  internal('openingBalanceType', 'Dr / Cr', 'नामे / जमा', { type: 'enum' }),
  internal('creditDays', 'Credit Days', 'उधार दिन', { type: 'number' }),
  internal('creditLimit', 'Credit Limit', 'उधार सीमा', { type: 'currency' }),
  internal('discountPercent', 'Discount %', 'छूट %', { type: 'number' }),
  internal('tdsApplicable', 'TDS Applicable', 'टीडीएस लागू', { type: 'boolean' }),
  internal('tcsApplicable', 'TCS Applicable', 'टीसीएस लागू', { type: 'boolean' }),
  internal('notes', 'Notes', 'टिप्पणी'),
  c('isActive', 'Active', 'सक्रिय', { type: 'boolean' }),
  internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
];

// ─── suppliers ───────────────────────────────────────────────────────────────────────
const supplier: EntityDescriptor = {
  key: 'supplier',
  table: 'suppliers',
  domain: 'trade',
  label: 'Suppliers',
  labelHi: 'आपूर्तिकर्ता',
  minRole: 'accountant',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'account'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    ...partyColumns('supplierCode', 'Supplier Code', 'आपूर्तिकर्ता कोड'),
    // Supplier-only bank column (customers have no beneficiaryName in the schema).
    internal('beneficiaryName', 'Beneficiary Name', 'लाभार्थी नाम', { piiClass: 'financial' }),
    internal('supplierType', 'Supplier Type', 'आपूर्तिकर्ता प्रकार', { type: 'enum' }),
    internal('tdsSection', 'TDS Section', 'टीडीएस धारा'),
    internal('salesRep', 'Sales Rep', 'विक्रय प्रतिनिधि'),
    internal('gstNo', 'GST No. (legacy)', 'जीएसटी संख्या (पुराना)', { piiClass: 'identity' }),
  ],
};

// ─── customers ───────────────────────────────────────────────────────────────────────
const customer: EntityDescriptor = {
  key: 'customer',
  table: 'customers',
  domain: 'trade',
  label: 'Customers',
  labelHi: 'ग्राहक',
  minRole: 'accountant',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'account'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    ...partyColumns('customerCode', 'Customer Code', 'ग्राहक कोड'),
    internal('customerType', 'Customer Type', 'ग्राहक प्रकार', { type: 'enum' }),
    internal('gstNo', 'GST No. (legacy)', 'जीएसटी संख्या (पुराना)', { piiClass: 'identity' }),
  ],
};

// ─── sales ───────────────────────────────────────────────────────────────────────────
const sale: EntityDescriptor = {
  key: 'sale',
  table: 'sales',
  domain: 'trade',
  label: 'Sales',
  labelHi: 'बिक्री',
  capability: 'inventory_sales',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'customer', 'member', 'voucher'],
  naturalKey: ['saleNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('saleNo', 'Sale No.', 'बिक्री संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('customerName', 'Customer', 'ग्राहक'),
    c('customerPhone', 'Customer Phone', 'ग्राहक फ़ोन', { piiClass: 'contact' }),
    internal('customerId', 'Customer Ref', 'ग्राहक संदर्भ'),
    internal('memberId', 'Member', 'सदस्य'),
    internal('items', 'Line Items', 'पंक्ति आइटम', { type: 'json' }),
    ...taxColumns(),
    c('paymentMode', 'Payment Mode', 'भुगतान माध्यम', { type: 'enum' }),
    c('narration', 'Narration', 'विवरण'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('gstVoucherIds', 'GST Vouchers', 'जीएसटी वाउचर', { type: 'json' }),
    internal('branchId', 'Branch', 'शाखा'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('createdBy', 'Created By', 'निर्माता'),
  ],
};

// ─── purchases ───────────────────────────────────────────────────────────────────────
const purchase: EntityDescriptor = {
  key: 'purchase',
  table: 'purchases',
  domain: 'trade',
  label: 'Purchases',
  labelHi: 'खरीद',
  capability: 'inventory_sales',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'supplier', 'voucher'],
  naturalKey: ['purchaseNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('purchaseNo', 'Purchase No.', 'खरीद संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('supplierName', 'Supplier', 'आपूर्तिकर्ता'),
    c('supplierPhone', 'Supplier Phone', 'आपूर्तिकर्ता फ़ोन', { piiClass: 'contact' }),
    internal('supplierId', 'Supplier Ref', 'आपूर्तिकर्ता संदर्भ'),
    internal('items', 'Line Items', 'पंक्ति आइटम', { type: 'json' }),
    ...taxColumns(),
    internal('rcmApplicable', 'RCM Applicable', 'आरसीएम लागू', { type: 'boolean' }),
    c('paymentMode', 'Payment Mode', 'भुगतान माध्यम', { type: 'enum' }),
    c('narration', 'Narration', 'विवरण'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('taxVoucherIds', 'Tax Vouchers', 'कर वाउचर', { type: 'json' }),
    internal('branchId', 'Branch', 'शाखा'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('createdBy', 'Created By', 'निर्माता'),
  ],
};

/** Return columns shared by sales_returns and purchase_returns. */
const returnTaxColumns = (): ColumnDescriptor[] => [
  money('netAmount', 'Net Amount', 'शुद्ध राशि'),
  money('cgstAmount', 'CGST', 'सीजीएसटी'),
  money('sgstAmount', 'SGST', 'एसजीएसटी'),
  money('igstAmount', 'IGST', 'आईजीएसटी'),
  money('taxAmount', 'Total Tax', 'कुल कर'),
  money('grandTotal', 'Grand Total', 'महायोग'),
  c('refundMode', 'Refund Mode', 'वापसी माध्यम', { type: 'enum' }),
  internal('bankAccountId', 'Bank Account', 'बैंक खाता'),
  internal('voucherId', 'Voucher', 'वाउचर'),
  c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
  internal('createdBy', 'Created By', 'निर्माता'),
  internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
];

// ─── sales_returns ───────────────────────────────────────────────────────────────────
const salesReturn: EntityDescriptor = {
  key: 'sales_return',
  table: 'sales_returns',
  domain: 'trade',
  label: 'Sales Returns',
  labelHi: 'बिक्री वापसी',
  capability: 'inventory_sales',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'sale', 'voucher'],
  naturalKey: ['returnNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('returnNo', 'Return No.', 'वापसी संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    internal('originalSaleId', 'Original Sale', 'मूल बिक्री'),
    c('saleNo', 'Sale No.', 'बिक्री संख्या'),
    c('customerName', 'Customer', 'ग्राहक'),
    internal('customerId', 'Customer Ref', 'ग्राहक संदर्भ'),
    internal('memberId', 'Member', 'सदस्य'),
    internal('items', 'Line Items', 'पंक्ति आइटम', { type: 'json' }),
    ...returnTaxColumns(),
  ],
};

// ─── purchase_returns ────────────────────────────────────────────────────────────────
const purchaseReturn: EntityDescriptor = {
  key: 'purchase_return',
  table: 'purchase_returns',
  domain: 'trade',
  label: 'Purchase Returns',
  labelHi: 'खरीद वापसी',
  capability: 'inventory_sales',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'purchase', 'voucher'],
  naturalKey: ['returnNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('returnNo', 'Return No.', 'वापसी संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    internal('originalPurchaseId', 'Original Purchase', 'मूल खरीद'),
    c('purchaseNo', 'Purchase No.', 'खरीद संख्या'),
    c('supplierName', 'Supplier', 'आपूर्तिकर्ता'),
    internal('supplierId', 'Supplier Ref', 'आपूर्तिकर्ता संदर्भ'),
    internal('items', 'Line Items', 'पंक्ति आइटम', { type: 'json' }),
    ...returnTaxColumns(),
  ],
};

// ─── hsn_master ──────────────────────────────────────────────────────────────────────
// Per-society, NOT global: the table carries society_id.
const hsn: EntityDescriptor = {
  key: 'hsn',
  table: 'hsn_master',
  domain: 'trade',
  label: 'HSN / SAC Master',
  labelHi: 'एचएसएन / एसएसी मास्टर',
  capability: 'gst',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['code'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('code', 'HSN / SAC Code', 'एचएसएन / एसएसी कोड'),
    c('description', 'Description', 'विवरण'),
    c('type', 'Type', 'प्रकार', { type: 'enum' }),
    num('gstRate', 'GST Rate %', 'जीएसटी दर %'),
    num('cess', 'Cess %', 'उपकर %'),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

export const TRADE_ENTITIES: EntityDescriptor[] = [
  supplier, customer, sale, purchase, salesReturn, purchaseReturn, hsn,
];
