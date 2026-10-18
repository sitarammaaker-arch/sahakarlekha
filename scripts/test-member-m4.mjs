// Member-audit M4 — when a member leaves (2026-10-17).
//   r.22(c) the real date of ceasing · r.19 expulsion by GM resolution / Board resolution for withdrawal (warn) ·
//   s.24 two-year liability of a past member · s.23 death → nominee, s.55 dues set off, six-month court-order window.
//   Migration 117 (statusResolutionNo / Date) rides its own update, never the base upsert (RULE 1).
// Run: node scripts/test-member-m4.mjs   (npm run test:member-m4)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const C = await import(pathToFileURL(resolve(ROOT, 'src/lib/members/cessation.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── dates ──
ok(C.addMonths('2026-01-31', 1) === '2026-02-28' && C.addMonths('2026-08-31', 6) === '2027-02-28' && C.addMonths('2026-10-17', 24) === '2028-10-17', 'addMonths clamps to the month end');
ok(C.liabilityUntil('2026-10-17') === '2028-10-17' && C.liabilityUntil(undefined) === undefined, 's.24: two years from leaving');
ok(C.isExit('resigned') && C.isExit('expelled') && C.isExit('deceased') && !C.isExit('inactive') && !C.isExit('active'), 'exit statuses');

// ── validation ──
const T = { today: '2026-10-17', joinedOn: '2020-04-01' };
ok(!C.validateStatusChange({ to: 'resigned', effectiveDate: '' }, T).ok, 'date required');
ok(!C.validateStatusChange({ to: 'resigned', effectiveDate: '2026-10-18' }, T).ok, 'no future date');
ok(!C.validateStatusChange({ to: 'deceased', effectiveDate: '2019-01-01' }, T).ok, 'not before the member joined');
ok(C.validateStatusChange({ to: 'deceased', effectiveDate: '2026-05-02' }, T).ok, 'a back-dated death is fine (r.22(c))');
const ex = C.validateStatusChange({ to: 'expelled', effectiveDate: '2026-10-01' }, T);
ok(ex.ok && ex.warnings.some((w) => /नियम 19/.test(w)), 'expulsion without a GM resolution warns (r.19), never blocks');
ok(C.validateStatusChange({ to: 'expelled', effectiveDate: '2026-10-01', resolutionNo: 'AGM/3', resolutionDate: '2026-09-30' }, T).warnings.length === 0, 'with a resolution — no warning');
ok(C.validateStatusChange({ to: 'resigned', effectiveDate: '2026-10-01' }, T).warnings.length === 1 && C.validateStatusChange({ to: 'deceased', effectiveDate: '2026-10-01' }, T).warnings.length === 0, 'resignation warns mildly; death needs no resolution');
ok(!C.validateStatusChange({ to: 'expelled', effectiveDate: '2026-10-01', resolutionNo: 'X', resolutionDate: '2026-12-01' }, T).ok, 'future resolution date refused');

// ── death settlement ──
const d1 = C.deathSettlement({ shareCapital: 1000, dues: 300, dateOfDeath: '2026-08-31' });
ok(d1.setOff === 300 && d1.payableToNominee === 700 && d1.courtOrderWindowUntil === '2027-02-28', 's.55 set-off, rest to the nominee, six-month window (s.23)');
const d2 = C.deathSettlement({ shareCapital: 500, dues: 900 });
ok(d2.setOff === 500 && d2.payableToNominee === 0 && d2.courtOrderWindowUntil === undefined, 'dues larger than the shares — nothing to the nominee');
ok(C.deathSettlement({ shareCapital: 100, dues: 0 }).payableToNominee === 100, 'no dues — all to the nominee');

// ── migration 117 ──
const up = read('supabase/migrations/117_member_status_resolution.sql');
for (const f of C.MEMBER_STATUS_EXTRA_FIELDS) {
  ok(up.includes(`alter table public.members add column if not exists "${f}"`), `117 adds ${f}`);
  ok(read('supabase/migrations/117_member_status_resolution_down.sql').includes(`drop column if exists "${f}"`), `117 down drops ${f}`);
  ok(read('supabase-tables.sql').includes(`alter table members add column if not exists "${f}" text;`), `supabase-tables.sql has ${f}`);
  ok(read('src/lib/export/entities/member.ts').includes(`internal('${f}'`), `backup/export carries ${f}`);
  ok(read('supabase/functions/_shared/backup-core.mjs').includes(`"${f}"`), `committed backup bundle carries ${f}`);
}
ok(up.includes("values ('117', 'member_status_resolution')") && !/\b(update|delete|drop)\b/i.test(up.replace(/--.*$/gm, '')), '117 additive + self-recording');

// ── wiring ──
const dc = read('src/contexts/DataContext.tsx');
ok(/for \(const f of MEMBER_STATUS_EXTRA_FIELDS\) delete base\[f\];/.test(dc), 'memberRow keeps the 117 columns out of the base upsert');
const cs = dc.slice(dc.indexOf('const changeMemberStatus = useCallback('), dc.indexOf('const deleteMember = useCallback('));
ok(cs.includes("const changedAt = opts?.effectiveDate || new Date().toISOString().split('T')[0];"), 'effective date stored (not "today")');
ok(cs.includes('.update({ statusResolutionNo: resolutionNo ?? null, statusResolutionDate: resolutionDate ?? null })') && cs.includes('Migration 117 चलाएँ'), 'resolution in its own update + mild warning');
ok(cs.indexOf('update({ statusReason: reason, statusChangedAt: changedAt })') > 0, 'reason / date update untouched (one missing column cannot drop them)');

const mem = read('src/pages/Members.tsx');
ok(mem.includes('changeMemberStatus(statusMember.id, statusNew, statusReason.trim(), { effectiveDate: statusDate, resolutionNo: statusResNo, resolutionDate: statusResDate || undefined, details })'), 'status dialog passes date + resolution (+ stage C details)');
ok(mem.includes('validateStatusChange({ to: statusNew, effectiveDate: statusDate') && mem.includes("'मृत्यु की तिथि *'"), 'status dialog validates; death asks the date of death');
ok(mem.includes('liabilityUntil(member.statusChangedAt)') && mem.includes('देनदारी'), 'exited members show the s.24 liability date');
ok(mem.includes("member.status === 'deceased' && (member.shareCapital || 0) > 0") && mem.includes('approveShareRefund(settleMember.id, amount, settleForm.date'), 'death settlement → share refund payable (approval step)');
ok(mem.includes('const memberDues = (m: Member) => duesOf(m.id).total;') && read('src/hooks/useMemberDues.ts').includes('loanOutstanding(l)') && read('src/hooks/useMemberDues.ts').includes('!l.isDeleted'), 'dues = every due (stage C: loans, KCC, credit, maintenance, dairy inputs) from the shared hook');

console.log(`member-m4: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
