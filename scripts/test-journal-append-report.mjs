#!/usr/bin/env node
// A failed journal append must be REPORTED (error_log), never only console-warned — Assandh lost its
// journal for weeks and the cause could not be recovered because it only hit the browser console. CI-safe.
//
// Run: node scripts/test-journal-append-report.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');
const a = dc.indexOf('const persistLedgerEvent = (ev: LedgerEvent) => {');
const body = dc.slice(a, dc.indexOf('\n  };', a) + 5);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

ok('persistLedgerEvent exists', a > 0);
ok('an insert error is reported to error_log with the event identity and code', /reportError\('ledger-event-append', msg, \{ eventType: ev\.eventType, aggregateId: ev\.aggregateId, sequence: ev\.sequence, code: code \?\? null \}\)/.test(body)
  && /if \(error\) report\(error\.message, error\.code\)/.test(body));
ok('a rejected promise is reported too', /\(e: unknown\) => report\(/.test(body));
ok('a synchronous throw is reported too', /catch \(e\) \{ report\(/.test(body));
ok('no silent-only console.warn path remains', (body.match(/console\.warn/g) || []).length === 1 && body.indexOf('console.warn') < body.indexOf('reportError('));

console.log(`\njournal append report: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
