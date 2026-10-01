#!/usr/bin/env node
// 2026-10-01 · a voucher cancelled from a tab opened BEFORE its posting existed (approved by another
// user) was soft-deleted with no voucher.cancelled — the journal kept counting it. Guarantees:
//   · cancelVoucher's table path checks the DB journal whenever it built no cancel event (not only when
//     the journal was never loaded);
//   · the posting-service flag is re-read when the tab becomes visible and every 5 minutes, so a tab left
//     open across the B2 flip does not keep the client path.
// Run: node scripts/test-cancel-stale-tab.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/contexts/DataContext.tsx'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

const start = src.indexOf('  const cancelVoucher = useCallback(');
const body = src.slice(start, src.indexOf('\n  const ', start + 10));
ok('cancelVoucher found', start > 0);
ok('no cancel event → always check the DB journal (no journalLoaded condition)',
  /if \(cancelEvent\) persistLedgerEvent\(cancelEvent\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*else void ensureVoucherCancelEvent\(current, deletedBy, reason\);/.test(body));
ok('the old journalLoaded-only fallback is gone', !/else if \(!journalLoadedRef\.current\) void ensureVoucherCancelEvent/.test(body));

ok('flag re-read on visibilitychange', /document\.addEventListener\('visibilitychange', refreshPostingFlag\)/.test(src));
ok('flag re-read every 5 minutes, cleaned up on unmount', /setInterval\(refreshPostingFlag, 5 \* 60 \* 1000\)/.test(src) && /clearInterval\(timer\)/.test(src) && /removeEventListener\('visibilitychange', refreshPostingFlag\)/.test(src));
ok('a failed flag read keeps the current value', /if \(!error\) postingServiceRef\.current = data\?\.posting_service === true/.test(src));

console.log(`\ncancel stale tab: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
