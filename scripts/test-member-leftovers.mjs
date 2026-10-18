// Member-area re-audit leftovers (2026-10-18) — the five low-priority items left after stages A–D + the final batch:
//   1. Election module: status follows the date, fmtDate, no 'SOC001' fallback, N-seat director results (tie at the
//      cut-off reported, nobody chosen), no `any`.
//   2. The short nominee editors (Share Register, Nomination Register): same r.21 warning + "पूरा नामांकन बदलें" link.
//   3. Excel / CSV headers on member pages follow the page language (PDF stays English: no Devanagari font).
//   4. HEIC/HEIF photos refused up front (scripts/test-member-m6.mjs covers photoFileError itself).
//   5. Member delete guard: housing flats, dairy settlements / inputs / milk, consumer credit sales, active portal login.
// Run: node scripts/test-member-leftovers.mjs   (npm run test:member-leftovers)
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
    return next(spec, ctx);
  }
`));
const imp = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const L = await imp('lib/members/legal.ts');
const S = await imp('lib/members/shareRules.ts');
const H = await imp('lib/members/exportHeaders.ts');
const P = await imp('lib/members/photo.ts');
const { computeEntityLinks } = await imp('lib/entityLinks.ts');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const DEV = /[ऀ-ॿ]/;

// ── 1. Election ──
ok(L.electionStatusOn('2026-10-20', '2026-10-18') === 'upcoming' && L.electionStatusOn('2026-10-18', '2026-10-18') === 'ongoing' && L.electionStatusOn('2026-10-01', '2026-10-18') === 'completed', 'status follows the date');
ok(L.electionStatusOn('2026-12-01', '2026-10-18', true) === 'completed', 'a recorded result is completed whatever the date');
ok(!L.hasElectionResult({ votesCast: 0, candidates: [{ votes: 0 }] }) && L.hasElectionResult({ votesCast: 0, winnerId: 'c_0', candidates: [] }) && L.hasElectionResult({ candidates: [{ votes: 3 }] }), 'result recorded = votes or a winner (legacy winnerId too)');
const C = (...v) => v.map((votes, i) => ({ id: 'c' + i, votes }));
let o = L.electionOutcome(C(10, 7, 5), 1);
ok(JSON.stringify(o) === JSON.stringify({ winnerIds: ['c0'], tiedIds: [], openSeats: 0 }), 'one seat: the top candidate');
o = L.electionOutcome(C(5, 5, 1), 1);
ok(o.winnerIds.length === 0 && o.tiedIds.join() === 'c0,c1' && o.openSeats === 1, 'one seat, top tie: nobody chosen');
o = L.electionOutcome(C(9, 8, 7, 3, 2), 3);
ok(o.winnerIds.join() === 'c0,c1,c2' && o.tiedIds.length === 0, 'three seats: the top three');
o = L.electionOutcome(C(9, 8, 6, 6, 2), 3);
ok(o.winnerIds.join() === 'c0,c1' && o.tiedIds.join() === 'c2,c3' && o.openSeats === 1, 'three seats, tie at the cut-off: two elected, the tied pair reported, one seat open');
o = L.electionOutcome(C(9, 9, 9, 1), 2);
ok(o.winnerIds.length === 0 && o.tiedIds.length === 3 && o.openSeats === 2, 'tie spanning both seats: none chosen');
o = L.electionOutcome(C(4, 0, 0), 3);
ok(o.winnerIds.join() === 'c0' && o.tiedIds.length === 0, '0 votes never elect (no tie among zeros)');
ok(L.electionResultIssues([9, 8, 6, 6], 29, 50, 3).some((w) => /3 सीटों/.test(w)) && L.electionResultIssues([9, 9, 6], 24, 50, 2).length === 0, 'result check: tie at the cut-off for N seats; a top tie inside the seats is fine');
ok(L.electionResultIssues([5, 5, 1], 11, 20).some((w) => /सबसे ज़्यादा मत बराबर/.test(w)), 'one seat keeps the stage-C top-tie message');

const el = read('src/pages/ElectionModule.tsx');
ok(!el.includes("'SOC001'") && el.includes("const societyId = user?.societyId || '';") && el.includes('if (!societyId) {'), "no 'SOC001' fallback; save refused without a society");
ok(el.includes('electionStatusOn(e.electionDate, today, hasElectionResult(e))') && el.includes("rows.filter(e => e.status === tab)"), 'status computed on render; tabs/cards use it');
ok(el.includes('<TableCell>{fmtDate(e.electionDate)}</TableCell>') && el.includes('fmtDate(e.electionDate), e.candidates.length'), 'dates via fmtDate (table + exports)');
ok(el.includes('electionOutcome(updatedCandidates, seats)') && el.includes('tiedAtCutoff: outcome.tiedIds.includes(c.id)') && el.includes("const multiSeat = election.post === 'director';"), 'director: seats input, top N marked, tie flagged');
ok(el.includes('{!resultDone && user?.role === \'admin\' && ('), 'results can be entered after the date has passed');
ok(!/: any\b|as any\b/.test(el), 'no `any` left in ElectionModule');

// ── 2. Nominee editors ──
ok(S.nomineeCountAfterEdit([{ name: 'A', role: 'primary' }, { name: 'B' }, { name: ' ' }], 'A2') === 2 && S.nomineeCountAfterEdit(undefined, '') === 0, 'count = primary (edited) + named additional');
ok(S.nomineeCountWarning(S.nomineeCountAfterEdit([{ name: 'B' }, { name: 'C' }], 'A'), 2)?.includes('नियम 21'), 'three nominees on two shares → r.21 warning');
const syn = S.syncPrimaryNominee([{ id: '1', name: 'Old', relation: 'Son', role: 'primary', sharePercent: 0, age: 30 }, { id: '2', name: 'B', relation: 'Wife', sharePercent: 0 }], { name: ' New ', relation: 'Daughter', phone: '' });
ok(syn?.[0].name === 'New' && syn[0].relation === 'Daughter' && syn[0].age === 30 && syn[0].phone === undefined && syn[1].name === 'B', 'primary entry follows the short edit (other fields kept)');
ok(S.syncPrimaryNominee([{ name: 'Old', relation: 'Son', role: 'primary' }, { name: 'B', relation: '' }], { name: '', relation: '', phone: '' })?.length === 1, 'cleared name drops the primary entry');
ok(S.syncPrimaryNominee([{ name: 'B', relation: '' }], { name: 'X', relation: '', phone: '' }) === undefined && S.syncPrimaryNominee(undefined, { name: 'X', relation: '', phone: '' }) === undefined, 'no primary entry → nominees[] untouched');
ok(S.memberEditLink('a b') === '/members?edit=a%20b', 'deep link to the Members edit form');
for (const f of ['src/pages/ShareRegister.tsx', 'src/pages/NominationRegister.tsx']) {
  const t = read(f);
  ok(t.includes('nomineeCountWarning(nomineeCountAfterEdit(editMember.nominees') && t.includes("'पूरा नामांकन बदलें'") && t.includes('memberEditLink(editMember.id)') && t.includes('syncPrimaryNominee(editMember.nominees'), `${f}: r.21 warning, full-form link, primary entry synced`);
}
ok(!/: any\b|as any\b/.test(read('src/pages/NominationRegister.tsx')), 'no `any` left in NominationRegister');
const mem = read('src/pages/Members.tsx');
ok(mem.includes("const editParam = searchParams.get('edit');") && mem.includes('openEdit(m);') && mem.includes("n.delete('edit')"), 'Members opens ?edit=<id> once, then drops the param');

// ── 3. Export headers ──
for (const [name, cols, n] of [['MEMBER', H.MEMBER_EXPORT_COLUMNS, 17], ['NOMINATION', H.NOMINATION_EXPORT_COLUMNS, 8], ['ELECTION', H.ELECTION_EXPORT_COLUMNS, 7]]) {
  ok(cols.length === n && cols.every((c) => DEV.test(c.hi) && c.en && !DEV.test(c.en)), `${name}: ${n} columns, Hindi + English each`);
}
ok(H.pick(H.ELECTION_EXPORT_COLUMNS, false).join() === 'No.,Title,Post,Date,Candidates,Winner,Status', 'English headers unchanged');
ok(mem.includes('headers: pick(MEMBER_EXPORT_COLUMNS, hi)') && mem.includes('memberStatusLabel(m.status, hi)'), 'Members Excel follows the language');
ok(read('src/pages/NominationRegister.tsx').includes('const csvHeaders = pick(NOMINATION_EXPORT_COLUMNS, hi);'), 'Nomination CSV/Excel follow the language');
ok(el.includes('const csvHeaders = pick(ELECTION_EXPORT_COLUMNS, hi);') && el.includes('head: [pick(ELECTION_EXPORT_COLUMNS, false)]'), 'Election CSV/Excel follow the language; PDF stays English');

// ── 4. HEIC ──
ok(P.photoFileError({ type: 'image/heic', size: 1 })?.includes('Most Compatible') && P.photoFileError({ type: 'image/jpeg', size: 1, name: 'x.jpg' }) === null, 'HEIC refused with how-to; JPG fine');

// ── 5. Member delete guard ──
const base = { vouchers: [], loans: [], sales: [], purchases: [], stockMovements: [], salaryRecords: [], suppliers: [], customers: [], assets: [] };
const blocks = (src, module) => computeEntityLinks('member', 'M', { ...base, ...src }).some((l) => l.module === module && l.blocking);
const none = (src) => computeEntityLinks('member', 'M', { ...base, ...src }).length === 0;
ok(blocks({ sales: [{ memberId: 'M', paymentMode: 'credit' }] }, 'Consumer credit'), 'consumer credit sale blocks');
ok(none({ sales: [{ memberId: 'M', paymentMode: 'cash' }, { memberId: 'M', paymentMode: 'credit', isDeleted: true }, { memberId: 'X', paymentMode: 'credit' }] }), 'cash / soft-deleted / other member sale does not');
ok(blocks({ housingFlats: [{ memberId: 'M' }] }, 'Housing') && none({ housingFlats: [{ memberId: 'M', isDeleted: true }, { memberId: 'X' }, {}] }), 'flat blocks; deleted / other / vacant flat does not');
ok(blocks({ dairySettlements: [{ memberId: 'M' }] }, 'Dairy settlements') && none({ dairySettlements: [{ memberId: 'M', isDeleted: true }] }), 'dairy settlement blocks; deleted one does not');
ok(blocks({ dairyInputIssues: [{ memberId: 'M' }] }, 'Dairy inputs') && none({ dairyInputIssues: [{ memberId: 'M', isDeleted: true }] }), 'dairy input issue blocks; deleted one does not');
ok(blocks({ milkEntries: [{ memberId: 'M' }] }, 'Milk entries') && none({ milkEntries: [{ memberId: 'X' }] }), 'milk entries block');
ok(blocks({ portalLogins: [{ member_id: 'M', is_active: true }] }, 'Portal') && none({ portalLogins: [{ member_id: 'M', is_active: false }] }), 'active portal login blocks; revoked does not');
ok(computeEntityLinks('member', 'M', { ...base, housingFlats: [{ memberId: 'M' }] }).every((l) => DEV.test(l.labelHi) && DEV.test(l.instructionHi)), 'Hindi labels');
const dc = read('src/contexts/DataContext.tsx');
const del = dc.slice(dc.indexOf('const deleteMember = useCallback('), dc.indexOf('const refundShareCapital'));
ok(del.includes('(id: string, domain?: MemberDomainLinkSources)') && del.includes('sales: salesRef.current') && del.includes('kccLoans: kccLoansRef.current, ...domain,'), 'deleteMember gate: consumer sales + page-supplied domain links');
ok(mem.includes("getEntityLinks('member', member.id, memberDomainLinks())") && mem.includes('deleteMember(deleteGuard.id, memberDomainLinks())') && mem.includes('portalLogins: Object.values(portalLogins)'), 'Members passes housing / dairy / portal to the pre-check AND the gate');

console.log(`member-leftovers: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
