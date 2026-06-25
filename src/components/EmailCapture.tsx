/**
 * EmailCapture — lead magnet opt-in. Visitor gives email (with explicit
 * marketing consent) and instantly gets the Audit Preparation Checklist PDF;
 * the email is also saved to `leads` and a welcome email is sent via /api/subscribe.
 *
 * Value-first: the PDF is always generated client-side so the visitor gets the
 * magnet even if the network calls hiccup. Consent is required (DPDP-friendly).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { generateAuditChecklistPDF } from '@/lib/auditChecklist';
import { FileCheck2, CheckCircle2, Download, ArrowRight } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE = 'audit-checklist';

const EmailCapture: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company) return; // bot
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: 'सही ईमेल डालें', description: 'कृपया एक मान्य ईमेल पता डालें।', variant: 'destructive' });
      return;
    }
    if (!consent) {
      toast({ title: 'सहमति चाहिए', description: 'चेकलिस्ट व अपडेट पाने के लिए सहमति दें।', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const mail = email.trim();

    // 1) Deliver value FIRST — generate the PDF locally (no network needed),
    //    so the download is instant and never blocked by a slow request.
    try {
      generateAuditChecklistPDF();
      trackEvent('lead_magnet_download', { source: SOURCE });
    } catch {
      toast({ title: 'डाउनलोड नहीं हो सका', description: 'कृपया फिर कोशिश करें।', variant: 'destructive' });
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);

    // 2) Background (fire-and-forget): save the lead + send the welcome email.
    const page = typeof window !== 'undefined' ? window.location.href : null;
    supabase.from('leads')
      .insert([{ email: mail, source: SOURCE, marketing_consent: true, page_url: page }])
      .then(({ error }) => { if (!error) trackEvent('email_signup', { source: SOURCE }); }, () => {});
    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail }),
    }).catch(() => {});
  };

  if (done) {
    return (
      <div className={`rounded-2xl border bg-primary/5 p-6 text-center ${className}`}>
        <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
        <p className="font-bold text-foreground">चेकलिस्ट डाउनलोड हो रही है ✓</p>
        <p className="text-sm text-muted-foreground mt-1">
          अगर डाउनलोड न दिखे तो
          <button onClick={() => generateAuditChecklistPDF()} className="text-primary underline underline-offset-2 mx-1">यहाँ क्लिक करें</button>।
          एक स्वागत-ईमेल भी आपके inbox में भेजी गई है।
        </p>
        <Link to="/register" onClick={() => trackEvent('cta_click', { location: 'leadmagnet_thanks', target: 'register' })}>
          <Button className="gap-1.5 mt-4">अपनी समिति मुफ्त डिजिटल कीजिए <ArrowRight className="h-4 w-4" /></Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border bg-background p-6 ${className}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileCheck2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-bold text-foreground leading-snug">मुफ्त: ऑडिट-तैयारी चेकलिस्ट 📋</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            ऑडिट से पहले क्या तैयार रखें, आम आपत्तियाँ व उनका बचाव — 1-पेज प्रिंट-योग्य PDF।
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="आपका ईमेल / your email" className="flex-1"
          />
          <Button type="submit" className="gap-1.5" disabled={submitting}>
            <Download className="h-4 w-4" /> {submitting ? 'भेज रहे हैं…' : 'मुफ्त चेकलिस्ट पाएँ'}
          </Button>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>मैं चेकलिस्ट व सहकारी-लेखांकन की उपयोगी अपडेट ईमेल पर पाने हेतु सहमत हूँ। कभी भी unsubscribe कर सकते हैं। (<Link to="/privacy" className="text-primary hover:underline">गोपनीयता</Link>)</span>
        </label>
        <input
          type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={company} onChange={(e) => setCompany(e.target.value)}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        />
      </form>
    </div>
  );
};

export default EmailCapture;
