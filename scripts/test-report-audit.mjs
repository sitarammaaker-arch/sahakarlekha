// Report-generated audit trail (audit D-17) — pure logic.
// Run: node scripts/test-report-audit.mjs   (npm run test:report-audit)
import { setReportAuditSink, emitReportGenerated, buildReportAuditInput } from '../src/lib/reportAudit.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const EV = { reportId: 'SL-BS-0062406-20261004-3F9A21C4B7', code: 'BS', title: 'Balance Sheet', pages: 3 };

// the audit row
const inp = buildReportAuditInput(EV);
ok(inp.entityType === 'report' && inp.entityId === EV.reportId, 'the Report ID is the audit entity id');
ok(inp.action === 'create', "uses the non-custody action 'create' — NOT 'export' (that action is reserved for the blocking custody contract)");
ok(inp.after.code === 'BS' && inp.after.title === 'Balance Sheet' && inp.after.pages === 3 && inp.after.format === 'pdf', 'carries code, title, page count and format');
ok(inp.source === 'pdf', "source is 'pdf'");
const keys = JSON.stringify(inp).toLowerCase();
ok(!/pan|aadhaar|phone|password|amount|balance"/.test(keys.replace(/balance sheet/g, '')), 'no personal data or figures in the row');

// the sink: delivery, isolation, no-op
let seen = [];
setReportAuditSink(e => seen.push(e));
emitReportGenerated(EV);
ok(seen.length === 1 && seen[0] === EV, 'an event reaches the bound sink exactly once');
setReportAuditSink(() => { throw new Error('audit table down'); });
let threw = false;
try { emitReportGenerated(EV); } catch { threw = true; }
ok(!threw, 'a failing sink NEVER throws into report generation');
setReportAuditSink(null);
let threw2 = false;
try { emitReportGenerated(EV); } catch { threw2 = true; }
ok(!threw2 && seen.length === 1, 'no sink bound (logged out) is a silent no-op');

console.log(`\nReport audit (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
