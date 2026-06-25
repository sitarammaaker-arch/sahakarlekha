/**
 * HelpfulWidget — "Was this helpful? 👍/👎" for blog posts & guide chapters.
 * No login. Saves to `feedback` as type='helpful' (anon insert allowed by RLS).
 * Shows once per page per browser (localStorage guard); 👎 reveals an optional
 * "how can we improve?" box. Fail-soft on errors (RULE 1: no fake success).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { ThumbsUp, ThumbsDown, CheckCircle2, ArrowRight } from 'lucide-react';

const HelpfulWidget: React.FC = () => {
  const { toast } = useToast();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const key = 'sl_helpful_' + path;

  const [done, setDone] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(key)) setDone(true); } catch { /* ignore */ }
  }, [key]);

  const save = async (verdict: 'up' | 'down', note?: string) => {
    setSubmitting(true);
    try {
      const msg = (verdict === 'up' ? '👍 उपयोगी' : '👎 उपयोगी नहीं') + (note ? ` — ${note.trim()}` : '');
      const { error } = await supabase.from('feedback').insert([{
        type: 'helpful',
        message: msg,
        page_url: typeof window !== 'undefined' ? window.location.href : null,
      }]);
      if (error) throw error;
      try { localStorage.setItem(key, verdict); } catch { /* ignore */ }
      trackEvent('helpful_vote', { verdict, page: path });
      setDone(true);
    } catch {
      toast({ title: 'दर्ज नहीं हो सका', description: 'कृपया थोड़ी देर बाद फिर कोशिश करें।', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="my-8 rounded-xl border bg-primary/5 px-5 py-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-foreground text-center">
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> आपकी राय के लिए धन्यवाद! 🙏</span>
        <Link
          to="/register"
          onClick={() => trackEvent('cta_click', { location: 'helpful_thanks', target: 'register' })}
          className="inline-flex items-center gap-1 font-medium text-primary hover:gap-1.5 transition-all"
        >
          अपनी समिति का खाता मुफ्त डिजिटल कीजिए <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="my-8 rounded-xl border bg-muted/30 px-5 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-3 text-center sm:text-left">
        <p className="font-medium text-foreground">क्या यह लेख उपयोगी रहा? / Was this helpful?</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={submitting} onClick={() => save('up')}>
            <ThumbsUp className="h-4 w-4" /> हाँ
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={submitting} onClick={() => setShowComment(true)}>
            <ThumbsDown className="h-4 w-4" /> नहीं
          </Button>
        </div>
      </div>

      {showComment && (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="क्या बेहतर कर सकते हैं? (वैकल्पिक)"
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={submitting} onClick={() => save('down', comment)}>
              {submitting ? 'भेज रहे हैं…' : 'भेजें'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpfulWidget;
