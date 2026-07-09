/**
 * Notification channel scaffold (ECR-13).
 *
 * This is the PROVIDER-READY plumbing, not a working sender. In-app delivery
 * (the Header bell / notification centre) is live. Email / SMS / WhatsApp are
 * modelled here so the app can (a) let a society choose which channels to use
 * and (b) plan + log what WOULD be sent — but nothing actually goes out until a
 * real provider adapter (ChannelSender) is wired with API keys. Pure & tested by
 * scripts/test-notification-channels.mjs.
 */
export type NotificationChannel = 'inApp' | 'email' | 'sms' | 'whatsapp';
export const CHANNELS: NotificationChannel[] = ['inApp', 'email', 'sms', 'whatsapp'];

/** Which external channels a society has switched on (in-app is always on). */
export interface ChannelPrefs {
  enabled?: Partial<Record<NotificationChannel, boolean>>;
}

export interface NotificationMsg {
  id: string;
  title: string;
  body: string;
  severity?: 'info' | 'warn' | 'critical';
}

export type DeliveryStatus = 'queued' | 'skipped-disabled' | 'skipped-no-provider';
export interface DeliveryPlanItem {
  channel: NotificationChannel;
  status: DeliveryStatus;
  reason: string;
}

/**
 * Per channel, decide whether a message WOULD be delivered. in-app is always
 * available; every other channel needs BOTH the society to enable it AND a
 * provider to be configured. Nothing is sent here — this is the plan.
 */
export function planDelivery(
  _msg: NotificationMsg,
  prefs: ChannelPrefs,
  availableProviders: Partial<Record<NotificationChannel, boolean>>,
): DeliveryPlanItem[] {
  return CHANNELS.map((channel): DeliveryPlanItem => {
    if (channel === 'inApp') return { channel, status: 'queued', reason: 'in-app centre' };
    if (!prefs.enabled?.[channel]) return { channel, status: 'skipped-disabled', reason: 'channel off' };
    if (!availableProviders?.[channel]) return { channel, status: 'skipped-no-provider', reason: 'no provider configured' };
    return { channel, status: 'queued', reason: 'ready to send' };
  });
}

/** A real integration (Twilio / SendGrid / WhatsApp Business) implements this. */
export type ChannelSender = (channel: NotificationChannel, msg: NotificationMsg) => Promise<{ ok: boolean; detail?: string }>;

export interface DeliveryLogItem {
  channel: NotificationChannel;
  delivered: boolean;
  note: string;
}

/**
 * Dispatch across the planned channels. Only 'queued' channels are attempted,
 * and each needs a registered sender. With no senders wired (today's state),
 * in-app is delivered and every external channel is logged but NOT sent — which
 * is the honest current behaviour until providers are configured.
 */
export async function dispatch(
  msg: NotificationMsg,
  prefs: ChannelPrefs,
  availableProviders: Partial<Record<NotificationChannel, boolean>>,
  senders: Partial<Record<NotificationChannel, ChannelSender>> = {},
): Promise<DeliveryLogItem[]> {
  const log: DeliveryLogItem[] = [];
  for (const item of planDelivery(msg, prefs, availableProviders)) {
    if (item.channel === 'inApp') { log.push({ channel: 'inApp', delivered: true, note: 'shown in-app' }); continue; }
    if (item.status !== 'queued') { log.push({ channel: item.channel, delivered: false, note: item.reason }); continue; }
    const sender = senders[item.channel];
    if (!sender) { log.push({ channel: item.channel, delivered: false, note: 'no sender wired' }); continue; }
    try {
      const r = await sender(item.channel, msg);
      log.push({ channel: item.channel, delivered: r.ok, note: r.detail || (r.ok ? 'sent' : 'failed') });
    } catch {
      log.push({ channel: item.channel, delivered: false, note: 'sender error' });
    }
  }
  return log;
}

/**
 * Which channels have a configured provider. No provider is wired yet, so every
 * external channel is false — the single place to flip once keys exist.
 */
export function availableProviders(): Partial<Record<NotificationChannel, boolean>> {
  return { inApp: true, email: false, sms: false, whatsapp: false };
}
