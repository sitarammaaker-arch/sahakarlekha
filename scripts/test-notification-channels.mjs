// Notification channel scaffold (ECR-13) — mirrors src/lib/notificationChannels.ts.
// Run: node scripts/test-notification-channels.mjs

const CHANNELS = ['inApp', 'email', 'sms', 'whatsapp'];

function planDelivery(_msg, prefs, providers) {
  return CHANNELS.map(channel => {
    if (channel === 'inApp') return { channel, status: 'queued', reason: 'in-app centre' };
    if (!prefs.enabled?.[channel]) return { channel, status: 'skipped-disabled', reason: 'channel off' };
    if (!providers?.[channel]) return { channel, status: 'skipped-no-provider', reason: 'no provider configured' };
    return { channel, status: 'queued', reason: 'ready to send' };
  });
}
async function dispatch(msg, prefs, providers, senders = {}) {
  const log = [];
  for (const item of planDelivery(msg, prefs, providers)) {
    if (item.channel === 'inApp') { log.push({ channel: 'inApp', delivered: true, note: 'shown in-app' }); continue; }
    if (item.status !== 'queued') { log.push({ channel: item.channel, delivered: false, note: item.reason }); continue; }
    const sender = senders[item.channel];
    if (!sender) { log.push({ channel: item.channel, delivered: false, note: 'no sender wired' }); continue; }
    try { const r = await sender(item.channel, msg); log.push({ channel: item.channel, delivered: r.ok, note: r.detail || (r.ok ? 'sent' : 'failed') }); }
    catch { log.push({ channel: item.channel, delivered: false, note: 'sender error' }); }
  }
  return log;
}

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
