/**
 * Export Registry — payroll & labour entities (T-08).
 *
 * Declares: employees, salary_records, workers, departments, department_bills,
 * worker_advances, pf_esi_runs, muster_entries, work_orders.
 *
 * ROLE NOTE. `employee` and `worker` require `accountant`. Both carry PAN, UAN/ESI
 * numbers and bank account details — `worker` additionally carries Aadhaar. These are
 * identity + payments datasets. The registers that reference them (muster roll, wage
 * register, department bills) remain viewer-exportable.
 *
 * CAPABILITY GATING mirrors moduleCatalog.ts exactly: the labour modules are gated on
 * `labour`, PF/ESI on `pf_esi`, and salary/employees are universal (every society runs
 * payroll). Inventing a gate here would show, or hide, an entity the app does not.
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

// ─── employees ───────────────────────────────────────────────────────────────────────
const employee: EntityDescriptor = {
  key: 'employee',
  table: 'employees',
  domain: 'payroll',
  label: 'Employees',
  labelHi: 'कर्मचारी',
  minRole: 'accountant',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['empNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('empNo', 'Employee No.', 'कर्मचारी संख्या'),
    c('name', 'Name', 'नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('designation', 'Designation', 'पदनाम'),
    c('joinDate', 'Join Date', 'नियुक्ति तिथि', { type: 'date' }),
    money('basicSalary', 'Basic Salary', 'मूल वेतन'),
    c('phone', 'Phone', 'फ़ोन', { piiClass: 'contact' }),
    c('pan', 'PAN', 'पैन', { piiClass: 'identity' }),
    internal('bankAccount', 'Bank Account', 'बैंक खाता', { piiClass: 'financial' }),
    internal('uan', 'UAN', 'यूएएन', { piiClass: 'identity' }),
    internal('esiNo', 'ESI Number', 'ईएसआई संख्या', { piiClass: 'identity' }),
    internal('pfApplicable', 'PF Applicable', 'पीएफ लागू', { type: 'boolean' }),
    internal('esiApplicable', 'ESI Applicable', 'ईएसआई लागू', { type: 'boolean' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
  ],
};

// ─── salary_records ──────────────────────────────────────────────────────────────────
const salaryRecord: EntityDescriptor = {
  key: 'salary_record',
  table: 'salary_records',
  domain: 'payroll',
  label: 'Salary Records',
  labelHi: 'वेतन रिकॉर्ड',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'employee', 'voucher'],
  naturalKey: ['slipNo'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('slipNo', 'Slip No.', 'पर्ची संख्या'),
    c('employeeId', 'Employee', 'कर्मचारी'),
    c('month', 'Month', 'माह'),
    money('basicSalary', 'Basic Salary', 'मूल वेतन'),
    money('allowances', 'Allowances', 'भत्ते'),
    internal('daAllowance', 'DA', 'महंगाई भत्ता', { type: 'currency' }),
    internal('hraAllowance', 'HRA', 'मकान किराया भत्ता', { type: 'currency' }),
    internal('taAllowance', 'TA', 'यात्रा भत्ता', { type: 'currency' }),
    internal('otherAllowances', 'Other Allowances', 'अन्य भत्ते', { type: 'currency' }),
    money('deductions', 'Deductions', 'कटौतियाँ'),
    internal('pfDeduction', 'PF Deduction', 'पीएफ कटौती', { type: 'currency' }),
    internal('pfEmployee', 'PF (Employee)', 'पीएफ (कर्मचारी)', { type: 'currency' }),
    internal('pfEmployer', 'PF (Employer)', 'पीएफ (नियोक्ता)', { type: 'currency' }),
    internal('esiEmployee', 'ESI (Employee)', 'ईएसआई (कर्मचारी)', { type: 'currency' }),
    internal('esiEmployer', 'ESI (Employer)', 'ईएसआई (नियोक्ता)', { type: 'currency' }),
    internal('pt', 'Professional Tax', 'व्यवसाय कर', { type: 'currency' }),
    internal('tds', 'TDS', 'टीडीएस', { type: 'currency' }),
    internal('taxDeduction', 'Tax Deduction', 'कर कटौती', { type: 'currency' }),
    internal('otherDeductions', 'Other Deductions', 'अन्य कटौतियाँ', { type: 'currency' }),
    money('netSalary', 'Net Salary', 'शुद्ध वेतन'),
    c('paymentMode', 'Payment Mode', 'भुगतान माध्यम', { type: 'enum' }),
    c('isPaid', 'Paid', 'भुगतान हुआ', { type: 'boolean' }),
    c('paidDate', 'Paid Date', 'भुगतान तिथि', { type: 'date' }),
    c('narration', 'Narration', 'विवरण'),
    internal('voucherId', 'Payment Voucher', 'भुगतान वाउचर'),
    internal('accrualVoucherId', 'Accrual Voucher', 'उपार्जन वाउचर'),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('createdBy', 'Created By', 'निर्माता'),
  ],
};

// ─── workers ─────────────────────────────────────────────────────────────────────────
const worker: EntityDescriptor = {
  key: 'worker',
  table: 'workers',
  domain: 'payroll',
  label: 'Workers',
  labelHi: 'श्रमिक',
  capability: 'labour',
  minRole: 'accountant',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'member'],
  naturalKey: ['workerCode'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('workerCode', 'Worker Code', 'श्रमिक कोड'),
    c('name', 'Name', 'नाम'),
    internal('fatherHusbandName', 'Father / Husband Name', 'पिता / पति का नाम'),
    c('workerType', 'Worker Type', 'श्रमिक प्रकार', { type: 'enum' }),
    c('category', 'Category', 'श्रेणी', { type: 'enum' }),
    internal('memberId', 'Member', 'सदस्य'),
    internal('gender', 'Gender', 'लिंग', { type: 'enum' }),
    internal('dateOfBirth', 'Date of Birth', 'जन्म तिथि', { type: 'date', piiClass: 'identity' }),
    c('phone', 'Phone', 'फ़ोन', { piiClass: 'contact' }),
    internal('permanentAddress', 'Permanent Address', 'स्थायी पता', { piiClass: 'contact' }),
    c('pan', 'PAN', 'पैन', { piiClass: 'identity' }),
    internal('aadhaar', 'Aadhaar', 'आधार', { piiClass: 'identity' }),
    internal('idProofType', 'ID Proof Type', 'पहचान प्रमाण प्रकार', { type: 'enum' }),
    internal('idProofNo', 'ID Proof No.', 'पहचान प्रमाण संख्या', { piiClass: 'identity' }),
    internal('uan', 'UAN', 'यूएएन', { piiClass: 'identity' }),
    internal('esiIp', 'ESI IP Number', 'ईएसआई आईपी संख्या', { piiClass: 'identity' }),
    internal('bankAccountNo', 'Bank Account No.', 'बैंक खाता संख्या', { piiClass: 'financial' }),
    internal('ifsc', 'IFSC', 'आईएफ़एससी', { piiClass: 'financial' }),
    money('defaultDailyWage', 'Default Daily Wage', 'मानक दैनिक मज़दूरी'),
    internal('joiningDate', 'Joining Date', 'नियुक्ति तिथि', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── departments ─────────────────────────────────────────────────────────────────────
const department: EntityDescriptor = {
  key: 'department',
  table: 'departments',
  domain: 'payroll',
  label: 'Departments',
  labelHi: 'विभाग',
  capability: 'labour',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'account'],
  naturalKey: ['departmentCode'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('departmentCode', 'Department Code', 'विभाग कोड'),
    c('name', 'Department Name', 'विभाग नाम'),
    c('departmentType', 'Department Type', 'विभाग प्रकार', { type: 'enum' }),
    internal('accountId', 'Ledger Account', 'बही खाता'),
    c('contactPerson', 'Contact Person', 'संपर्क व्यक्ति', { piiClass: 'contact' }),
    c('phone', 'Phone', 'फ़ोन', { piiClass: 'contact' }),
    c('address', 'Address', 'पता', { piiClass: 'contact' }),
    c('gstin', 'GSTIN', 'जीएसटीआईएन', { piiClass: 'identity' }),
    internal('tdsApplicable', 'TDS Applicable', 'टीडीएस लागू', { type: 'boolean' }),
    money('openingBalance', 'Opening Balance', 'ओपनिंग बैलेंस'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── work_orders ─────────────────────────────────────────────────────────────────────
const workOrder: EntityDescriptor = {
  key: 'work_order',
  table: 'work_orders',
  domain: 'payroll',
  label: 'Work Orders',
  labelHi: 'कार्य आदेश',
  capability: 'labour',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'department'],
  naturalKey: ['workOrderNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('workOrderNo', 'Work Order No.', 'कार्य आदेश संख्या'),
    c('clientName', 'Client', 'ग्राहक'),
    internal('departmentId', 'Department', 'विभाग'),
    c('description', 'Description', 'विवरण'),
    money('contractValue', 'Contract Value', 'अनुबंध मूल्य'),
    c('startDate', 'Start Date', 'प्रारंभ तिथि', { type: 'date' }),
    c('endDate', 'End Date', 'समाप्ति तिथि', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── department_bills ────────────────────────────────────────────────────────────────
const departmentBill: EntityDescriptor = {
  key: 'department_bill',
  table: 'department_bills',
  domain: 'payroll',
  label: 'Department Bills',
  labelHi: 'विभाग बिल',
  capability: 'labour',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'department', 'work_order', 'voucher'],
  naturalKey: ['billNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('billNo', 'Bill No.', 'बिल संख्या'),
    c('departmentId', 'Department', 'विभाग'),
    internal('workOrderId', 'Work Order', 'कार्य आदेश'),
    c('billType', 'Bill Type', 'बिल प्रकार', { type: 'enum' }),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    money('amount', 'Amount', 'राशि'),
    money('paidAmount', 'Paid Amount', 'भुगतान राशि'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('narration', 'Narration', 'विवरण'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── worker_advances ─────────────────────────────────────────────────────────────────
const workerAdvance: EntityDescriptor = {
  key: 'worker_advance',
  table: 'worker_advances',
  domain: 'payroll',
  label: 'Worker Advances',
  labelHi: 'श्रमिक अग्रिम',
  capability: 'labour',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'worker', 'voucher'],
  naturalKey: ['advanceNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('advanceNo', 'Advance No.', 'अग्रिम संख्या'),
    c('workerId', 'Worker', 'श्रमिक'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    money('amount', 'Advance Amount', 'अग्रिम राशि'),
    money('recovered', 'Recovered', 'वसूल'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('mode', 'Mode', 'माध्यम', { type: 'enum' }),
    c('narration', 'Narration', 'विवरण'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── muster_entries ──────────────────────────────────────────────────────────────────
const musterEntry: EntityDescriptor = {
  key: 'muster_entry',
  table: 'muster_entries',
  domain: 'payroll',
  label: 'Muster Roll',
  labelHi: 'हाजिरी रजिस्टर',
  capability: 'labour',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'work_order', 'member', 'voucher'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('workOrderId', 'Work Order', 'कार्य आदेश'),
    c('period', 'Period', 'अवधि'),
    c('memberId', 'Member', 'सदस्य'),
    num('daysWorked', 'Days Worked', 'कार्य दिवस'),
    money('dailyWage', 'Daily Wage', 'दैनिक मज़दूरी'),
    internal('workBasis', 'Work Basis', 'कार्य आधार', { type: 'enum' }),
    internal('accrued', 'Accrued', 'उपार्जित', { type: 'boolean' }),
    internal('paid', 'Paid', 'भुगतान हुआ', { type: 'boolean' }),
    internal('paidAmount', 'Paid Amount', 'भुगतान राशि', { type: 'currency' }),
    internal('accrualVoucherId', 'Accrual Voucher', 'उपार्जन वाउचर'),
    internal('paymentVoucherId', 'Payment Voucher', 'भुगतान वाउचर'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── pf_esi_runs ─────────────────────────────────────────────────────────────────────
const pfEsiRun: EntityDescriptor = {
  key: 'pf_esi_run',
  table: 'pf_esi_runs',
  domain: 'payroll',
  label: 'PF / ESI Runs',
  labelHi: 'पीएफ / ईएसआई रन',
  capability: 'pf_esi',
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'voucher'],
  naturalKey: ['period'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('period', 'Period', 'अवधि'),
    money('grossWages', 'Gross Wages', 'सकल मज़दूरी'),
    money('epfEmployee', 'EPF (Employee)', 'ईपीएफ (कर्मचारी)'),
    money('epfEmployer', 'EPF (Employer)', 'ईपीएफ (नियोक्ता)'),
    internal('epfAdminEdli', 'EPF Admin + EDLI', 'ईपीएफ प्रशासन + ईडीएलआई', { type: 'currency' }),
    money('esiEmployee', 'ESI (Employee)', 'ईएसआई (कर्मचारी)'),
    money('esiEmployer', 'ESI (Employer)', 'ईएसआई (नियोक्ता)'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('depositVoucherId', 'Deposit Voucher', 'जमा वाउचर'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

export const PAYROLL_ENTITIES: EntityDescriptor[] = [
  employee, salaryRecord, worker, department, workOrder,
  departmentBill, workerAdvance, musterEntry, pfEsiRun,
];
