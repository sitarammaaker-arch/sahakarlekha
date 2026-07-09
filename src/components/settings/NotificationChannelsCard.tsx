import React from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { availableProviders, type NotificationChannel } from '@/lib/notificationChannels';

/**
 * ECR-13 — notification channel preferences (scaffold). A society can switch on
 * email / SMS / WhatsApp for compliance alerts. In-app alerts are always on.
 * Actual sending needs a provider to be wired — until then each enabled external
 * channel shows "provider not configured" so expectations stay honest.
 */
const EXTERNAL: { key: 'email' | 'sms' | 'whatsapp'; channel: NotificationChannel; icon: React.ReactNode; hi: string; en: string }[] = [
  { key: 'email', channel: 'email', icon: <Mail className="h-4 w-4" />, hi: 'ईमेल', en: 'Email' },
  { key: 'sms', channel: 'sms', icon: <Smartphone className="h-4 w-4" />, hi: 'SMS', en: 'SMS' },
  { key: 'whatsapp', channel: 'whatsapp', icon: <MessageSquare className="h-4 w-4" />, hi: 'WhatsApp', en: 'WhatsApp' },
];

export const NotificationChannelsCard: React.FC = () => {
  const { society, updateSociety } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const prefs = society.notificationChannels || {};
  const providers = availableProviders();

  const toggle = (key: 'email' | 'sms' | 'whatsapp', on: boolean) => {
    updateSociety({ notificationChannels: { ...prefs, [key]: on } });
  };

  return (
    <div className="mt-6 p-4 rounded-lg border-2 border-muted bg-muted/30">
      <div className="flex items-center gap-2 font-semibold">
        <Bell className="h-4 w-4 text-primary" />
        <span>{hi ? 'सूचना चैनल (अलर्ट)' : 'Notification Channels (alerts)'}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {hi
          ? 'सांविधिक/अनुपालन अलर्ट किन चैनलों पर भेजें चुनें। इन-ऐप अलर्ट हमेशा चालू रहते हैं।'
          : 'Choose where statutory / compliance alerts go. In-app alerts are always on.'}
      </p>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-md bg-background px-3 py-2">
          <div className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4 text-emerald-600" />{hi ? 'इन-ऐप (नोटिफिकेशन बेल)' : 'In-app (notification bell)'}</div>
          <Badge variant="outline" className="text-[10px] text-emerald-700">{hi ? 'हमेशा चालू' : 'Always on'}</Badge>
        </div>

        {EXTERNAL.map(({ key, channel, icon, hi: h, en }) => {
          const on = !!prefs[key];
          const hasProvider = !!providers[channel];
          return (
            <div key={key} className="flex items-center justify-between rounded-md bg-background px-3 py-2">
              <div className="flex items-center gap-2 text-sm">{icon}{hi ? h : en}</div>
              <div className="flex items-center gap-2">
                {on && !hasProvider && (
                  <Badge variant="outline" className="text-[10px] text-amber-600">
                    {hi ? 'प्रोवाइडर सेट नहीं — अभी नहीं भेजा जाएगा' : 'No provider — not sent yet'}
                  </Badge>
                )}
                <Switch checked={on} onCheckedChange={(v) => toggle(key, v)} aria-label={en} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {hi
          ? 'यह चैनल सेट-अप तैयार है; असली भेजना तब चालू होगा जब एक SMS/ईमेल/WhatsApp प्रोवाइडर (API keys) जोड़ा जाएगा।'
          : 'Channels are wired and ready; real delivery begins once an SMS / email / WhatsApp provider (API keys) is connected.'}
      </p>
    </div>
  );
};
