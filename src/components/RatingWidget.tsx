/**
 * RatingWidget — public 1–5 star + optional name/comment review form.
 * Saves to the `feedback` table as type='review' (anon insert allowed by RLS).
 * Reviews stay private until an admin approves them in the inbox; only then do
 * they appear on the homepage via the public_reviews() RPC.
 */
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Star, CheckCircle2 } from 'lucide-react';

const RatingWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company) return; // bot
    if (rating < 1) {
      toast({ title: 'रेटिंग चुनें', description: 'कृपया 1 से 5 तारे चुनें।', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert([{
        type: 'review',
        rating,
        name: name.trim() || null,
        message: message.trim() || null,
        page_url: typeof window !== 'undefined' ? window.location.href : null,
      }]);
      if (error) throw error;
      setDone(true);
    } catch {
      toast({
        title: 'रेटिंग सेव नहीं हो सकी',
        description: 'कृपया थोड़ी देर बाद फिर कोशिश करें।',
        variant: 'destructive',
        duration: 9000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={`text-center p-6 rounded-xl bg-primary/5 border border-primary/20 ${className}`}>
        <CheckCircle2 className="h-9 w-9 text-primary mx-auto mb-2" />
        <p className="font-bold text-foreground">धन्यवाद! 🙏</p>
        <p className="text-sm text-muted-foreground mt-1">आपकी रेटिंग मिल गई — समीक्षा के बाद यह यहाँ दिखेगी।</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`p-5 rounded-xl border bg-background ${className}`}>
      <p className="font-semibold text-foreground mb-3">अपना अनुभव बताएँ / Rate us</p>

      <div className="flex items-center gap-1 mb-4" role="radiogroup" aria-label="रेटिंग">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            aria-label={`${n} स्टार`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star className={`h-8 w-8 transition-colors ${(hover || rating) >= n ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40'}`} />
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="आपका नाम / समिति (वैकल्पिक)" />
        <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="सहकारलेखा आपके लिए कैसा रहा? (वैकल्पिक)" />
        <input
          type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={company} onChange={(e) => setCompany(e.target.value)}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        />
        <Button type="submit" className="w-full gap-2" disabled={submitting}>
          <Star className="h-4 w-4" /> {submitting ? 'भेज रहे हैं…' : 'रेटिंग भेजें / Submit'}
        </Button>
      </div>
    </form>
  );
};

export default RatingWidget;
