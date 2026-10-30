import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MailCheck, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Email slice 1 (migration 142) — the link in the verification email lands here. Public: the link may be
 * opened in a browser where the user is not signed in. confirm_email_verification() checks the token.
 */
const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const [state, setState] = useState<'checking' | 'verified' | 'invalid'>('checking');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode double-run would burn the one-time token
    ran.current = true;
    const token = params.get('token') ?? '';
    supabase.rpc('confirm_email_verification', { p_token: token })
      .then(({ data, error }) => setState(!error && (data as { status?: string } | null)?.status === 'verified' ? 'verified' : 'invalid'))
      .catch(() => setState('invalid'));
  }, [params]);

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
          <CardTitle className="text-xl">{hi ? 'ईमेल सत्यापन' : 'Email verification'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'checking' && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {hi ? 'जाँच हो रही है…' : 'Checking…'}
            </div>
          )}
          {state === 'verified' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <MailCheck className="h-5 w-5 text-green-600" />
                {hi ? 'ईमेल सत्यापित हो गया' : 'Email verified'}
              </div>
              <p>{hi ? 'अब सहकार लेखा की सूचनाएँ इस पते पर आएँगी।' : 'SahakarLekha notifications will now reach this address.'}</p>
            </div>
          )}
          {state === 'invalid' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-5 w-5 text-red-600" />
                {hi ? 'लिंक अमान्य या पुराना' : 'Link invalid or expired'}
              </div>
              <p>{hi
                ? 'लिंक 48 घंटे तक ही चलता है और एक ही बार। ऐप में लॉगिन करके यूज़र मेन्यू → ईमेल सत्यापन से नया लिंक भेजें।'
                : 'A link works once, for 48 hours. Sign in and send a new one from the user menu → Email verification.'}</p>
            </div>
          )}
          {state !== 'checking' && (
            <Button className="w-full" variant="outline" onClick={() => navigate('/dashboard')}>
              {hi ? 'ऐप खोलें' : 'Open the app'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
