/**
 * Export Registry — transport operations, slice 1 (migration 128).
 *
 * Declares: transport_vehicles, transport_trips, transport_vehicle_expenses — owned by
 * TransportOpsContext. Gated on `transport`, matching moduleCatalog.ts. `optionalTable` because
 * 128 is a hand-run migration: until it is applied a backup reads zero rows instead of failing.
 *
 * Trips and expenses each point at ONE voucher (voucherId; the voucher's refType/refId point back),
 * so they restore after `voucher`. Their amounts are a copy for the register — the voucher is the money.
 */
import type { ColumnDescriptor, EntityDescriptor } from '../registry.types';

const c = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  ({ key, header, headerHi, type: 'string', piiClass: 'none', defaultVisible: true, ...over });

const money = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { type: 'currency', ...over });

const internal = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { defaultVisible: false, ...over });

const CAP = 'transport' as const;

const vehicle: EntityDescriptor = {
  key: 'transport_vehicle',
  table: 'transport_vehicles',
  domain: 'transport',
  label: 'Vehicles',
  labelHi: 'वाहन',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'asset'],
  naturalKey: ['regNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  optionalTable: true,
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('regNo', 'Registration No.', 'पंजीकरण संख्या'),
    c('vehicleType', 'Vehicle Type', 'वाहन प्रकार', { type: 'enum' }),
    c('capacity', 'Capacity', 'क्षमता'),
    internal('assetId', 'Asset', 'संपत्ति'),
    c('insuranceExpiry', 'Insurance Expiry', 'बीमा समाप्ति', { type: 'date' }),
    c('permitExpiry', 'Permit Expiry', 'परमिट समाप्ति', { type: 'date' }),
    c('fitnessExpiry', 'Fitness Expiry', 'फ़िटनेस समाप्ति', { type: 'date' }),
    c('pucExpiry', 'PUC Expiry', 'PUC समाप्ति', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('remarks', 'Remarks', 'टिप्पणी'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

const trip: EntityDescriptor = {
  key: 'transport_trip',
  table: 'transport_trips',
  domain: 'transport',
  label: 'Trips',
  labelHi: 'ट्रिप',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'transport_vehicle', 'customer', 'voucher'],
  naturalKey: ['tripNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  optionalTable: true,
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('tripNo', 'Trip No.', 'ट्रिप संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('vehicleId', 'Vehicle', 'वाहन'),
    c('customerId', 'Customer', 'ग्राहक'),
    c('fromPlace', 'From', 'कहाँ से'),
    c('toPlace', 'To', 'कहाँ तक'),
    money('freight', 'Freight', 'भाड़ा'),
    money('loading', 'Loading / Unloading', 'लदाई / उतराई'),
    money('detention', 'Detention', 'रुकाई'),
    money('amount', 'Amount', 'राशि'),
    money('paidAmount', 'Received', 'प्राप्त राशि'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('narration', 'Narration', 'विवरण'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('collectionVoucherIds', 'Collection Vouchers', 'वसूली वाउचर', { type: 'json' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

const vehicleExpense: EntityDescriptor = {
  key: 'transport_vehicle_expense',
  table: 'transport_vehicle_expenses',
  domain: 'transport',
  label: 'Vehicle Expenses',
  labelHi: 'वाहन खर्च',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'transport_vehicle', 'account', 'voucher'],
  naturalKey: ['expenseNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  optionalTable: true,
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('expenseNo', 'Expense No.', 'खर्च संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('vehicleId', 'Vehicle', 'वाहन'),
    c('accountId', 'Expense Head', 'खर्च खाता'),
    money('amount', 'Amount', 'राशि'),
    c('mode', 'Mode', 'माध्यम', { type: 'enum' }),
    internal('bankAccountId', 'Bank Account', 'बैंक खाता'),
    c('narration', 'Narration', 'विवरण'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

export const TRANSPORT_ENTITIES: EntityDescriptor[] = [vehicle, trip, vehicleExpense];
