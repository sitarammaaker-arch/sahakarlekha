/**
 * EmailCapture — topic-matched lead magnet opt-in. Visitor gives email (with
 * explicit marketing consent) and instantly gets the chosen checklist PDF; the
 * email is also saved to `leads` and a welcome email is sent via /api/subscribe.
 *
 * Value-first: the PDF is generated client-side FIRST so the download is instant
 * and never blocked by the network. Consent is required (DPDP-friendly). A
 * per-magnet localStorage flag remembers a download so we don't ask again.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackEvent } from '@/lib/analytics';
import { MAGNETS, type MagnetKey } from '@/lib/leadMagnetsMeta';

// J1: the PDF engine (jspdf) loads only when a checklist is actually generated.
const generateMagnet = (key: MagnetKey) => { void import('@/lib/leadMagnets').then(m => m.generateMagnet(key)); };
import { FileCheck2, CheckCircle2, Download, ArrowRight } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// English heading/blurb per magnet (the Hindi copy lives in leadMagnetsMeta).
const MAGNET_EN: Record<MagnetKey, { title: string; blurb: string }> = {
  'audit-checklist': { title: 'Free: Audit Preparation Checklist 📋', blurb: 'What to keep ready before the audit, common objections and how to answer them — a 1-page printable PDF.' },
  'gst-checklist': { title: 'Free: GST & TDS Month-End Checklist 🧾', blurb: 'What to file every month, which documents to keep and common mistakes — for cooperative societies.' },
  'inventory-checklist': { title: 'Free: Inventory & Stock Checklist 📦', blurb: 'Stock setup, monthly reconciliation and valuation — for marketing and consumer societies.' },
};

const EmailCapture: React.FC<{ magnet?: MagnetKey; className?: string }> = ({
  magnet = 'audit-checklist',
  className = '',
}) => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  const m = MAGNETS[magnet] || MAGNETS['audit-checklist'];
  const mEn = MAGNET_EN[magnet] || MAGNET_EN['audit-checklist'];
  const lsKey = 'sl_lead_' + magnet;

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(lsKey)) setDone(true); } catch { /* ignore */ }
  }, [lsKey]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company) return; // bot
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: L('सही ईमेल डालें', 'Enter a valid email'), description: L('कृपया एक मान्य ईमेल पता डालें।', 'Please enter a valid email address.'), variant: 'destructive' });
      return;
    }
    if (!consent) {
      toast({ title: L('सहमति चाहिए', 'Consent needed'), description: L('चेकलिस्ट व अपडेट पाने के लिए सहमति दें।', 'Please give consent to receive the checklist and updates.'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const mail = email.trim();

    // 1) Deliver value FIRST — generate the PDF locally (no network needed).
    try {
      generateMagnet(magnet);
      trackEvent('lead_magnet_download', { magnet });
    } catch {
      toast({ title: L('डाउनलोड नहीं हो सका', 'Download failed'), description: L('कृपया फिर कोशिश करें।', 'Please try again.'), variant: 'destructive' });
      setSubmitting(false);
      return;
    }
    try { localStorage.setItem(lsKey, '1'); } catch { /* ignore */ }
    setDone(true);
    setSubmitting(false);

    // 2) Background (fire-and-forget): save the lead + send the welcome email.
    const page = typeof window !== 'undefined' ? window.location.href : null;
    supabase.from('leads')
      .insert([{ email: mail, source: magnet, marketing_consent: true, page_url: page }])
      .then(({ error }) => { if (!error) trackEvent('email_signup', { magnet }); }, () => {});
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
        <p className="font-bold text-foreground">{L('चेकलिस्ट तैयार है ✓', 'Your checklist is ready ✓')}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {L('डाउनलोड न दिखे तो', 'If the download does not start,')}
          <button onClick={() => generateMagnet(magnet)} className="text-primary underline underline-offset-2 mx-1">{L('यहाँ क्लिक करें', 'click here')}</button>{L('।', '.')}
        </p>
        <Link to="/register" onClick={() => trackEvent('cta_click', { location: 'leadmagnet_thanks', target: 'register' })}>
          <Button className="gap-1.5 mt-4">{L('अपनी समिति डिजिटल कीजिए', 'Take your society digital')} <ArrowRight className="h-4 w-4" /></Button>
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
          <p className="font-bold text-foreground leading-snug">{L(m.uiTitle, mEn.title)}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{L(m.uiBlurb, mEn.blurb)}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={L('आपका ईमेल', 'Your email')} className="flex-1"
          />
          <Button type="submit" className="gap-1.5" disabled={submitting}>
            <Download className="h-4 w-4" /> {submitting ? L('भेज रहे हैं…', 'Sending…') : L('मुफ्त PDF पाएँ', 'Get the free PDF')}
          </Button>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>{L('मैं चेकलिस्ट व सहकारी-लेखांकन की उपयोगी अपडेट ईमेल पर पाने हेतु सहमत हूँ। कभी भी unsubscribe कर सकते हैं।', 'I agree to receive the checklist and useful cooperative-accounting updates by email. You can unsubscribe at any time.')} (<Link to="/privacy" className="text-primary hover:underline">{L('गोपनीयता', 'Privacy')}</Link>)</span>
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
