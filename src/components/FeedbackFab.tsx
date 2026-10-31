/**
 * FeedbackFab — floating "सुझाव / समस्या" button inside the logged-in app.
 * Auto-captures the user, society and current page, so real bug reports &
 * suggestions arrive with full context in the admin inbox (type bug|suggestion).
 * Saves to `feedback`; RULE 1 error handling (no fake success).
 */
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquarePlus, Bug, Lightbulb } from 'lucide-react';

export const FeedbackFab: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const { society } = useData();
  const { toast } = useToast();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'suggestion' | 'bug'>('suggestion');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Platform owner already has the inbox; everyone else gets the button.
  if (isSuperAdmin) return null;

  const submit = async () => {
    if (!message.trim()) {
      toast({ title: hi ? 'संदेश लिखें' : 'Write a message', description: hi ? 'कृपया अपनी बात लिखें।' : 'Please write your message.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert([{
        type: kind,
        name: user?.name || null,
        email: user?.email || null,
        user_email: user?.email || null,
        society_id: user?.societyId || null,
        society_name: society?.name || null,
        message: message.trim(),
        page_url: typeof window !== 'undefined' ? window.location.href : null,
      }]);
      if (error) throw error;
      trackEvent('feedback_submit', { kind });
      toast({ title: hi ? 'भेज दिया गया ✓' : 'Sent ✓', description: hi ? 'आपकी बात हम तक पहुँच गई — धन्यवाद!' : 'We have received it — thank you!' });
      setMessage('');
      setOpen(false);
    } catch {
      toast({
        title: hi ? 'भेजा नहीं जा सका' : 'Could not send',
        description: hi
          ? 'कृपया थोड़ी देर बाद फिर कोशिश करें, या WhatsApp +91 94679 18545 पर बताएँ।'
          : 'Please try again shortly, or tell us on WhatsApp +91 94679 18545.',
        variant: 'destructive',
        duration: 10000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={hi ? 'सुझाव या समस्या बताएँ' : 'Share a suggestion or problem'}
        className="print:hidden fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-lg hover:shadow-xl transition-shadow"
      >
        <MessageSquarePlus className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">{hi ? 'सुझाव / समस्या' : 'Feedback'}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hi ? 'सुझाव या समस्या बताएँ' : 'Share a suggestion or problem'}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              type="button" variant={kind === 'suggestion' ? 'default' : 'outline'} size="sm" className="gap-1.5 flex-1"
              onClick={() => setKind('suggestion')}
            >
              <Lightbulb className="h-4 w-4" /> {hi ? 'सुझाव' : 'Suggestion'}
            </Button>
            <Button
              type="button" variant={kind === 'bug' ? 'default' : 'outline'} size="sm" className="gap-1.5 flex-1"
              onClick={() => setKind('bug')}
            >
              <Bug className="h-4 w-4" /> {hi ? 'समस्या' : 'Problem'}
            </Button>
          </div>

          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={kind === 'bug'
              ? (hi ? 'क्या गड़बड़ी हुई? कौन-से पेज पर?' : 'What went wrong? On which page?')
              : (hi ? 'आपका सुझाव लिखें…' : 'Write your suggestion…')}
            autoFocus
          />

          <p className="text-xs text-muted-foreground">
            {hi
              ? 'आपकी समिति, पेज व यूज़र अपने-आप जुड़ जाएँगे — आपको कुछ और भरने की ज़रूरत नहीं।'
              : 'Your society, page and user are attached automatically — nothing else to fill in.'}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (hi ? 'भेज रहे हैं…' : 'Sending…') : (hi ? 'भेजें' : 'Send')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeedbackFab;
