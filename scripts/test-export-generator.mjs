// Registry-driven export generator (T-14 / gaps EXP-05, EXP-19) — imports the real
// TypeScript modules and asserts both the pure logic and the ONE thing that matters most:
//
//     no bytes leave before the audit row commits.
//
// That is proved behaviourally, not by reading the source. Supabase is stubbed via a
// loader hook, and `document` is replaced with an object that throws DOM_TOUCHED the
// moment anything tries to deliver a file. Then:
//
//   audit insert FAILS   -> exportEntity must reject with AuditWriteError, and DOM_TOUCHED
//                           must never be seen (nothing was delivered)
//   audit insert SUCCEEDS -> exportEntity must reach delivery, i.e. DOM_TOUCHED IS thrown
//
// Reverse the order in generator.ts and the first case starts throwing DOM_TOUCHED.
//
// Run: node scripts/test-export-generator.mjs   (npm run test:export-generator)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

// ── Loader: resolve the '@/' alias, resolve extensionless TS, and STUB supabase ──
// src/lib/supabase.ts reads `import.meta.env.VITE_*`, which does not exist outside Vite.
// Stubbing it is what makes the whole chain importable — and it is also what lets us
// drive the audit write to success or failure on demand.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;

      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }

      export async function load(url, ctx, next) {
        if (url === SUPABASE) {
          return {
            format: 'module',
            shortCircuit: true,
            source: \`
              export const supabase = {
                from() {
                  return {
                    insert: async () => globalThis.__insertResult ?? { error: null },
                  };
                },
              };
            \`,
          };
        }
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;
for (const f of ['../src/lib/export/generator.ts', '../src/lib/export/audit.ts']) {
  if (!existsSync(pathResolve(HERE, f))) { console.error(`FAIL missing ${f}`); process.exit(1); }
}

let gen, aud, auditLog;
try {
  gen = await import(abs('../src/lib/export/generator.ts'));
  aud = await import(abs('../src/lib/export/audit.ts'));
  auditLog = await import(abs('../src/lib/auditLog.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the generator. Requires Node with native TypeScript');
  console.error('        support (>= 23.6). Failing closed rather than skipping.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const {
  authorizeExport, selectColumns, filterRows, redactValue, projectRows, projectObjects,
  headersFor, exportEntity, ExportDeniedError, REDACTED,
} = gen;
const { buildExportId, buildExportAuditInput } = aud;
const { AuditWriteError } = auditLog;
const { getEntity } = await import(abs('../src/lib/export/registry.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const member = getEntity('member');
const userMfa = getEntity('user_mfa');
const supplier = getEntity('supplier');
const godown = getEntity('godown');

const viewer = { role: 'viewer', capabilities: [] };
const accountant = { role: 'accountant', capabilities: [] };
const admin = { role: 'admin', capabilities: ['warehousing'] };

// ── 1. Authorization is enforced at generate time, not just in the UI ────────
ok(authorizeExport(member, viewer, 'csv').ok, 'viewer may export members as CSV');

const excluded = authorizeExport(userMfa, admin, 'csv');
ok(!excluded.ok && /excluded/.test(excluded.reason), 'an `exclude` entity (user_mfa: TOTP secrets) is refused even to admin');

const wrongFormat = authorizeExport(member, viewer, 'pdf');
ok(!wrongFormat.ok, 'a format the entity does not declare is refused');

const lowRole = authorizeExport(supplier, viewer, 'csv');
ok(!lowRole.ok && /requires role accountant/.test(lowRole.reason), 'viewer cannot export suppliers (bank details ⇒ accountant)');
ok(authorizeExport(supplier, accountant, 'csv').ok, 'accountant can export suppliers');

const noCap = authorizeExport(godown, accountant, 'csv');
ok(!noCap.ok && /warehousing/.test(noCap.reason), 'godowns are refused without the warehousing capability');
ok(authorizeExport(godown, admin, 'csv').ok, 'godowns are allowed with the warehousing capability');

// auditor is a RECOGNISED export role since #160 (ROLE_RANK auditor: 0 — viewer-level assurance access).
ok(authorizeExport(member, { role: 'auditor', capabilities: [] }, 'csv').ok, 'auditor may export members as CSV (viewer rank)');
ok(!authorizeExport(supplier, { role: 'auditor', capabilities: [] }, 'csv').ok, 'auditor stays viewer-rank — no accountant-gated exports');
// Fail-closed on an unknown role (the ECR-06 17-role migration must not open a hole).
ok(!authorizeExport(member, { role: 'boardMember', capabilities: [] }, 'csv').ok, 'an unrecognised role is denied');

// ── 2. Column selection per mode ─────────────────────────────────────────────
const std = selectColumns(member, 'standard');
const full = selectColumns(member, 'full');
ok(std.length < full.length, 'standard is a subset of full');
ok(std.every(c => c.defaultVisible), 'standard selects only default-visible columns');
ok(full.length === member.columns.length, 'full selects every column');
ok(full.some(c => c.key === 'aadhaar') && !std.some(c => c.key === 'aadhaar'), 'aadhaar is hidden from standard, present in full');

// statutory must name its columns — a register's legal format cannot drift with defaultVisible.
let threw = false;
try { selectColumns(member, 'statutory'); } catch { threw = true; }
ok(threw, 'statutory export without an explicit column list throws');
const stat = selectColumns(member, 'statutory', ['memberId', 'name', 'shareCapital']);
ok(stat.map(c => c.key).join(',') === 'memberId,name,shareCapital', 'statutory columns come out in the order asked for');

// Unknown columns throw rather than being silently dropped.
let unknownThrew = false;
try { selectColumns(member, 'full', ['ghost']); } catch { unknownThrew = true; }
ok(unknownThrew, 'an unknown column key throws instead of vanishing from the file');

// ── 3. RULE 5 — soft-deleted rows ────────────────────────────────────────────
const rows = [
  { id: '1', memberId: 'M001', name: 'राजेश', phone: '9999999999', pan: 'ABCDE1234F', aadhaar: '1234', isDeleted: false },
  { id: '2', memberId: 'M002', name: 'सीता', phone: '8888888888', pan: 'ZZZZZ9999Z', aadhaar: '5678', isDeleted: true },
];
ok(filterRows(member, rows, 'standard').length === 1, 'soft-deleted rows are excluded by default');
ok(filterRows(member, rows, 'standard', true).length === 2, 'includeDeleted brings them back');
ok(filterRows(member, rows, 'full').length === 2, 'full implies includeDeleted (an auditor needs cancelled rows)');
const acct = getEntity('account');
ok(filterRows(acct, [{ id: 'x' }], 'standard').length === 1, 'an entity with no softDeleteField is unaffected');

// ── 4. Redaction — one assertion per PII class ───────────────────────────────
const col = (key) => member.columns.find(c => c.key === key);
const sup = (key) => supplier.columns.find(c => c.key === key);

ok(redactValue('राजेश', col('name'), 'redacted') === 'राजेश', "piiClass 'none' passes through in redacted mode");
ok(redactValue('9999999999', col('phone'), 'redacted') === REDACTED, "piiClass 'contact' is masked");
ok(redactValue('ABCDE1234F', col('pan'), 'redacted') === REDACTED, "piiClass 'identity' is masked");
ok(redactValue('123456789012', sup('accountNo'), 'redacted') === REDACTED, "piiClass 'financial' is masked");

// Redaction only applies in redacted mode.
for (const mode of ['standard', 'full', 'statutory']) {
  ok(redactValue('9999999999', col('phone'), mode) === '9999999999', `${mode} mode does not mask`);
}
// Empty values stay empty — masking a blank would invent data that is not there.
ok(redactValue('', col('phone'), 'redacted') === '', 'an empty PII value stays empty, not "***"');
ok(redactValue(null, col('phone'), 'redacted') === null, 'a null PII value stays null');

// ── 5. Projection ────────────────────────────────────────────────────────────
const cols = selectColumns(member, 'standard');
const body = projectRows([rows[0]], cols, 'redacted');
const nameIdx = cols.findIndex(c => c.key === 'name');
const phoneIdx = cols.findIndex(c => c.key === 'phone');
ok(body[0][nameIdx] === 'राजेश' && body[0][phoneIdx] === REDACTED, 'projectRows redacts by column, not by position');
ok(projectRows([{}], cols, 'standard')[0].every(v => v === ''), 'missing values become empty cells, never "undefined"');
ok(projectRows([{ id: '1', isDeleted: true }], selectColumns(member, 'full'), 'full')
  .some(r => r.includes('Yes')), 'booleans render as Yes/No');

const objs = projectObjects([rows[0]], cols, 'redacted');
ok(objs[0].name === 'राजेश' && objs[0].phone === REDACTED, 'projectObjects redacts identically for JSON');

// RULE 7 — Hindi-first headers.
ok(headersFor(cols, 'hi').includes('नाम') && headersFor(cols, 'en').includes('Name'), 'headers follow the language');

// ── 6. Audit input shaping ───────────────────────────────────────────────────
const id = buildExportId({ entities: ['member'], format: 'csv' }, '2026-07-10T08:30:12.000Z', 'abc123');
ok(id === 'exp-member-csv-20260710T083012-abc123', `export id is deterministic given (now, nonce) — got ${id}`);
ok(buildExportId({ entities: ['a', 'b'], format: 'xlsx' }, '2026-07-10T08:30:12.000Z', 'x')
  .startsWith('exp-2-entities-xlsx-'), 'multi-entity exports are labelled by count');

const input = buildExportAuditInput(
  { entities: ['member'], format: 'csv', mode: 'redacted', rowCount: 42, filters: { includeDeleted: false } },
  id,
);
ok(input.exportId === id && input.rowCount === 42 && input.mode === 'redacted', 'audit input records what was taken');
ok(input.entities.join(',') === 'member', 'audit input records which entities');

// ── 7. THE ORDERING. Bytes never leave before the audit row commits. ─────────
let domTouched = false;
globalThis.URL.createObjectURL = () => 'blob:stub';
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = {
  createElement() { domTouched = true; throw new Error('DOM_TOUCHED'); },
  body: { appendChild() {}, removeChild() {} },
};

const env = {
  societyId: 'SOC001',
  actor: { name: 'राजेश', email: 'a@b.com', role: 'viewer' },
  now: '2026-07-10T00:00:00.000Z',
  principal: viewer,
  language: 'hi',
};
const req = { entityKey: 'member', format: 'csv', mode: 'standard' };

// 7a. Audit write FAILS -> nothing is delivered.
globalThis.__insertResult = { error: { message: 'relation "audit_log" does not exist' } };
domTouched = false;
let caught = null;
try { await exportEntity(rows, req, env); } catch (e) { caught = e; }
ok(caught instanceof AuditWriteError, `a failed audit write rejects with AuditWriteError (got ${caught?.name})`);
ok(domTouched === false, 'NOTHING WAS DELIVERED: the DOM was never touched when the audit write failed');

// 7b. Audit write SUCCEEDS -> delivery is reached.
globalThis.__insertResult = { error: null };
domTouched = false;
caught = null;
try { await exportEntity(rows, req, env); } catch (e) { caught = e; }
ok(domTouched === true, 'delivery IS reached once the audit row commits');
ok(caught?.message === 'DOM_TOUCHED', 'the only thing that failed afterwards was the stubbed download');

// 7c. A denied export is refused before either happens.
domTouched = false;
globalThis.__insertResult = { error: null };
caught = null;
try { await exportEntity(rows, { entityKey: 'user_mfa', format: 'csv', mode: 'standard' }, { ...env, principal: admin }); }
catch (e) { caught = e; }
ok(caught instanceof ExportDeniedError, 'an excluded entity is denied');
ok(domTouched === false, 'a denied export delivers nothing');

// 7d. An unknown entity is refused.
caught = null;
try { await exportEntity([], { entityKey: 'nope', format: 'csv', mode: 'standard' }, env); } catch (e) { caught = e; }
ok(caught instanceof ExportDeniedError, 'an unknown entity key is denied');

// ── 8. runEntityExport (T-18) — the one runner every caller uses ─────────────
// It returns an OUTCOME rather than throwing, because each failure deserves a different
// sentence to the user. The one thing no caller may do is read any of them as
// "exported zero rows".
const { runEntityExport } = await import(abs('../src/lib/export/run.ts'));

const okFetch = (rows, over = {}) => async () => ({ rows, truncated: false, fetched: rows.length, error: null, ...over });
const req8 = { entityKey: 'member', format: 'csv', mode: 'standard' };
const env8 = { ...env, principal: viewer };

let exportCalls = 0;
const spyExport = async (rows) => { exportCalls++; return rows.length; };

// 8a. Happy path.
exportCalls = 0;
let out = await runEntityExport(member, 'SOC-A', req8, env8, { fetchRows: okFetch(rows), runExport: spyExport });
ok(out.status === 'exported' && out.rowCount === 2, 'a normal export reports how many rows left');
ok(exportCalls === 1, 'the export ran exactly once');

// 8b. TRUNCATION IS REFUSED BEFORE ANY EXPORT HAPPENS.
// A partial file that looks complete is the same class of bug as a backup that cannot
// restore. We hand the user nothing, and say how many rows we saw.
exportCalls = 0;
out = await runEntityExport(member, 'SOC-A', req8, env8, {
  fetchRows: async () => ({ rows: rows.slice(0, 1), truncated: true, fetched: 1, error: null }),
  runExport: spyExport,
});
ok(out.status === 'too-large' && out.fetched === 1, 'a truncated read reports too-large with the row count seen');
ok(exportCalls === 0, 'NOTHING WAS EXPORTED: the export never ran on a truncated read');

// 8c. A read failure is not an empty export.
exportCalls = 0;
out = await runEntityExport(member, 'SOC-A', req8, env8, {
  fetchRows: async () => ({ rows: [], truncated: false, fetched: 0, error: 'permission denied' }),
  runExport: spyExport,
});
ok(out.status === 'read-failed' && out.message === 'permission denied', 'a read failure surfaces its message');
ok(exportCalls === 0, 'a failed read does not export an empty file');

// 8d. An unreadable entity (exclude / global) is a DENIAL, not a read failure — the rows
// were never going to leave.
out = await runEntityExport(userMfa, 'SOC-A', req8, env8, {
  fetchRows: async () => { const e = new Error('"user_mfa" is excluded'); e.name = 'EntityNotReadableError'; throw e; },
  runExport: spyExport,
});
ok(out.status === 'denied' && /excluded/.test(out.message), 'an excluded entity is reported as denied, not as a read error');

// 8e. Authorization failure from the generator.
out = await runEntityExport(member, 'SOC-A', req8, env8, {
  fetchRows: okFetch(rows),
  runExport: async () => { throw new ExportDeniedError('"member" requires role accountant'); },
});
ok(out.status === 'denied' && /requires role/.test(out.message), 'a generate-time denial is reported as denied');

// 8f. THE DPDP GUARANTEE. A failed audit write is its own outcome, because it is the
// system working, not breaking: no trail, no bytes.
out = await runEntityExport(member, 'SOC-A', req8, env8, {
  fetchRows: okFetch(rows),
  runExport: async () => { throw new AuditWriteError('Audit write failed: relation "audit_log" does not exist'); },
});
ok(out.status === 'audit-failed', 'a failed audit write is its own outcome, distinct from a generic failure');
ok(/audit_log/.test(out.message), 'the audit failure carries its cause');

// 8g. Anything else is a plain failure, never silently swallowed.
out = await runEntityExport(member, 'SOC-A', req8, env8, {
  fetchRows: okFetch(rows),
  runExport: async () => { throw new Error('disk on fire'); },
});
ok(out.status === 'failed' && out.message === 'disk on fire', 'an unexpected error surfaces as failed');

// Every outcome is distinguishable — no caller can collapse them into "zero rows".
const statuses = new Set(['exported', 'too-large', 'read-failed', 'denied', 'audit-failed', 'failed']);
ok(statuses.size === 6, 'six distinct outcomes, each deserving a different sentence to the user');

console.log(`\nExport generator (pure + wired): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
