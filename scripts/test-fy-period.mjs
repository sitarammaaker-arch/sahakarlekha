#!/usr/bin/env node
// Phase-2 C · fyPeriod helpers. Run: node scripts/test-fy-period.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
const { fyStartOf, fyStartFromLabel, netOpening } = await import(pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/fyPeriod.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
ok('a June date → 1 April same year', fyStartOf('2026-06-15') === '2026-04-01');
ok('1 April itself → that year', fyStartOf('2026-04-01') === '2026-04-01');
ok('31 March → previous year', fyStartOf('2027-03-31') === '2026-04-01');
ok('a January date → previous year', fyStartOf('2027-01-05') === '2026-04-01');
ok('label 2026-27 → 2026-04-01', fyStartFromLabel('2026-27') === '2026-04-01');
ok('bad label → undefined', fyStartFromLabel('april') === undefined && fyStartFromLabel(undefined) === undefined);
ok('net opening Dr', JSON.stringify(netOpening(700, 200)) === JSON.stringify({ drMinor: 500, crMinor: 0 }));
ok('net opening Cr', JSON.stringify(netOpening(100, 400)) === JSON.stringify({ drMinor: 0, crMinor: 300 }));
console.log(`\nfy-period: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
