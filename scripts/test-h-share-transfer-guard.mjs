#!/usr/bin/env node
// H / RULE 3 · a share transfer is a voucher PAIR bridged by Suspense 9999 plus both members' share
// balances. Prod (2026-07): the transferor half was cancelled from the voucher screen, leaving
// Dr 9999 / Cr 1102 standing — share capital and suspense both overstated by the transfer amount.
// Both halves now carry refType 'share.transfer' + one transfer id, and cancelVoucher refuses them
// (legacy, untagged transfers are recognised by their narration) unless a parent flow asks.
// Run: node scripts/test-h-share-transfer-guard.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const dc = readFileSync(resolve(root, 'src/contexts/DataContext.tsx'), 'utf8');

const tf = dc.slice(dc.indexOf('const transferShareCapital = useCallback'), dc.indexOf('const transferShareCapital = useCallback') + 4000);
ok('one transfer id per transfer', /const transferId = crypto\.randomUUID\(\);/.test(tf));
ok('both halves tagged share.transfer with the same id', (tf.match(/refType: 'share\.transfer', refId: transferId/g) || []).length === 2);

const cv = dc.slice(dc.indexOf('const cancelVoucher = useCallback'), dc.indexOf('const cancelVoucher = useCallback') + 3200);
ok('cancelVoucher refuses a tagged share-transfer half unless viaParent', /current\.refType === 'share\.transfer'[\s\S]{0,200}!opts\?\.viaParent[\s\S]{0,500}return false;/.test(cv));
ok('…and a legacy (untagged) half recognised by narration', /!current\.refType && \(current\.narration \|\| ''\)\.startsWith\('Shares transferred from '\)/.test(cv));
ok('the refusal points to a reverse transfer in Share Register', /Share Register से उल्टा ट्रांसफर/.test(cv));
ok('guard sits after the already-cancelled no-op', cv.indexOf('if (current.isDeleted) return true;') > 0 && cv.indexOf('if (current.isDeleted) return true;') < cv.indexOf("current.refType === 'share.transfer'"));

console.log(`\nH share transfer guard: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
