#!/usr/bin/env node
// G2/G8 · error-log hygiene: benign ResizeObserver notices never reach error_log; every report
// carries the user agent (crawler vs real visitor); a missing hashed chunk gets a real 404 instead
// of the SPA's index.html served as 200 (which the browser then rejects as a JS module).
// Run: node scripts/test-g2-g8-error-hygiene.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { isBenignBrowserNoise } = await import(pathToFileURL(resolve(root, 'src/lib/errorNoise.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

ok('ResizeObserver "undelivered notifications" is noise', isBenignBrowserNoise('ResizeObserver loop completed with undelivered notifications.'));
ok('ResizeObserver "limit exceeded" is noise', isBenignBrowserNoise('ResizeObserver loop limit exceeded'));
ok('real errors are NOT noise', !isBenignBrowserNoise('this.o.at is not a function') && !isBenignBrowserNoise('Failed to fetch dynamically imported module: x'));
ok('a message merely mentioning ResizeObserver is NOT noise', !isBenignBrowserNoise('TypeError: ResizeObserver is not defined'));
ok('null / undefined safe', !isBenignBrowserNoise(undefined) && !isBenignBrowserNoise(null));

const vitals = readFileSync(resolve(root, 'src/lib/vitals.ts'), 'utf8');
const errH = vitals.slice(vitals.indexOf("addEventListener('error'"), vitals.indexOf("addEventListener('unhandledrejection'"));
ok('window.error handler drops noise before tracking or logging', /if \(isBenignBrowserNoise\(e\.message\)\) return;[\s\S]*trackEvent[\s\S]*reportError/.test(errH));

const rep = readFileSync(resolve(root, 'src/lib/errorReporting.ts'), 'utf8');
ok('reportError adds the user agent to context', /navigator\.userAgent/.test(rep) && /\{ \.\.\.\(context \?\? \{\}\), ua \}/.test(rep));

const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
const spa = (vercel.rewrites || []).find(r => r.destination === '/index.html');
const re = spa && new RegExp('^' + spa.source + '$');
ok('SPA rewrite still serves app routes', !!re && re.test('/blog/x') && re.test('/dashboard') && re.test('/'));
ok('SPA rewrite never serves index.html for /assets/* (missing chunk ⇒ 404)', !!re && !re.test('/assets/BlogIndex-NHzHmXeZ.js'));
ok('…nor for /api/*', !!re && !re.test('/api/x'));

console.log(`\nG2/G8 error hygiene: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
