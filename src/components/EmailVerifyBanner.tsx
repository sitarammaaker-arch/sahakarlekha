/**
 * EmailVerifyBanner — slim in-app nudge for a signed-in society user whose login email is not verified yet
 * (migration 142). Until it is, no notification reaches them: compliance reminders, the weekly digest and
 * security alerts are skipped by claim_outbox. "बाद में" hides it for 7 days on this browser. Presentation only —
 * the verified-address rule itself is enforced server-side.
 */
import React, { useEffect, useState } from 'react';
import { MailWarning } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { EmailVerifyDialog } from '@/components/security/EmailVerifyDialog';

const SNOOZE_KEY = 'sl.emailVerifyBanner.snoozedUntil';
const SNOOZE_MS = 7 * 86_400_000;

const snoozed = (): boolean => {
  try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
};

const EmailVerifyBanner: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // A platform admin viewing a society is not a society user: nothing to verify (alerts reach them directly).
    if (!user?.societyId || isSuperAdmin || snoozed()) { setShow(false); return; }
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('my_email_verification');
        const s = data as { verified_at?: string | null; pending?: boolean } | null;
        if (!alive || error || !s) return;   // no status (e.g. before migration 142) → stay quiet
        setShow(!s.verified_at);
        setPending(!!s.pending);
      } catch { /* stay quiet */ }
    })();
    return () => { alive = false; };
  }, [user?.societyId, user?.email, isSuperAdmin, open]);   // re-check when the dialog closes

  if (!show) return null;

  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* per-session only */ }
    setShow(false);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm dark:bg-amber-950/30">
        <MailWarning className="h-4 w-4 text-amber-700 shrink-0" />
        <span className="text-amber-900 dark:text-amber-200">
          {pending
            ? (hi ? 'Verify लिंक भेजा जा चुका है — अपना ईमेल खोलकर बटन दबाएँ।' : 'A verification link was sent — open your email and click it.')
            : (hi
              ? 'आपका ईमेल verify नहीं है, इसलिए compliance रिमाइंडर और सुरक्षा अलर्ट आप तक नहीं पहुँचते।'
              : 'Your email is not verified, so compliance reminders and security alerts do not reach you.')}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <button type="button" className="font-medium text-amber-900 underline dark:text-amber-200" onClick={() => setOpen(true)}>
            {hi ? 'अभी verify करें' : 'Verify now'}
          </button>
          <button type="button" className="text-amber-800/80 hover:underline dark:text-amber-300/80" onClick={later}>
            {hi ? 'बाद में' : 'Later'}
          </button>
        </span>
      </div>
      <EmailVerifyDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

export default EmailVerifyBanner;
