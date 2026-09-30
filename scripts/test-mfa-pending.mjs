#!/usr/bin/env node
// SEC-03 · isMfaPending (src/lib/auth/mfaPending.ts) — reads the hook's mfa_pending claim.
// Run: node scripts/test-mfa-pending.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { isMfaPending } = await import(pathToFileURL(pathResolve(HERE, '../src/lib/auth/mfaPending.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const tok = (claims) => ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');

ok('mfa_pending: true → pending', isMfaPending(tok({ email: 'a@b.c', mfa_pending: true })) === true);
ok('mfa_pending: false → not pending', isMfaPending(tok({ email: 'a@b.c', mfa_pending: false })) === false);
ok('no claim (token minted before 085) → not pending', isMfaPending(tok({ email: 'a@b.c' })) === false);
ok('Devanagari name in the payload decodes (UTF-8, base64url)', isMfaPending(tok({ name: 'सहकार लेखा ~~??>>', mfa_pending: true })) === true);
ok('string "true" is not the boolean claim', isMfaPending(tok({ mfa_pending: 'true' })) === false);
ok('no token → not pending', isMfaPending(null) === false && isMfaPending('') === false);
ok('garbage token → pending (fail closed)', isMfaPending('not-a-jwt') === true && isMfaPending('a.%%%.c') === true);

console.log(`\nmfa-pending: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
