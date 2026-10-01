#!/usr/bin/env node
// TAX-02 · TDS register + bank reconciliation deletes obey RULE 1: rolled back with a destructive toast on
// a cloud failure OR an RLS refusal (0 rows, no error), FY-lock guarded, a deleted challan's links removed.
// Run: node scripts/test-tax02-delete-rollback.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tds = readFileSync(resolve(root, 'src/pages/TdsRegister.tsx'), 'utf8');
const brs = readFileSync(resolve(root, 'src/pages/BankReconciliation.tsx'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const body = (src, name) => { const i = src.indexOf(`const ${name} = (`); return i < 0 ? '' : src.slice(i, src.indexOf('\n  };', i)); };
ok('no console.warn-only delete left in either page', !/console\.warn\(/.test(tds) && !/console\.warn\(/.test(brs));
for (const [src, fn, label] of [[tds, 'handleDeleteEntry', 'TDS entry'], [tds, 'handleDeleteChallan', 'TDS challan'], [brs, 'deleteReconciliation', 'BRS']]) {
  const b = body(src, fn);
  ok(`${label}: FY-lock guard`, /fyLocked/.test(b));
  ok(`${label}: verifies rows (.select('id') + !data?.length)`, /\.select\('id'\)/.test(b) && /!data\?\.length/.test(b));
  ok(`${label}: keeps the previous state for rollback`, /const prev/.test(b));
}
ok('a deleted challan unlinks its entries (RULE 3) and removes the cloud links', /links\.filter\(l => l\.challanId !== id\)/.test(tds) && /eq\('challanId', id\)/.test(tds));
ok('unlinking an entry rolls back on failure', /tds_challan_links'\)\.delete\(\)\.eq\('society_id', societyId\)\.eq\('entryId', entryId\)[\s\S]{0,200}persistLinks\(prev\)/.test(tds));
ok('failures reach error_log (the real reportError is imported)', /import \{ reportError \} from '@\/lib\/errorReporting'/.test(tds) && /import \{ reportError \} from '@\/lib\/errorReporting'/.test(brs));
console.log(`\nTAX-02 delete rollback: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
