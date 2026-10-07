// A chart whose screen shows accounts the database lacks is reported (error_log), once per society per page,
// and only when the accounts really loaded. The report is a flag, never a write to accounting data.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { localOnlyAccountsReport } = await import(pathToFileURL(path.join(ROOT, 'src/lib/accounting/localOnlyAccounts.ts')).href);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} — got ${JSON.stringify(a)}`);

console.log('the report');
const seen = new Set();
eq(localOnlyAccountsReport('S1', [], seen), null, 'nothing missing → no report');
ok(!seen.has('S1'), 'an empty list does not mark the society as reported');
const r = localOnlyAccountsReport('S1', [{ id: '5150' }, { id: '5110' }], seen);
ok(r && r.source === 'chart-local-only' && r.context.count === 2 && r.context.societyId === 'S1', 'two missing → one report with the count and society');
eq(r.context.ids, ['5150', '5110'], 'the ids are listed');
ok(/not in the database/.test(r.message), 'the message says what is wrong');
eq(localOnlyAccountsReport('S1', [{ id: '5150' }], seen), null, 'the same society is reported only once per page');
ok(localOnlyAccountsReport('S2', [{ id: '5150' }], seen) !== null, 'another society is reported on its own');
const many = localOnlyAccountsReport('S3', Array.from({ length: 200 }, (_, i) => ({ id: String(i) })), new Set());
ok(many.context.count === 200 && many.context.ids.length === 40, 'the id list is capped (40) so one row stays small, the count stays exact');

console.log('wired into the load path — and it stays a flag');
const dc = readFileSync(path.join(ROOT, 'src/contexts/DataContext.tsx'), 'utf8');
const at = dc.indexOf('localOnlyAccountsReport(sid, newlyAdded, localOnlyReported)');
ok(at > 0, 'the load path calls it with the society id and the per-page Set');
const around = dc.slice(at - 400, at + 300);
ok(/!aErr && aData && aData\.length > 0/.test(around), 'only when the accounts query succeeded and returned rows (never on the cached / template fallback)');
ok(/reportError\(rep\.source, rep\.message, rep\.context\)/.test(around), 'reports through the error_log seam');
ok(!/supabase\.from\('accounts'\)/.test(around), 'no accounts write next to it (RM-01: the load path never writes)');
ok(/const localOnlyReported = new Set<string>\(\)/.test(dc), 'the Set lives at module level (once per page load)');

console.log(`Local-only accounts: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
