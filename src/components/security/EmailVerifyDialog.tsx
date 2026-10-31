import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { MailCheck, MailWarning, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Status = { email: string; verified_at: string | null; pending: boolean };

/** Toast copy for request_email_verification()'s non-queued answers (migration 142). */
const REQUEST_MSG: Record<string, [string, string]> = {
  already_verified: ['पहले से verify', 'यह ईमेल पहले ही verify हो चुका है।'],
  too_soon: ['थोड़ा रुकें', 'लिंक अभी-अभी भेजा गया है। 2 मिनट बाद दोबारा कोशिश करें।'],
  suppressed: ['इस पते पर ईमेल नहीं जा सकता', 'इस पते से पहले bounce/शिकायत आई है। एडमिन से अपना सही ईमेल लगवाएँ।'],
  not_staff: ['यूज़र नहीं मिला', 'यह ईमेल किसी चालू यूज़र का नहीं है।'],
  not_signed_in: ['लॉगिन ज़रूरी', 'दोबारा लॉगिन करके कोशिश करें।'],
};

/**
 * Email slice 1 — a user proves their login email is a real inbox they own. Until then no notification is
 * sent to it (claim_outbox skips the row). The address is read from the JWT on the server, never from here.
 */
export const EmailVerifyDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  // 147: only admins receive the weekly digest, so only they see its switch. null = not loaded / not migrated.
  const [digest, setDigest] = useState<boolean | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  // 148: email language for every user. undefined = not loaded / not migrated (hidden); null = never chosen.
  const [emailLocale, setEmailLocale] = useState<'hi' | 'en' | null | undefined>(undefined);
  const [localeBusy, setLocaleBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('my_email_verification');
        setStatus(error ? null : (data as Status | null));
      } catch {
        setStatus(null);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const { data, error } = await supabase.rpc('my_email_preferences');
        const p = data as { weekly_digest?: boolean; locale?: 'hi' | 'en' | null } | null;
        setDigest(error || user?.role !== 'admin' ? null : (p?.weekly_digest ?? true));
        // 'locale' only exists in the reply once migration 148 ran — before that the choice stays hidden.
        setEmailLocale(error || !p || !('locale' in p) ? undefined : (p.locale ?? null));
      } catch {
        setDigest(null);
        setEmailLocale(undefined);
      }
    })();
  }, [open, user?.role]);

  const chooseLocale = async (loc: 'hi' | 'en') => {
    setLocaleBusy(true);
    try {
      const { data, error } = await supabase.rpc('set_my_email_locale', { p_locale: loc });
      if (error || (data as { status?: string } | null)?.status !== 'saved') {
        toast({ title: 'भाषा नहीं बदली', description: error?.message || 'कुछ देर बाद दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
        return;
      }
      setEmailLocale(loc);
      toast({ title: loc === 'en' ? 'Emails will now be in English' : 'अब ईमेल हिंदी में आएँगे' });
    } catch {
      toast({ title: 'भाषा नहीं बदली', description: 'कुछ देर बाद दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
    } finally {
      setLocaleBusy(false);
    }
  };

  const toggleDigest = async (on: boolean) => {
    setDigestBusy(true);
    try {
      const { data, error } = await supabase.rpc('set_my_weekly_digest', { p_on: on });
      if (error || (data as { status?: string } | null)?.status !== 'saved') {
        toast({ title: 'सेटिंग नहीं बदली', description: error?.message || 'कुछ देर बाद दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
        return;
      }
      setDigest(on);
      toast({ title: on ? 'हफ़्ते की रिपोर्ट चालू' : 'हफ़्ते की रिपोर्ट बंद', description: on ? 'हर सोमवार सुबह सारांश आएगा।' : 'अब सोमवार का सारांश नहीं आएगा।' });
    } catch {
      toast({ title: 'सेटिंग नहीं बदली', description: 'कुछ देर बाद दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
    } finally {
      setDigestBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('request_email_verification', { p_locale: hi ? 'hi' : 'en' });
      const s = (data as { status?: string } | null)?.status;
      if (error || !s) {
        toast({ title: 'लिंक नहीं भेजा जा सका', description: error?.message || 'कुछ देर बाद दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
        return;
      }
      if (s === 'queued') {
        toast({ title: 'Verify लिंक भेजा गया', description: `${status?.email ?? ''} पर 1–2 मिनट में ईमेल आएगा। Spam folder भी देखें।` });
        setStatus((p) => (p ? { ...p, pending: true } : p));
        return;
      }
      const [title, description] = REQUEST_MSG[s] ?? ['लिंक नहीं भेजा जा सका', s];
      toast({ title, description, variant: s === 'already_verified' ? 'default' : 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const verified = !!status?.verified_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {verified ? <MailCheck className="h-5 w-5 text-green-600" /> : <MailWarning className="h-5 w-5 text-amber-600" />}
            {hi ? 'ईमेल verify' : 'Email verification'}
          </DialogTitle>
          <DialogDescription>
            {hi
              ? 'सूचनाएँ (इनवॉइस, सुरक्षा अलर्ट, compliance रिमाइंडर) सिर्फ़ verify किए गए ईमेल पर भेजी जाती हैं।'
              : 'Notifications (invoices, security alerts, compliance reminders) go only to a verified email.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !status ? (
          <p className="text-sm text-destructive">
            {hi ? 'स्थिति नहीं मिल सकी। कुछ देर बाद दोबारा खोलें।' : 'Could not load the status. Try again shortly.'}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <div className="font-medium break-all">{status.email}</div>
              <div className={verified ? 'text-green-700' : 'text-amber-700'}>
                {verified
                  ? (hi ? `verify हो गया · ${new Date(status.verified_at as string).toLocaleDateString('en-IN')}` : `Verified · ${new Date(status.verified_at as string).toLocaleDateString('en-IN')}`)
                  : status.pending
                    ? (hi ? 'लिंक भेजा जा चुका है — ईमेल खोलकर क्लिक करें' : 'Link sent — open the email and click it')
                    : (hi ? 'verify नहीं' : 'Not verified')}
              </div>
            </div>
            {!verified && (
              <>
                <p className="text-xs text-muted-foreground">
                  {hi
                    ? 'अगर यह ईमेल ग़लत है या आपका नहीं है, तो लिंक न भेजें — एडमिन से User Management में सही ईमेल लगवाएँ।'
                    : 'If this address is wrong or not yours, do not send a link — ask your admin to fix it in User Management.'}
                </p>
                <Button className="w-full" onClick={send} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {status.pending ? (hi ? 'लिंक दोबारा भेजें' : 'Send the link again') : (hi ? 'Verify लिंक भेजें' : 'Send verification link')}
                </Button>
              </>
            )}
            {emailLocale !== undefined && (
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="text-sm">
                  <div className="font-medium">{hi ? 'ईमेल की भाषा' : 'Email language'}</div>
                  <div className="text-xs text-muted-foreground">
                    {hi ? 'सहकार लेखा के सभी ईमेल इसी भाषा में आएँगे।' : 'All SahakarLekha emails will use this language.'}
                  </div>
                </div>
                <div className="flex gap-1">
                  {(['hi', 'en'] as const).map((loc) => (
                    <Button key={loc} size="sm" disabled={localeBusy}
                      variant={(emailLocale ?? 'hi') === loc ? 'default' : 'outline'}
                      onClick={() => (emailLocale ?? 'hi') !== loc && chooseLocale(loc)}>
                      {loc === 'hi' ? 'हिंदी' : 'English'}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {digest !== null && (
              <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="text-sm">
                  <div className="font-medium">{hi ? 'हफ़्ते की रिपोर्ट (ईमेल)' : 'Weekly summary email'}</div>
                  <div className="text-xs text-muted-foreground">
                    {hi ? 'हर सोमवार सुबह: वाउचर, मंज़ूरी और compliance की गिनती।' : 'Every Monday morning: voucher, approval and compliance counts.'}
                  </div>
                </div>
                <Switch checked={digest} disabled={digestBusy} onCheckedChange={toggleDigest} aria-label={hi ? 'हफ़्ते की रिपोर्ट' : 'Weekly summary'} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
