// Member-audit M5 — registers & elections (2026-10-17).
//   s.20(d) defaulters / nominal / ceased members have no vote; App. A para 35 voters list as on a date ·
//   s.25(3)(d) defaulters list for the AGM · s.28(1) reservation (2 women, 1 SC, 1 BC when BC ≥ 10%) ·
//   r.22 register columns (occupation, admission date, date of ceasing) · gender (new members) + date of birth.
//   Defaulter = the app's one overdue rule (isOverdueAt). Migration 118 rides its own update (RULE 1).
// Run: node scripts/test-member-m5.mjs   (npm run test:member-m5)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const V = await import(pathToFileURL(resolve(SRC, 'lib/members/voters.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const AS = '2026-10-17';
const mem = (id, o = {}) => ({ id, memberId: id, name: id, status: 'active', joinDate: '2020-04-01', memberType: 'member', ...o });
const members = [
  mem('M001', { gender: 'female', caste: 'Schedule Caste' }),
  mem('M002', { gender: 'female', caste: 'Backward Class' }),
  mem('M003', { memberType: 'nominal' }),
  mem('M004', { status: 'resigned', statusChangedAt: '2026-05-01' }),
  mem('M005', { status: 'deceased', statusChangedAt: '2026-12-01' }),   // died AFTER the as-on date → still on the roll then
  mem('M006', { approvalStatus: 'pending' }),
  mem('M007', { joinDate: '2026-11-01' }),
  mem('M008', { caste: 'Backward Class' }),                              // defaulter (overdue loan)
  mem('M009', { gender: 'male' }),                                       // loan due later → not overdue
  mem('M010', { isDeleted: true }),
  mem('M011'),                                                           // KCC overdue
];
const loans = [
  { id: 'l1', loanNo: 'L-1', memberId: 'M008', amount: 10000, repaidAmount: 2500, interestRate: 7, dueDate: '2026-09-30', status: 'active' },
  { id: 'l2', loanNo: 'L-2', memberId: 'M009', amount: 5000, repaidAmount: 0, interestRate: 7, dueDate: '2027-03-31', status: 'active' },
  { id: 'l3', loanNo: 'L-3', memberId: 'M001', amount: 5000, repaidAmount: 5000, interestRate: 7, dueDate: '2026-01-31', status: 'active' },   // nothing left
  { id: 'l4', loanNo: 'L-4', memberId: 'M002', amount: 4000, repaidAmount: 0, interestRate: 7, dueDate: '2026-01-31', status: 'active', isDeleted: true },
];
const kcc = [{ id: 'k1', memberId: 'M011', status: 'overdue', outstandingAmount: 1200 }];

// ── defaulters ──
const od = V.overdueByMember(loans, kcc, AS);
ok(od.get('M008')?.amount === 7500 && od.get('M008').items[0] === 'Loan L-1', 'overdue loan: outstanding counted, labelled');
ok(!od.has('M009') && !od.has('M001') && !od.has('M002'), 'not yet due / fully repaid / deleted loan → not a defaulter');
ok(od.get('M011')?.amount === 1200, 'KCC marked overdue counts');
const dl = V.defaulterList(members, loans, kcc, AS);
ok(dl.length === 2 && dl[0].member.id === 'M008' && dl[1].member.id === 'M011', 'defaulters list, largest first');

// ── voters roll ──
const roll = V.voterRoll(members, loans, kcc, AS);
const ids = roll.voters.map((m) => m.id);
ok(JSON.stringify(ids) === JSON.stringify(['M001', 'M002', 'M005', 'M009']), `voters = approved, not nominal, joined, not ceased, not in default — got ${ids}`);
const why = Object.fromEntries(roll.excluded.map((x) => [x.member.id, x.reason]));
ok(why.M003 === 'nominal' && why.M004 === 'ceased' && why.M006 === 'not_approved' && why.M007 === 'not_yet_member' && why.M008 === 'defaulter' && why.M011 === 'defaulter', 'every exclusion carries its reason');
ok(!('M010' in why) && !ids.includes('M010'), 'deleted members are not listed at all');
ok(roll.excluded.find((x) => x.member.id === 'M008').overdue === 7500, 'defaulter exclusion shows the amount');
ok(V.voterRoll(members, loans, kcc, '2026-12-15').excluded.some((x) => x.member.id === 'M005' && x.reason === 'ceased'), 'after the death date the member is off the roll');
ok(/धारा 20\(d\)/.test(V.EXCLUSION_LABEL.defaulter) && /धारा 18\/20/.test(V.EXCLUSION_LABEL.nominal), 'reasons name the section');

// ── reservation ──
const r = V.reservationSummary([...roll.voters, ...roll.excluded.filter((x) => x.reason === 'defaulter').map((x) => x.member)]);
ok(r.total === 6 && r.women === 2 && r.sc === 1 && r.bc === 2 && r.bcPercent === 33.33 && r.bcSeatRequired, 'women / SC / BC counts and the 10% BC rule');
ok(r.genderUnknown === 3, 'members without gender are counted (women count incomplete)');
ok(!V.reservationSummary([mem('A', { caste: 'Backward Class' }), ...Array.from({ length: 10 }, (_, i) => mem('G' + i))]).bcSeatRequired, 'BC under 10% → no BC seat');

// ── age ──
ok(V.ageOn('2000-10-17', '2026-10-17') === 26 && V.ageOn('2000-10-18', '2026-10-17') === 25 && V.ageOn(undefined, AS) === undefined, 'age from date of birth');

// ── migration 118 ──
const up = read('supabase/migrations/118_member_gender_dob.sql');
for (const f of ['gender', 'dateOfBirth']) {
  ok(up.includes(`alter table public.members add column if not exists "${f}"`), `118 adds ${f}`);
  ok(read('supabase/migrations/118_member_gender_dob_down.sql').includes(`drop column if exists "${f}"`), `118 down drops ${f}`);
  ok(read('supabase-tables.sql').includes(`alter table members add column if not exists "${f}" text;`), `supabase-tables.sql has ${f}`);
  ok(read('supabase/functions/_shared/backup-core.mjs').includes(`"${f}"`), `committed backup bundle carries ${f}`);
}
ok(up.includes("values ('118', 'member_gender_dob')") && !/\b(update|delete|drop)\b/i.test(up.replace(/--.*$/gm, '')), '118 additive + self-recording');

// ── wiring ──
const dc = read('src/contexts/DataContext.tsx');
ok(dc.includes('for (const f of MEMBER_PROFILE_FIELDS) delete base[f];') && /const persistMemberProfile = [\s\S]*?Migration 118 चलाएँ/.test(dc), 'gender / DOB never in the base upsert; own step-2 update + mild warning');
ok(dc.includes('persistMemberProfile(newMember.id, newMember, !!(newMember.gender || newMember.dateOfBirth))') && dc.includes('persistMemberProfile(id, updatedMember, MEMBER_PROFILE_FIELDS.some('), 'add + edit write the profile step');
const mp = read('src/pages/Members.tsx');
ok(mp.includes("if (!form.gender) { toast({ title: hi ? 'लिंग चुनें'") && mp.includes("{hi ? 'लिंग' : 'Gender'}{!isEdit && ' *'}"), 'gender required for a new member only');
ok(mp.includes('statusFilter === \'all\' || m.status === statusFilter') && mp.includes('exportMembersExcel'), 'members list: status / type filters + Excel (U6)');
const app = read('src/pages/MemberApplication.tsx');
ok(app.includes("if (!form.gender) { toast({ title: hiLang ? 'लिंग चुनें'") && app.includes('dateOfBirth: form.dateOfBirth || undefined'), 'application asks the gender + DOB');
const f1 = read('src/pages/Form1MemberList.tsx');
ok(f1.includes("'Occupation', 'Address', 'Phone', 'Admission Date'") && f1.includes("'Ceased On'") && f1.includes('registerRow(m, i, n => n.toLocaleString'), 'Form-1 = r.22 register (occupation, admission date, ceased on) for CSV / Excel / PDF alike');
const vl = read('src/pages/VotersList.tsx');
ok(vl.includes('voterRoll(members, loans, kccLoans, asOn)') && vl.includes('defaulterList(members, loans, kccLoans, asOn)') && vl.includes('reservationSummary(live)'), 'voters page uses the pure rules');
ok(vl.includes('generateVotersListPDF(roll.voters, society, asOn)') && vl.includes('generateDefaulterListPDF(defaulters, society, asOn)') && vl.includes("can('export')"), 'PDF / Excel, export-gated');
ok(read('src/App.tsx').includes('<Route path="/voters-list" element={<ProtectedRoute><VotersList /></ProtectedRoute>} />'), 'route protected');
ok(read('src/lib/navigation/hubs.ts').includes("'form1MemberList', 'votersList'"), 'in the Members hub');
ok(/export function generateVotersListPDF\(/.test(read('src/lib/pdf.ts')) && /export function generateDefaulterListPDF\(/.test(read('src/lib/pdf.ts')), 'PDF generators');

console.log(`member-m5: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
