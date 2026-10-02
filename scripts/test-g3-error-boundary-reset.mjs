#!/usr/bin/env node
// G3 · a crashed page must not trap the user. The route wrappers reuse ONE ErrorBoundary instance
// across routes, so a caught error used to stay on screen on every page navigated to afterwards
// (proven in the browser: /zz-crash → sidebar → /vouchers still showed "इस पेज में त्रुटि हुई").
// The boundary now clears when its resetKey (the path) changes.
// Run: node scripts/test-g3-error-boundary-reset.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

const eb = readFileSync(resolve(root, 'src/components/ErrorBoundary.tsx'), 'utf8');
ok('ErrorBoundary takes a resetKey', /resetKey\?: string;/.test(eb));
ok('…and clears a caught error when it changes', /componentDidUpdate\(prev: Props\)[\s\S]{0,200}this\.state\.hasError && prev\.resetKey !== this\.props\.resetKey[\s\S]{0,80}hasError: false/.test(eb));
ok('escape button follows homeHref (staff → dashboard, public → home)', /this\.props\.homeHref \?\? '\/dashboard'/.test(eb) && /'Home पर जाएं'/.test(eb));

const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
ok('staff route boundary resets on path change', /<ErrorBoundary resetKey=\{pathname\}>\{children\}<\/ErrorBoundary>/.test(app));
ok('top-level (public) boundary resets on path change and escapes to /', /<ErrorBoundary resetKey=\{pathname\} homeHref="\/">/.test(app));
const pr = app.slice(app.indexOf('const ProtectedRoute'), app.indexOf('const PublicRoute'));
ok('ProtectedRoute calls useLocation before any early return (hook order)', pr.indexOf('useLocation()') > 0 && pr.indexOf('useLocation()') < pr.indexOf('return '));
ok('no temporary crash route left behind', !/zz-crash|TEMP-G3/.test(app));

console.log(`\nG3 error boundary reset: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
