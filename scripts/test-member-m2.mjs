// Member-audit M2 — admission of members (2026-10-16).
//   r.17 decide within one month · s.16 PACS deemed admission after 60 days · refusal with reasons + 60-day appeal
//   (s.114) · r.22(b) the register's date of entry = the admission date. The six new columns (migration 116) never
//   ride the base upsert (RULE 1 step 2), so members keep saving before the migration runs.
// Run: node scripts/test-member-m2.mjs   (npm run test:member-m2)
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
const A = await import(pathToFileURL(resolve(SRC, 'lib/members/admission.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── step-2 split ──
const { base, extras } = A.splitAdmissionFields({ id: '1', name: 'Ram', applicationDate: '2026-09-01', admissionDate: '', rejectionReason: undefined, decidedAt: '2026-10-01' });
ok(!('applicationDate' in base) && !('admissionDate' in base) && !('decidedAt' in base) && base.name === 'Ram', 'admission columns never in the base row');
ok(JSON.stringify(extras) === JSON.stringify({ applicationDate: '2026-09-01', decidedAt: '2026-10-01' }), 'only filled admission columns go to step 2');
ok(A.MEMBER_ADMISSION_FIELDS.length === 6, 'six columns');

// ── r.17 one month ──
ok(A.addOneMonth('2026-01-31') === '2026-02-28' && A.addOneMonth('2028-01-31') === '2028-02-29' && A.addOneMonth('2026-12-15') === '2027-01-15', 'one month = same day next month, clamped');
const c1 = A.admissionClock('2026-09-01', '2026-09-20');
ok(c1 && c1.days === 19 && c1.decideBy === '2026-10-01' && !c1.overdue && !c1.deemed && c1.deemedOn === undefined, 'within the month: days + decide-by, no deemed clock outside PACS');
const c2 = A.admissionClock('2026-09-01', '2026-10-02');
ok(c2.overdue && !c2.deemed, 'past one month → overdue');
const c3 = A.admissionClock('2026-08-01', '2026-09-30', { societyType: 'pacs' });
ok(c3.deemedOn === '2026-09-30' && c3.deemed && c3.overdue, 'PACS: deemed admitted on day 60 (s.16)');
ok(!A.admissionClock('2026-08-01', '2026-09-29', { societyType: 'pacs' }).deemed, 'PACS day 59 — not yet deemed');
ok(A.admissionClock(undefined, '2026-09-29') === null && A.admissionClock('bad', '2026-09-29') === null, 'no receipt date → no clock');
ok(A.applicationReceivedOn({ applicationDate: '2026-09-01', joinDate: '2026-08-01' }) === '2026-09-01' && A.applicationReceivedOn({ joinDate: '2026-08-01' }) === '2026-08-01', 'older rows fall back to joinDate');
ok(A.isHaryana('hr') && A.isHaryana('Haryana') && !A.isHaryana('mp') && !A.isHaryana(undefined), 'Haryana detection');

// ── approve / reject validation ──
const T = { today: '2026-10-16', receivedOn: '2026-09-01' };
ok(!A.validateAdmission({ admissionDate: '' }, T).ok, 'admission date required');
ok(!A.validateAdmission({ admissionDate: '2026-10-17' }, T).ok, 'no future admission');
ok(!A.validateAdmission({ admissionDate: '2026-08-31' }, T).ok, 'not before the application');
ok(!A.validateAdmission({ admissionDate: '2026-10-01', resolutionDate: '2026-11-01' }, T).ok, 'no future resolution date');
const v = A.validateAdmission({ admissionDate: '2026-10-01' }, T);
ok(v.ok && v.warnings.length === 1, 'missing resolution only warns (never blocks)');
ok(A.validateAdmission({ admissionDate: '2026-10-01', resolutionNo: '12/2026', resolutionDate: '2026-09-30' }, T).warnings.length === 0, 'complete decision — no warning');
ok(!A.validateRejection('  ').ok && !A.validateRejection('abc').ok && A.validateRejection('area se bahar').ok, 'refusal needs a reason (r.17)');
ok(A.appealLastDate('2026-10-16') === '2026-12-15', 'appeal within 60 days (s.114)');

// ── migration 116 ──
const up = read('supabase/migrations/116_member_admission.sql');
const down = read('supabase/migrations/116_member_admission_down.sql');
for (const f of A.MEMBER_ADMISSION_FIELDS) {
  ok(up.includes(`alter table public.members add column if not exists "${f}"`), `116 adds ${f}`);
  ok(down.includes(`drop column if exists "${f}"`), `116 down drops ${f}`);
  ok(read('supabase-tables.sql').includes(`alter table members add column if not exists "${f}" text;`), `supabase-tables.sql has ${f}`);
  ok(read('src/lib/export/entities/member.ts').includes(`internal('${f}'`), `backup/export carries ${f}`);
}
ok(/begin;[\s\S]*commit;/.test(up) && up.includes("values ('116', 'member_admission')") && !/\b(update|delete|drop)\b/i.test(up.replace(/--.*$/gm, '')), '116: one transaction, self-recording, additive only');

// ── wiring ──
const dc = read('src/contexts/DataContext.tsx');
ok(dc.includes('splitAdmissionFields(identitySplitRef.current ? stripMemberPII(m) : m).base;') && dc.includes('return withSoc(base);'), 'memberRow strips the admission columns (base upsert safe before 116)');
ok(/const persistMemberAdmission = [\s\S]*?update\(payload\)[\s\S]*?Migration 116 चलाएँ/.test(dc), 'step-2 writer + mild warning, no rollback');
const fn = (name) => { const i = dc.indexOf(`const ${name} = useCallback(`); return dc.slice(i, dc.indexOf('\n  }, [', i)); };
ok(fn('addMember').includes("data.approvalStatus === 'pending' && !data.applicationDate ? { applicationDate: today }") && fn('addMember').includes('persistMemberAdmission(newMember.id, newMember)'), 'new application stamps its date; step 2 after the base save');
const ap = fn('approveMember');
ok(ap.includes('joinDate: admissionDate') && ap.includes('applicationDate: applicationReceivedOn(member)') && ap.includes('persistMemberAdmission(id, approved)'), 'approve: joinDate = admission date, application date kept, step 2');
ok(ap.indexOf('persistMemberAdmission(id, approved)') < ap.indexOf('postJoiningReceipts(approved'), 'joining receipt dated on the admission date');
const rj = fn('rejectMember');
ok(rj.includes('why.length < 5') && rj.includes('rejectionReason: why') && rj.includes('persistMemberAdmission(id, rejected)'), 'reject: reason required + stored');
ok(dc.includes('approveMember: (id: string, decision?: AdmissionDecision) => void;') && dc.includes('rejectMember: (id: string, reason: string) => void;'), 'context types');

const mem = read('src/pages/Members.tsx');
ok(mem.includes('validateAdmission(') && mem.includes('validateRejection(decisionForm.reason)'), 'decision dialog validates');
ok(mem.includes("approveMember(decision.member.id, { admissionDate: decisionForm.admissionDate"), 'approve passes the admission date + resolution');
ok(mem.includes('admissionClock(applicationReceivedOn(m), today, { societyType: society.societyType })'), 'pending rows show the r.17 / s.16 clock');
ok(mem.includes('renderMemberTable(rejectedMembers, true, true)') && mem.includes('generateMemberRefusalLetterPDF(member, society)'), 'rejected tab: reason + refusal letter');
ok(mem.includes('setAddChooserOpen(true)') && mem.includes("navigate('/member-application')") && !mem.includes("'नया सदस्य जोड़ें (सीधा)'"), 'one "new member" entry with a chooser (U1)');
ok(mem.includes('useOpenOnNew(() => setAddChooserOpen(true))'), '＋ new entry opens the same chooser');
ok(mem.includes('admissionResolutionNo: form.admissionResolutionNo.trim() || undefined') && mem.includes("'दाख़िला तिथि (सदस्य बनने की तिथि)'"), 'recording an admitted member captures the resolution + admission date');

const app = read('src/pages/MemberApplication.tsx');
ok(app.includes('applicationDate: form.applicationDate') && app.includes("'आवेदन प्राप्ति तिथि *'"), 'application records its receipt date');
ok(app.includes("'फ़ोन नम्बर (वैकल्पिक)'") && !/'फ़ोन नम्बर' : 'Phone'\} \*/.test(app), 'phone optional on the application too (U2)');
ok(app.includes('shareCapital: capitalAuto ? autoCapital') && app.includes('readOnly={capitalAuto}'), 'share capital = shares × face value (U8)');
ok(app.includes('validateKyc(form.aadhaar, form.pan)'), 'application captures + validates KYC');

const pdf = read('src/lib/pdf.ts');
ok(/export function generateMemberRefusalLetterPDF\(/.test(pdf) && pdf.includes('appealLastDate(decided)') && pdf.includes('section 114 of the Haryana Co-operative Societies Act, 1984'), 'refusal letter: reasons + appeal date + s.114 for Haryana');

console.log(`member-m2: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
