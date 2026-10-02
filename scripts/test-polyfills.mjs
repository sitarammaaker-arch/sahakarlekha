#!/usr/bin/env node
// G1 · src/polyfills.ts defines .at / Object.hasOwn / findLast(Index) with spec semantics when MISSING,
// and is loaded first. Simulates an old browser by deleting the natives first.
// Run: node scripts/test-polyfills.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TA = Object.getPrototypeOf(Int8Array.prototype);
delete Array.prototype.at; delete String.prototype.at; delete TA.at; delete Object.hasOwn;
delete Array.prototype.findLast; delete Array.prototype.findLastIndex;
await import(pathToFileURL(resolve(root, 'src/polyfills.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
ok('Array.at positive / negative / out of range', [1, 2, 3].at(0) === 1 && [1, 2, 3].at(-1) === 3 && [1, 2, 3].at(5) === undefined && [1, 2, 3].at(-4) === undefined);
ok('String.at', 'सहकार'.at(0) === 'स' && 'abc'.at(-1) === 'c');
ok('TypedArray.at', new Uint8Array([7, 8]).at(-1) === 8);
ok('Object.hasOwn own vs inherited', Object.hasOwn({ a: 1 }, 'a') && !Object.hasOwn({}, 'toString'));
let threw = false; try { Object.hasOwn(null, 'a'); } catch { threw = true; }
ok('Object.hasOwn(null) throws like the spec', threw);
ok('findLast / findLastIndex', [1, 4, 2, 5].findLast(x => x % 2 === 0) === 2 && [1, 4, 2, 5].findLastIndex(x => x > 3) === 3 && [1].findLastIndex(x => x > 9) === -1);
ok('polyfilled methods are non-enumerable (no for-in leaks)', !Object.keys(Array.prototype).includes('at') && (() => { for (const k in []) if (k === 'at') return false; return true; })());
const main = readFileSync(resolve(root, 'src/main.tsx'), 'utf8');
ok('main.tsx imports the polyfills FIRST', main.split(/\r?\n/).find(l => l.startsWith('import')) === 'import "./polyfills";');
console.log(`\npolyfills: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
