// Member-area re-audit 2026-10-17 — stage C (the remaining Haryana Act 1984 / Rules 1989 checks, as warnings).
// Every rule was read in the text first (Act: official consolidation + Act 10 of 2013; Rules: Indian Kanoon copy).
// Run: node scripts/test-member-stage-c.mjs   (npm run test:member-stage-c)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const L = await import(pathToFileURL(resolve(ROOT, 'src/lib/members/legal.ts')).href);
const A = await import(pathToFileURL(resolve(ROOT, 'src/lib/members/admission.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── s.16(a): 18+ ──
ok(/धारा 16\(a\)/.test(L.minorWarning({ dateOfBirth: '2010-05-01' }, '2026-10-18') ?? ''), 'under 18 by DOB warns');
ok(L.minorWarning({ dateOfBirth: '2008-10-18' }, '2026-10-18') === null, 'exactly 18 on the day — no warning');
ok(L.minorWarning({ dateOfBirth: '2008-10-19' }, '2026-10-18') !== null, 'one day short of 18 — warns');
ok(L.minorWarning({ age: 17 }, '2026-10-18') !== null && L.minorWarning({ age: 40 }, '2026-10-18') === null, 'falls back to the recorded age');
ok(L.minorWarning({}, '2026-10-18') === null, 'no age known — no claim');

// ── s.2(p) producer society: r.17 one-month clock does not apply ──
ok(L.isProducerSociety('producer') && L.isProducerSociety('labour') && !L.isProducerSociety('pacs') && !L.isProducerSociety('dairy'), 'producer = producer + labour (s.2(p) includes collective disposal of labour); dairy not assumed');
ok(A.admissionClock('2026-08-01', '2026-10-18', { societyType: 'producer' }).overdue === false && A.admissionClock('2026-08-01', '2026-10-18', { societyType: 'consumer' }).overdue === true, 'r.17 overdue flag off for a producer society only');
const pdf = read('src/lib/pdf.ts');
ok(pdf.includes("const producer = society.societyType === 'producer' || society.societyType === 'labour';") && pdf.includes('producer && isHaryana(society.state)'), 'refusal letter: no s.114(1)(c) appeal promised by a producer society');

// ── r.16: no admission within 14 days before the AGM ──
const agm = (date, extra = {}) => ({ type: 'AGM', date, status: 'scheduled', ...extra });
ok(/नियम 16/.test(L.agmBlackoutWarning('2026-10-10', [agm('2026-10-24')]) ?? ''), 'AGM 14 days later — warns');
ok(L.agmBlackoutWarning('2026-10-10', [agm('2026-10-25')]) === null, 'AGM 15 days later — fine');
ok(L.agmBlackoutWarning('2026-10-10', [agm('2026-10-09')]) === null, 'AGM already held before the admission — fine');
ok(L.agmBlackoutWarning('2026-10-10', [agm('2026-10-12', { status: 'cancelled' })]) === null, 'a cancelled AGM is ignored');
ok(L.agmBlackoutWarning('2026-10-10', [{ type: 'Board', date: '2026-10-12' }]) === null, 'only the annual general meeting counts');

// ── s.22 per share, oldest first ──
const rows = [{ date: '2023-04-01', credit: 1000, debit: 0 }, { date: '2026-07-01', credit: 500, debit: 0 }];
ok(L.shareHeldTwoYears(rows, '2026-10-18') === 1000, 'only the shares held 2 years count (new purchase excluded)');
ok(L.shareHeldTwoYears([...rows, { date: '2025-01-01', credit: 0, debit: 300 }], '2026-10-18') === 700, 'shares given up are taken from the oldest');
ok(L.shareHeldTwoYears([{ date: '2024-10-18', credit: 100, debit: 0 }], '2026-10-18') === 100, 'exactly two years — held long enough');
ok(L.transferTwoYearWarning(1200, 1000) !== null && L.transferTwoYearWarning(1000, 1000) === null, 'warns only above the old-enough amount');

// ── r.18(3): base excludes Government only ──
ok(JSON.stringify(L.REFUND_BASE_ACCOUNTS) === '["1102","1103"]', 'refund base = 1102 + 1103 (Govt 1101 excluded)');

// ── s.114(1)(d) and s.23 dates ──
ok(L.expulsionAppealLastDate('2026-10-18') === '2026-12-17', 'expulsion appeal: 60 days');
ok(L.deathNomineeChoiceUntil('2026-01-31') === '2026-02-28', 's.23(1)(ii): one month, clamped');

// ── s.40 ──
ok(/धारा 40/.test(L.s40ChangeReminder(['address']) ?? '') && L.s40ChangeReminder(['phone']) === null, 's.40 reminder only for photo / address changes');

// ── r.27 and results ──
const roll = { voters: [{ id: 'a', name: 'A' }], excluded: [{ member: { id: 'b', name: 'B' }, reason: 'defaulter' }, { member: { id: 'c', name: 'C' }, reason: 'nominal' }] };
const dq = L.candidateDisqualifications(['a', 'b', 'c'], roll);
ok(dq.length === 2 && /27\(a\)/.test(dq[0].reason), 'r.27(a) defaulter + non-voter flagged; eligible voter passes');
ok(L.electionResultIssues([5, 5, 1], 11, 20).some((w) => /बराबर/.test(w)), 'a top tie is reported');
ok(L.electionResultIssues([5, 4], 8, 20).some((w) => /जोड़/.test(w)) && L.electionResultIssues([5], 30, 20).some((w) => /कुल मतदाताओं/.test(w)), 'votes > cast and cast > voters reported');
ok(L.electionResultIssues([6, 4], 10, 20).length === 0, 'clean result — no issue');

// ── wiring ──
const sr = read('src/pages/ShareRegister.tsx');
ok(sr.includes('haryana: isHaryana(society.state)') && sr.includes("const warning = !(val > 0) || !rules.haryana ? null") && sr.includes('const warnings = (rules.haryana ? ['), 'Share Register: Haryana sections warn only Haryana societies');
ok(sr.includes('heldTwoYears: (memberId: string, date: string) => shareHeldTwoYears(getMemberLedger(memberId), date)'), 'Share Register: s.22 from the member khata');
const mem = read('src/pages/Members.tsx');
ok(mem.includes('minorWarning(decision.member, decisionForm.admissionDate), agmBlackoutWarning(decisionForm.admissionDate, agms)'), 'approval dialog: age + r.16');
ok(mem.includes('expulsionAppealLastDate(statusDate)') && mem.includes('धारा 114(1)(d)'), 'expulsion shows the appeal date');
ok(mem.includes("const consent = settleConsent ? 'सहमति ली (धारा 23(1)(iii))' : 'सहमति दर्ज नहीं';") && mem.includes('धारा 23(1)(ii)'), 'death settlement: s.23 transfer note + consent recorded');
ok(mem.includes('s40ChangeReminder(changed)'), 'edit: s.40 reminder');
ok(read('src/pages/MemberApplication.tsx').includes('minorWarning({ dateOfBirth: form.dateOfBirth || undefined'), 'application: age warning');
const el = read('src/pages/ElectionModule.tsx');
ok(el.includes('voterRoll(members, loans, kccLoans, rollDate)') && el.includes('const activeMembers = roll.voters;') && el.includes('totalVoters: parseInt(form.totalVoters) || roll.voters.length'), 'election: voters + candidates from the voters roll');
ok(el.includes('const winner = tie ? undefined : sorted[0];') && el.includes('electionResultIssues('), 'election: tie names no winner; result checks shown');
ok(!el.includes("title: 'Save failed'"), 'election: Hindi save errors');
ok(read('src/contexts/LanguageContext.tsx').includes("form1MemberList: { hi: 'सदस्य रजिस्टर (नियम 22)'") && read('src/pages/Form1MemberList.tsx').includes("registerReportIdentity(doc, 'F1', society, 'Register of Members (Rule 22)')"), 'member register titled by r.22 (Report ID code unchanged)');

console.log(`member-stage-c: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
