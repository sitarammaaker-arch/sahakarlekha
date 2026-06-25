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
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquarePlus, Bug, Lightbulb } from 'lucide-react';

export const FeedbackFab: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const { society } = useData();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'suggestion' | 'bug'>('suggestion');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Platform owner already has the inbox; everyone else gets the button.
  if (isSuperAdmin) return null;

  const submit = async () => {
    if (!message.trim()) {
      toast({ title: 'संदेश लिखें', description: 'कृपया अपनी बात लिखें।', variant: 'destructive' });
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
      toast({ title: 'भेज दिया गया ✓', description: 'आपकी बात हम तक पहुँच गई — धन्यवाद!' });
      setMessage('');
      setOpen(false);
    } catch {
      toast({
        title: 'भेजा नहीं जा सका',
        description: 'कृपया थोड़ी देर बाद फिर कोशिश करें, या WhatsApp +91 94679 18545 पर बताएँ।',
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
        aria-label="सुझाव या समस्या बताएँ"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-lg hover:shadow-xl transition-shadow"
      >
        <MessageSquarePlus className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">सुझाव / समस्या</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>सुझाव या समस्या बताएँ</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              type="button" variant={kind === 'suggestion' ? 'default' : 'outline'} size="sm" className="gap-1.5 flex-1"
              onClick={() => setKind('suggestion')}
            >
              <Lightbulb className="h-4 w-4" /> सुझाव
            </Button>
            <Button
              type="button" variant={kind === 'bug' ? 'default' : 'outline'} size="sm" className="gap-1.5 flex-1"
              onClick={() => setKind('bug')}
            >
              <Bug className="h-4 w-4" /> समस्या
            </Button>
          </div>

          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={kind === 'bug' ? 'क्या गड़बड़ी हुई? कौन-से पेज पर?' : 'आपका सुझाव लिखें…'}
            autoFocus
          />

          <p className="text-xs text-muted-foreground">
            आपकी समिति, पेज व यूज़र अपने-आप जुड़ जाएँगे — आपको कुछ और भरने की ज़रूरत नहीं।
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>रद्द करें</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'भेज रहे हैं…' : 'भेजें'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeedbackFab;
