// Source-level guard for the member PII split wiring in DataContext (no unit harness exists for the
// context). Fails if a future edit adds a members upsert that bypasses memberRow() — that write would
// re-expose PAN/Aadhaar in the members table and silently defeat Phase 3.
// Run: node scripts/test-member-identity-wiring.mjs
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/contexts/DataContext.tsx', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

ok(!/from\('members'\)\.(upsert|insert)\(withSoc\(/.test(src), 'no members upsert/insert bypasses memberRow()');
const sites = (src.match(/from\('members'\)\.upsert\(memberRow\(/g) || []).length;
ok(sites >= 10, `all member upserts use memberRow() (found ${sites})`);
ok(/const memberRow = \(m: Record<string, any>\) => withSoc\(identitySplitRef\.current \? stripMemberPII\(m\) : m\)/.test(src), 'memberRow strips PII in split mode');
ok(/fetchAllPaged<IdentityRow>\('member_identity', \['member_id'\]\)/.test(src), 'load reads member_identity paged by member_id');
ok(/isMissingIdentityTable\(idRes\.error\)/.test(src), 'missing table => legacy mode (no failure)');
ok(/applyMemberIdentity\(activeMembers, idRes\.data, canReadMemberPii\(/.test(src), 'load overlays identity, role-gated');
ok(/persistMemberIdentity\(newMember\.id/.test(src) && /persistMemberIdentity\(id,/.test(src), 'add + update persist PII to member_identity (step 2)');
ok(/from\('member_identity'\)\.upsert\(row, \{ onConflict: 'society_id,member_id' \}\)/.test(src), 'identity upsert targets the composite key');
// supabase.from('members').update({...}) sites must never carry PII columns
const upd = [...src.matchAll(/from\('members'\)\.update\(\{([^}]*)\}\)/g)].map(m => m[1]);
ok(upd.every(b => !/aadhaar|pan/.test(b)), 'direct members .update() calls never touch aadhaar/pan');

console.log(`\nMember identity wiring: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
