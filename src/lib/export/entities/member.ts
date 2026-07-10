/**
 * Export Registry — member & share entities (T-06).
 *
 * Declares: members.
 *
 * SCOPE NOTE. The roadmap listed four member "collections" (members, share register,
 * nomination register, Form-1). Only `members` is a table — the other three are REPORTS
 * derived from it (generateShareRegisterPDF, generateNominationRegisterPDF, Form1MemberList).
 * The registry declares persisted collections, so exactly one entity is declared here.
 * Those reports become `statutory` export modes over this entity (blueprint §4.3), not
 * separate entities.
 *
 * PII. `phone`, `nomineePhone`, `pan`, `aadhaar` are the same keys that lib/auditLog.ts
 * masks via PII_KEYS. Here that knowledge is promoted from a private Set to a typed
 * column property, which is what makes a Redacted export possible: a society can hand
 * its member register to a federation or external auditor without leaking contact and
 * identity data.
 */
import type { ColumnDescriptor, EntityDescriptor } from '../registry.types';

const c = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  ({ key, header, headerHi, type: 'string', piiClass: 'none', defaultVisible: true, ...over });

const money = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { type: 'currency', ...over });

const internal = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { defaultVisible: false, ...over });

// ─── members ─────────────────────────────────────────────────────────────────────────
// Soft-deleted (RULE 5). minRole is 'viewer' because a viewer may export the register;
// the PII columns below are what gate unredacted output (enforced by the generator, T-14).
const member: EntityDescriptor = {
  key: 'member',
  table: 'members',
  domain: 'member',
  label: 'Members',
  labelHi: 'सदस्य',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['memberId'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('memberId', 'Member ID', 'सदस्य आईडी'),
    c('name', 'Name', 'नाम'),
    c('fatherName', 'Father / Husband Name', 'पिता / पति का नाम'),
    c('memberType', 'Member Type', 'सदस्य प्रकार', { type: 'enum' }),
    c('joinDate', 'Join Date', 'सदस्यता तिथि', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),

    // Contact & identity — masked in a Redacted export.
    c('address', 'Address', 'पता', { piiClass: 'contact' }),
    c('phone', 'Phone', 'फ़ोन', { piiClass: 'contact' }),
    c('pan', 'PAN', 'पैन', { piiClass: 'identity' }),
    c('aadhaar', 'Aadhaar', 'आधार', { piiClass: 'identity', defaultVisible: false }),

    // Share capital.
    money('shareCapital', 'Share Capital', 'अंशपूँजी'),
    money('admissionFee', 'Admission Fee', 'प्रवेश शुल्क'),
    c('shareCertNo', 'Share Certificate No.', 'अंश प्रमाणपत्र संख्या'),
    c('shareCount', 'Shares Held', 'अंशों की संख्या', { type: 'number' }),
    money('shareFaceValue', 'Face Value', 'अंकित मूल्य'),
    internal('shareCertStatus', 'Certificate Status', 'प्रमाणपत्र स्थिति', { type: 'enum' }),
    internal('shareCertIssuedAt', 'Certificate Issued At', 'प्रमाणपत्र जारी समय', { type: 'date' }),
    internal('shareCertReason', 'Certificate Reason', 'प्रमाणपत्र कारण'),

    // Nomination (the Nomination Register report reads these).
    c('nomineeName', 'Nominee Name', 'नामिती का नाम', { piiClass: 'contact' }),
    c('nomineeRelation', 'Nominee Relation', 'नामिती संबंध'),
    c('nomineePhone', 'Nominee Phone', 'नामिती फ़ोन', { piiClass: 'contact' }),
    internal('nominees', 'Nominees (multi)', 'नामिती (बहु)', { type: 'json', piiClass: 'contact' }),

    internal('kycStatus', 'KYC Status', 'केवाईसी स्थिति', { type: 'enum' }),
    internal('creditLimit', 'Credit Limit', 'ऋण सीमा', { type: 'currency' }),
    internal('branchId', 'Branch', 'शाखा'),
    internal('statusReason', 'Status Reason', 'स्थिति कारण'),
    internal('statusChangedAt', 'Status Changed At', 'स्थिति परिवर्तन समय', { type: 'date' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

export const MEMBER_ENTITIES: EntityDescriptor[] = [member];
