import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MailX, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Migration 147 — the "stop the weekly summary" link in a digest email lands here. Public (the link may open
 * signed-out). Unsubscribing needs a button press, never an automatic call on page load: mail scanners pre-open
 * links, and that must not switch anyone's digest off. unsubscribe_by_token() checks the token.
 */
const EmailUnsubscribe: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const token = params.get('t') ?? '';
  const [state, setState] = useState<'ask' | 'busy' | 'done' | 'invalid'>(/^[0-9a-f]{48}$/.test(token) ? 'ask' : 'invalid');

  const confirm = async () => {
    setState('busy');
    try {
      const { data, error } = await supabase.rpc('unsubscribe_by_token', { p_token: token });
      setState(!error && (data as { status?: string } | null)?.status === 'unsubscribed' ? 'done' : 'invalid');
    } catch {
      setState('invalid');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-background">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mx-auto mb-4 shadow-md">
          <span className="text-4xl font-bold leading-none">स</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">सहकार लेखा</h1>
      </div>

      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{hi ? 'साप्ताहिक सारांश' : 'Weekly summary'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(state === 'ask' || state === 'busy') && (
            <>
              <p className="text-sm text-muted-foreground">
                {hi
                  ? 'हर सोमवार आने वाला सारांश ईमेल बंद करना है? सुरक्षा अलर्ट, इनवॉइस और अनुपालन याद-दहानी पहले की तरह आते रहेंगे।'
                  : 'Stop the Monday summary email? Security alerts, invoices and compliance reminders will still arrive.'}
              </p>
              <Button className="w-full" onClick={confirm} disabled={state === 'busy'}>
                {state === 'busy' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MailX className="h-4 w-4 mr-2" />}
                {hi ? 'हाँ, सारांश बंद करें' : 'Yes, stop the summary'}
              </Button>
            </>
          )}
          {state === 'done' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                {hi ? 'सारांश बंद हो गया' : 'Summary stopped'}
              </div>
              <p>{hi
                ? 'दोबारा चालू करने के लिए ऐप में यूज़र मेन्यू → ईमेल सत्यापन खोलें।'
                : 'To turn it back on, open user menu → Email verification in the app.'}</p>
            </div>
          )}
          {state === 'invalid' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-5 w-5 text-red-600" />
                {hi ? 'लिंक अमान्य है' : 'Link invalid'}
              </div>
              <p>{hi
                ? 'ऐप में लॉगिन करके यूज़र मेन्यू → ईमेल सत्यापन से सारांश बंद कर सकते हैं।'
                : 'Sign in and turn the summary off from user menu → Email verification.'}</p>
            </div>
          )}
          {(state === 'done' || state === 'invalid') && (
            <Button className="w-full" variant="outline" onClick={() => navigate('/dashboard')}>
              {hi ? 'ऐप खोलें' : 'Open the app'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailUnsubscribe;
