// The scheduled-backup Edge Function carries its OWN copy of the row reader (it cannot import src/).
// If it loses the optionalTable tolerance, the weekly backup of EVERY society starts failing the moment
// an optional-table entity (member_identity, migration 106) is in the registry but the table is not.
// Source-level guard. Run: node scripts/test-scheduled-backup-optional.mjs
import fs from 'node:fs';
const fn = fs.readFileSync(new URL('../supabase/functions/scheduled-backup/index.ts', import.meta.url), 'utf8');
const src = fs.readFileSync(new URL('../src/lib/export/missingTable.ts', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

ok(/function isMissingTableError\(/.test(fn), 'edge function defines isMissingTableError');
ok(/const missingOk = \(err: string \| null\) => !!entity\.optionalTable && isMissingTableError\(err, entity\.table\)/.test(fn), 'tolerance only for optionalTable entities, matched on the entity table name');
ok((fn.match(/missingOk\(/g) || []).length >= 2, 'both error returns (probe + page) honour it');
// the two copies of the predicate must stay identical
const body = (t) => t.match(/\.includes\(table\.toLowerCase\(\)\) && \(m\.includes\('does not exist'\) \|\| m\.includes\('schema cache'\) \|\| m\.includes\('could not find'\)\)/);
ok(body(fn), 'edge-function predicate has the expected shape');
ok(/m\.includes\(t\) && \(m\.includes\('does not exist'\) \|\| m\.includes\('schema cache'\) \|\| m\.includes\('could not find'\)\)/.test(src), 'src predicate has the same three phrases');

console.log(`\nscheduled-backup optional table: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
