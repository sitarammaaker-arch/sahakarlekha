// No native dialogs: window.confirm / prompt / alert never show in the desktop app's browser pane (or some phones)
// and answer "no" at once, so the action silently did nothing (live, 2026-11-24). lib/confirmAction + ConfirmHost replace them.
// Run: node scripts/test-no-native-confirm.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const C = await import(abs('../src/lib/confirmAction.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── 1. no native dialog anywhere in src (comments ignored) ──
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const offenders = [];
for (const f of walk(SRC).filter(f => /\.(tsx?|jsx?)$/.test(f))) {
  const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const re = /(?:window\.|[^.\w$])(confirm|alert|prompt)\s*\(/g;
  let m;
  while ((m = re.exec(code))) offenders.push(`${f.slice(SRC.length + 1)}: ${m[0].trim()}`);
}
ok(offenders.length === 0, `no window.confirm / alert / prompt in src (found: ${offenders.join(' · ') || '-'})`);

// ── 2. the host is mounted once, in the lazy app shell (signed-in pages only — the public entry stays small) ──
const shell = readFileSync(join(SRC, 'AppDataShell.tsx'), 'utf8');
const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
ok((shell.match(/<ConfirmHost \/>/g) || []).length === 1 && !app.includes('ConfirmHost'), 'ConfirmHost is mounted exactly once, in AppDataShell (not in the App entry)');

// ── 3. the store ──
ok(await C.confirmAction('x') === false, 'no host mounted → confirm refuses (never acts unasked)');
ok(await C.promptAction({ title: 'x' }) === null, 'no host mounted → prompt is cancelled');

let seen = [];
const unsub = C.subscribeConfirm(q => { seen = q; });
const p1 = C.confirmAction('Delete?');
ok(seen.length === 1 && seen[0].kind === 'confirm' && seen[0].title === 'Delete?' && seen[0].destructive === true, 'a confirm is queued, red by default');
const p2 = C.promptAction({ title: 'Reason?', requireValue: true });
ok(seen.length === 2 && seen[1].kind === 'prompt' && seen[1].requireValue && seen[1].destructive === false, 'a second request waits in the queue');
C.answerConfirm(seen[0].id, true);
ok(await p1 === true, 'confirm resolves true on yes');
ok(seen.length === 1 && seen[0].kind === 'prompt', 'the queue moves on');
C.answerConfirm(seen[0].id, 'damaged bags');
ok(await p2 === 'damaged bags', 'prompt resolves the text');
const p3 = C.confirmAction({ title: 'Close?', destructive: false, confirmLabel: 'Close it' });
ok(seen[0].destructive === false && seen[0].confirmLabel === 'Close it', 'options are kept');
C.answerConfirm(seen[0].id, false);
ok(await p3 === false, 'confirm resolves false on cancel');
const p4 = C.noticeAction('Log in again.');
ok(seen[0].kind === 'notice', 'a notice is queued');
C.answerConfirm(seen[0].id, true);
ok((await p4) === undefined, 'notice resolves on OK');
C.answerConfirm(999, true);
ok(seen.length === 0, 'answering an unknown id changes nothing');
unsub();

console.log(`\nNo native confirm: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
