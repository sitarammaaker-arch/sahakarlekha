// R2 verifiable Report ID + R9 plan-aware brand footer — pure logic.
// Run: node scripts/test-report-id.mjs   (npm run test:report-id)
import { cyrb53, contentFingerprint, societyIdTag, makeReportId } from '../src/lib/reportId.ts';
import { brandFooterFor, setReportBranding, getReportBranding } from '../src/lib/reportBranding.ts';
import { PLAN_CATALOG } from '../src/lib/plans.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const D = new Date(2026, 9, 4, 8, 41);

// fingerprint: deterministic, content-sensitive
ok(cyrb53('abc') === cyrb53('abc'), 'hash is deterministic');
ok(contentFingerprint('same figures') === contentFingerprint('same figures'), 'same content -> same fingerprint');
ok(contentFingerprint('Cash 1,00,000.00') !== contentFingerprint('Cash 1,00,001.00'), 'one changed figure -> different fingerprint');
ok(contentFingerprint('a') !== contentFingerprint('b') && contentFingerprint('') !== contentFingerprint(' '), 'distinct inputs differ');
ok(/^[0-9A-F]{10}$/.test(contentFingerprint('x')), 'fingerprint is 10 upper-case hex characters');
ok(/^[0-9A-F]{10}$/.test(contentFingerprint('')), 'even empty content gets a well-formed fingerprint');

// society tag
ok(societyIdTag({ registrationNo: 'UDYAM-HR-17-0062406' }) === '0062406', 'tag = last 7 alphanumerics of the registration no.');
ok(societyIdTag({ registrationNo: '503' }) === '503', 'short registration numbers are used whole');
ok(/^N[0-9A-F]{6}$/.test(societyIdTag({ name: 'श्री राम समिति' })), 'no registration no. -> stable tag from the name');
ok(societyIdTag({ name: 'X' }) === societyIdTag({ name: 'X' }), 'name tag is stable');
ok(/^N[0-9A-F]{6}$/.test(societyIdTag(null)), 'null society is handled');

// the ID
const SOC = { registrationNo: 'UDYAM-HR-17-0062406', name: 'Kapil Nutri Store' };
const id = makeReportId({ code: 'BS', society: SOC, date: D, content: 'page-1-content' });
ok(/^SL-BS-0062406-20261004-[0-9A-F]{10}$/.test(id), `ID shape (${id})`);
ok(id === makeReportId({ code: 'BS', society: SOC, date: new Date(2026, 9, 4, 23, 59), content: 'page-1-content' }), 'same report, same day (any time) -> SAME ID');
ok(id !== makeReportId({ code: 'BS', society: SOC, date: D, content: 'page-1-content!' }), 'changed content -> different ID');
ok(id !== makeReportId({ code: 'BS', society: SOC, date: new Date(2026, 9, 5), content: 'page-1-content' }), 'different day -> different ID');
ok(id !== makeReportId({ code: 'TB', society: SOC, date: D, content: 'page-1-content' }), 'different report type -> different ID');
ok(makeReportId({ code: 'b/s', society: SOC, date: D, content: 'x' }).startsWith('SL-BS-'), 'code is sanitised');
ok(makeReportId({ code: '', society: SOC, date: D, content: 'x' }).startsWith('SL-RPT-'), 'empty code falls back to RPT');

// R9: brand footer by plan
for (const p of ['starter', 'plus', 'pro', 'enterprise']) ok(brandFooterFor(p) === false, `${p} is a PAYING plan: no brand footer`);
for (const p of ['trial', 'legacy', 'nonsense', '', undefined, null]) ok(brandFooterFor(p) === true, `${String(p)}: brand footer stays (safe default)`);
// mirrors lib/plans.ts: every plan that costs money (price !== 0, incl. Enterprise's null) is paying
for (const [id2, spec] of Object.entries(PLAN_CATALOG)) {
  ok(brandFooterFor(id2) === (spec.price === 0), `plans.ts agrees: ${id2} (price ${spec.price}) -> brand footer ${spec.price === 0 ? 'on' : 'off'}`);
}
ok(getReportBranding().showBrandFooter === true, 'default is brand ON');
setReportBranding({ showBrandFooter: false }); ok(getReportBranding().showBrandFooter === false, 'can be switched off');
setReportBranding({ showBrandFooter: true }); ok(getReportBranding().showBrandFooter === true, 'and back on');

console.log(`\nReport ID + brand footer (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
