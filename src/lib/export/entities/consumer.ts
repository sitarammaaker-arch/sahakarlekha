/**
 * Export Registry — consumer cooperative entities (T-11).
 *
 * Declares: consumer_price_lists, consumer_patronage_runs, consumer_purchase_orders.
 *
 * SCOPE CORRECTION. The roadmap counted 5 consumer collections. Two of them —
 * `sales_returns` and `purchase_returns` — are shared trade tables, already declared in
 * entities/trade.ts. They are not consumer-specific; the Consumer module simply uses
 * them. Declaring them twice would trip validateRegistry's duplicate-table check, which
 * is exactly what that check is for.
 *
 * All three are gated on `pos_billing`, matching moduleCatalog.ts.
 *
 * CACHE WARNING. `consumer_patronage_runs.amountPaid` is a running total maintained
 * beside the payment voucher — hidden by default (RULE 2), like every other cached total.
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

const CAP = 'pos_billing' as const;

// ─── consumer_price_lists ────────────────────────────────────────────────────────────
const priceList: EntityDescriptor = {
  key: 'consumer_price_list',
  table: 'consumer_price_lists',
  domain: 'consumer',
  label: 'Price Lists',
  labelHi: 'मूल्य सूची',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'stock_item'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('itemId', 'Item', 'आइटम'),
    c('tier', 'Price Tier', 'मूल्य श्रेणी', { type: 'enum' }),
    money('price', 'Price', 'मूल्य'),
    c('effectiveFrom', 'Effective From', 'प्रभावी तिथि', { type: 'date' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('updatedAt', 'Updated At', 'अद्यतन समय', { type: 'date' }),
  ],
};

// ─── consumer_patronage_runs ─────────────────────────────────────────────────────────
const patronageRun: EntityDescriptor = {
  key: 'consumer_patronage_run',
  table: 'consumer_patronage_runs',
  domain: 'consumer',
  label: 'Patronage Runs',
  labelHi: 'संरक्षण वितरण',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'voucher'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    internal('kind', 'Kind', 'प्रकार', { type: 'enum' }),
    c('fyLabel', 'Financial Year', 'वित्तीय वर्ष'),
    c('from', 'From', 'से', { type: 'date' }),
    c('to', 'To', 'तक', { type: 'date' }),
    num('ratePct', 'Rate %', 'दर %'),
    c('resolutionNo', 'Resolution No.', 'संकल्प संख्या'),
    c('resolutionDate', 'Resolution Date', 'संकल्प तिथि', { type: 'date' }),
    internal('lines', 'Distribution Lines', 'वितरण पंक्तियाँ', { type: 'json' }),
    money('total', 'Total', 'कुल'),
    internal('amountPaid', 'Amount Paid (cached)', 'भुगतान राशि (कैश्ड)', { type: 'currency' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('approvedBy', 'Approved By', 'अनुमोदक'),
    internal('approvedAt', 'Approved At', 'अनुमोदन समय', { type: 'date' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── consumer_purchase_orders ────────────────────────────────────────────────────────
const purchaseOrder: EntityDescriptor = {
  key: 'consumer_purchase_order',
  table: 'consumer_purchase_orders',
  domain: 'consumer',
  label: 'Purchase Orders',
  labelHi: 'क्रय आदेश',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'supplier', 'purchase'],
  naturalKey: ['poNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('poNo', 'PO No.', 'क्रय आदेश संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('supplierName', 'Supplier', 'आपूर्तिकर्ता'),
    c('supplierPhone', 'Supplier Phone', 'आपूर्तिकर्ता फ़ोन', { piiClass: 'contact' }),
    internal('supplierId', 'Supplier Ref', 'आपूर्तिकर्ता संदर्भ'),
    c('expectedDate', 'Expected Date', 'अपेक्षित तिथि', { type: 'date' }),
    internal('items', 'Line Items', 'पंक्ति आइटम', { type: 'json' }),
    money('total', 'Total', 'कुल'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('resolutionNo', 'Resolution No.', 'संकल्प संख्या'),
    internal('approvedBy', 'Approved By', 'अनुमोदक'),
    internal('approvedAt', 'Approved At', 'अनुमोदन समय', { type: 'date' }),
    internal('receivedAt', 'Received At', 'प्राप्ति समय', { type: 'date' }),
    internal('purchaseId', 'Purchase', 'खरीद'),
    c('purchaseNo', 'Purchase No.', 'खरीद संख्या'),
    internal('varianceStatus', 'Variance Status', 'भिन्नता स्थिति', { type: 'enum' }),
    internal('varianceReason', 'Variance Reason', 'भिन्नता कारण'),
    internal('varianceApprovedBy', 'Variance Approved By', 'भिन्नता अनुमोदक'),
    c('notes', 'Notes', 'टिप्पणी'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

export const CONSUMER_ENTITIES: EntityDescriptor[] = [priceList, patronageRun, purchaseOrder];
