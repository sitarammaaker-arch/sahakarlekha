#!/usr/bin/env node
// Phase-2 C · the "start new year" button announces success only after the cloud accepted the save — the
// server may refuse a rollover (migration 090), and updateSociety then rolls back and shows the reason.
// Run: node scripts/test-fy-rollover-client.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dc = readFileSync(resolve(root, 'src/contexts/DataContext.tsx'), 'utf8');
const ss = readFileSync(resolve(root, 'src/pages/SocietySetup.tsx'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const us = dc.slice(dc.indexOf('  const updateSociety = useCallback('), dc.indexOf('  const closeFinancialYear = useCallback('));
ok('updateSociety calls onSaved only on a successful upsert', /opts\?\.onSaved\?\.\(\);\s*return;/.test(us));
ok('updateSociety calls onFailed after rolling back (error and network)', (us.match(/opts\?\.onFailed\?\.\(/g) || []).length === 3 /* + F1 write-block refusal */ && us.indexOf('setSocietyState(rollback); failToast(error.message);') < us.indexOf("opts?.onFailed?.(error.message)"));
const h = ss.slice(ss.indexOf('const handleRolloverFY = () => {'), ss.indexOf('const [showAddAccount'));
ok('rollover success toast lives inside onSaved', /onSaved: \(\) => toast\(/.test(h));
ok('no success toast outside onSaved', (h.match(/toast\(/g) || []).length === 1);
ok('the toast tells the user the previous year is closing (decision अ)', /closing/.test(h));
console.log(`\nFY rollover client: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
