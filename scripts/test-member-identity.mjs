// Member identity split (Phase 2): pure logic. Run: node scripts/test-member-identity.mjs
import {
  PII_ROLES, canReadMemberPii, stripMemberPII, applyMemberIdentity, isMissingIdentityTable, identityRowFor,
} from '../src/lib/memberIdentity.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// role list must equal the SQL gate jwt_can_read_pii() in docs/reports-audit/design/member_identity_phase1.draft.sql
ok(JSON.stringify(PII_ROLES) === JSON.stringify(['admin', 'societyAdmin', 'accountant', 'secretary', 'manager']), 'role list mirrors the SQL gate');
for (const r of PII_ROLES) ok(canReadMemberPii(r), `${r} may read PII`);
for (const r of ['cashier', 'viewer', 'auditor', 'boardMember', 'dataEntry', 'employee', 'chairman', 'externalCA', 'superAdmin', '', undefined, null])
  ok(!canReadMemberPii(r), `${String(r)} may NOT read PII (fail-closed)`);

// strip
const m1 = { id: 'm1', name: 'A', aadhaar: '111122223333', pan: 'ABCDE1234F', shareCapital: 100 };
const s = stripMemberPII(m1);
ok(!('aadhaar' in s) && !('pan' in s) && s.name === 'A' && s.shareCapital === 100, 'strip removes only aadhaar/pan');
ok('aadhaar' in m1, 'strip does not mutate the input');

// apply — authorised
const rows = [{ member_id: 'm1', aadhaar: '999900001111', pan: 'ZZZZZ9999Z' }, { member_id: 'm3', aadhaar: '', pan: 'PANONLY123X' }];
const members = [m1, { id: 'm2', name: 'B', aadhaar: 'LEGACY', pan: undefined }, { id: 'm3', name: 'C' }];
const a = applyMemberIdentity(members, rows, true);
ok(a[0].aadhaar === '999900001111' && a[0].pan === 'ZZZZZ9999Z', 'identity value wins over legacy column');
ok(a[1].aadhaar === 'LEGACY', 'no identity row: legacy value kept (not yet backfilled)');
ok(a[2].pan === 'PANONLY123X' && a[2].aadhaar === undefined, 'partial identity row fills only what it has');
ok(m1.aadhaar === '111122223333', 'apply does not mutate input');
// apply — unauthorised
const u = applyMemberIdentity(members, rows, false);
ok(u.every(x => !('aadhaar' in x) && !('pan' in x)), 'unauthorised role gets no aadhaar/pan at all');
ok(u[0].name === 'A' && u.length === 3, 'unauthorised role still gets the member list');

// missing-table detection
ok(isMissingIdentityTable({ code: '42P01' }), '42P01');
ok(isMissingIdentityTable({ code: 'PGRST205' }), 'PGRST205');
ok(isMissingIdentityTable({ message: "Could not find the table 'public.member_identity' in the schema cache" }), 'schema-cache message');
ok(!isMissingIdentityTable({ code: '42501', message: 'permission denied for table member_identity' }), 'permission denied is NOT "missing"');
ok(!isMissingIdentityTable({ message: 'network error' }) && !isMissingIdentityTable(null), 'other errors are not "missing"');

// identity row
ok(identityRowFor('s', 'm', {}) === null && identityRowFor('s', 'm', { aadhaar: ' ', pan: '' }) === null, 'nothing to store -> null');
const r = identityRowFor('s1', 'm1', { aadhaar: ' 1234 ', pan: '' });
ok(r.society_id === 's1' && r.member_id === 'm1' && r.aadhaar === '1234' && r.pan === null, 'row trimmed, empty -> null');

console.log(`\nMember identity: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
