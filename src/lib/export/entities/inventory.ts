/**
 * Export Registry — inventory & org-structure entities (T-07).
 *
 * Declares: branches, godowns, stock_items, stock_movements.
 *
 * RULE 2 WARNING (stock_items.currentStock). That column is a CACHE. The canonical
 * stock figure is `openingStock + sum(stock_movements)` — see CLAUDE.md RULE 2 and the
 * phantom Trading-Account bug it caused. It is declared here so a `full` backup restores
 * the row byte-for-byte, but it is `defaultVisible: false`: nobody should be handed a
 * CSV column that can silently disagree with the movements it is derived from.
 *
 * DAG NOTE. `branchId` columns on vouchers/members/sales carry no database FK, so restore
 * order is unaffected by them. The complete dependency graph is assembled in T-12; only
 * edges that matter for insert ordering are declared here (godown → branch).
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

// ─── branches ────────────────────────────────────────────────────────────────────────
const branch: EntityDescriptor = {
  key: 'branch',
  table: 'branches',
  domain: 'inventory',
  label: 'Branches',
  labelHi: 'शाखाएँ',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('name', 'Branch Name', 'शाखा नाम'),
    c('code', 'Branch Code', 'शाखा कोड'),
    c('isHeadOffice', 'Head Office', 'प्रधान कार्यालय', { type: 'boolean' }),
    c('address', 'Address', 'पता', { piiClass: 'contact' }),
    c('isActive', 'Active', 'सक्रिय', { type: 'boolean' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── godowns ─────────────────────────────────────────────────────────────────────────
const godown: EntityDescriptor = {
  key: 'godown',
  table: 'godowns',
  domain: 'inventory',
  label: 'Godowns',
  labelHi: 'गोदाम',
  capability: 'warehousing',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'branch'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('name', 'Godown Name', 'गोदाम नाम'),
    c('code', 'Godown Code', 'गोदाम कोड'),
    c('branchId', 'Branch', 'शाखा'),
    c('address', 'Address', 'पता', { piiClass: 'contact' }),
    num('capacityMT', 'Capacity (MT)', 'क्षमता (मी.टन)'),
    c('isActive', 'Active', 'सक्रिय', { type: 'boolean' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── stock_items ─────────────────────────────────────────────────────────────────────
const stockItem: EntityDescriptor = {
  key: 'stock_item',
  table: 'stock_items',
  domain: 'inventory',
  label: 'Stock Items',
  labelHi: 'स्टॉक आइटम',
  capability: 'inventory_sales',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'account'],
  naturalKey: ['itemCode'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('itemCode', 'Item Code', 'आइटम कोड'),
    c('name', 'Item Name', 'आइटम नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('stockGroup', 'Stock Group', 'स्टॉक समूह'),
    c('unit', 'Unit', 'इकाई'),
    num('openingStock', 'Opening Stock', 'प्रारंभिक स्टॉक'),
    // CACHE — canonical value is openingStock + sum(movements). See RULE 2 above.
    internal('currentStock', 'Current Stock (cached)', 'वर्तमान स्टॉक (कैश्ड)', { type: 'number' }),
    money('purchaseRate', 'Purchase Rate', 'क्रय दर'),
    money('saleRate', 'Sale Rate', 'विक्रय दर'),
    c('isActive', 'Active', 'सक्रिय', { type: 'boolean' }),
    // RULE 4: per-item ledger routing. Default 4101 / 5101 when unset.
    internal('salesAccountId', 'Sales Account', 'विक्रय खाता'),
    internal('purchaseAccountId', 'Purchase Account', 'क्रय खाता'),
  ],
};

// ─── stock_movements ─────────────────────────────────────────────────────────────────
const stockMovement: EntityDescriptor = {
  key: 'stock_movement',
  table: 'stock_movements',
  domain: 'inventory',
  label: 'Stock Movements',
  labelHi: 'स्टॉक संचलन',
  capability: 'inventory_sales',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'stock_item', 'godown'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('itemId', 'Item', 'आइटम'),
    c('type', 'Movement Type', 'संचलन प्रकार', { type: 'enum' }),
    num('qty', 'Quantity', 'मात्रा'),
    money('rate', 'Rate', 'दर'),
    money('amount', 'Amount', 'राशि'),
    c('referenceNo', 'Reference No.', 'संदर्भ संख्या'),
    c('narration', 'Narration', 'विवरण'),
    internal('godownId', 'Godown', 'गोदाम'),
    internal('batchNo', 'Batch No.', 'बैच संख्या'),
    internal('expiryDate', 'Expiry Date', 'समाप्ति तिथि', { type: 'date' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

export const INVENTORY_ENTITIES: EntityDescriptor[] = [branch, godown, stockItem, stockMovement];
