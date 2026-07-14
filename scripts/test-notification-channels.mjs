// Notification channel scaffold (ECR-13). Imports the REAL src/lib/notificationChannels.ts
// via the '@/' loader — so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-notification-channels.mjs
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

const { planDelivery, dispatch } = await import(abs('../src/lib/notificationChannels.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const msg = { id: 'n1', title: 'GST due', body: 'GSTR-3B due in 3 days' };
const get = (plan, ch) => plan.find(p => p.channel === ch);

// 1. in-app is always queued regardless of prefs/providers.
const p0 = planDelivery(msg, {}, {});
ok(get(p0, 'inApp').status === 'queued', 'in-app always queued');

// 2. external channel OFF → skipped-disabled.
ok(get(p0, 'email').status === 'skipped-disabled', 'email off → skipped-disabled');

// 3. enabled but NO provider → skipped-no-provider (today's real state).
const p1 = planDelivery(msg, { enabled: { email: true, sms: true } }, { email: false, sms: false });
ok(get(p1, 'email').status === 'skipped-no-provider', 'email on, no provider → skipped-no-provider');
ok(get(p1, 'sms').status === 'skipped-no-provider', 'sms on, no provider → skipped-no-provider');

// 4. enabled AND provider present → queued.
const p2 = planDelivery(msg, { enabled: { email: true } }, { email: true });
ok(get(p2, 'email').status === 'queued', 'email on + provider → queued');

// 5. dispatch with NO senders: in-app delivered, externals not.
const log0 = await dispatch(msg, { enabled: { email: true } }, { email: true }, {});
ok(log0.find(l => l.channel === 'inApp').delivered === true, 'dispatch: in-app delivered');
ok(log0.find(l => l.channel === 'email').delivered === false, 'dispatch: email not sent without a wired sender');
ok(log0.find(l => l.channel === 'email').note === 'no sender wired', 'dispatch: email note = no sender wired');

// 6. dispatch WITH a mock email sender (proves the wiring point works).
const senders = { email: async () => ({ ok: true, detail: 'sent via mock' }) };
const log1 = await dispatch(msg, { enabled: { email: true } }, { email: true }, senders);
ok(log1.find(l => l.channel === 'email').delivered === true, 'dispatch: wired sender delivers');

// 7. a disabled channel is never sent even with a sender present.
const log2 = await dispatch(msg, { enabled: { email: false } }, { email: true }, senders);
ok(log2.find(l => l.channel === 'email').delivered === false, 'dispatch: disabled channel not sent');

console.log(`\nNotification channels (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
