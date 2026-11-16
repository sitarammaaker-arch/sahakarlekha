import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackEvent } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Lock, Mail, Eye, EyeOff, Languages, AlertCircle, KeyRound, HelpCircle, ShieldCheck, PlayCircle, MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '@/lib/socials';
import { LOGOUT_REASON_KEY, parseLogoutReason, type LogoutReason } from '@/lib/auth/loginFailure';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, verifyMfaCode, verifyRecoveryCode, cancelMfa, sendPasswordReset } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ECR-12 — two-factor step: shown after a correct password when the account has 2FA on.
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  // Forgot Password modal
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpSubmitted, setFpSubmitted] = useState(false);
  const [fpEmailSent, setFpEmailSent] = useState(false);
  const [fpFailed, setFpFailed] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);

  // Forgot ID modal — guidance only. It used to be a form that collected a name and a phone number,
  // sent them nowhere and said "request noted" (audit 2026-11-16, J-2).
  const [showForgotId, setShowForgotId] = useState(false);

  // Why this tab was sent here (idle sign-out, or a login that is no longer active) — said once.
  const [logoutReason, setLogoutReason] = useState<LogoutReason | null>(null);
  useEffect(() => {
    try {
      const reason = parseLogoutReason(window.sessionStorage.getItem(LOGOUT_REASON_KEY));
      window.sessionStorage.removeItem(LOGOUT_REASON_KEY);
      setLogoutReason(reason);
    } catch { /* storage blocked — no message */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLogoutReason(null);
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.status === 'ok') {
        trackEvent('login', { method: 'email' });
        navigate('/dashboard');
      } else if (result.status === 'mfa') {
        setMfaStep(true);
        setMfaCode('');
      } else if (result.reason === 'mfa_status_unavailable') {
        // Password was correct, but the 2FA state couldn't be read — login is refused
        // (fail closed), so say that plainly instead of the misleading "wrong password".
        setError(language === 'hi'
          ? 'सुरक्षा जाँच (2FA) पूरी नहीं हो सकी — सर्वर से संपर्क नहीं हुआ। सुरक्षा के लिए लॉगिन रोक दिया गया है। कृपया थोड़ी देर बाद दोबारा कोशिश करें।'
          : 'The security (2FA) check could not be completed — the server was unreachable. Login has been blocked for your safety. Please try again shortly.');
      } else if (result.reason === 'password_reset_required') {
        // W-1: correct legacy password but no Supabase Auth session (JWT). Under
        // tenant RLS the user must reset their password to sign in.
        setError(language === 'hi'
          ? 'साइन इन करने के लिए कृपया "पासवर्ड भूल गए?" से पासवर्ड रीसेट करें।'
          : 'Please reset your password (use "Forgot password?") to sign in.');
      } else if (result.reason === 'network') {
        // Not a wrong password — the request never reached the server (audit J-1).
        setError(L('इंटरनेट से संपर्क नहीं हो पाया — आपका ईमेल / पासवर्ड जाँचा ही नहीं गया। कनेक्शन देखकर दोबारा कोशिश करें।',
          'Could not reach the internet — your email / password were not even checked. Check the connection and try again.'));
      } else if (result.reason === 'service') {
        setError(L('सर्वर से अभी जवाब नहीं मिल रहा — यह आपके पासवर्ड की ग़लती नहीं है। कुछ मिनट बाद दोबारा कोशिश करें।',
          'The server is not responding right now — this is not a problem with your password. Please try again in a few minutes.'));
      } else if (result.reason === 'rate_limited') {
        setError(L('बहुत बार कोशिश हुई है — सुरक्षा के लिए कुछ मिनट रुककर दोबारा कोशिश करें।',
          'Too many attempts — for safety, please wait a few minutes and try again.'));
      } else if (result.reason === 'inactive') {
        // Shown only after a CORRECT password, so it tells a stranger nothing about who has an account.
        setError(L('यह लॉगिन अभी चालू नहीं है — अपनी समिति के Admin से इसे चालू करने को कहें।',
          'This login is not active — ask your society Admin to activate it.'));
      } else {
        setError(language === 'hi' ? 'गलत ईमेल या पासवर्ड' : 'Invalid email or password');
      }
    } catch {
      setError(L('लॉगिन नहीं हो पाया — इंटरनेट कनेक्शन देखकर दोबारा कोशिश करें।', 'Could not sign in — check your connection and try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const ok = useRecovery ? await verifyRecoveryCode(mfaCode) : await verifyMfaCode(mfaCode);
      if (ok) {
        trackEvent('login', { method: useRecovery ? 'email+recovery' : 'email+mfa' });
        navigate('/dashboard');
      } else {
        setError(language === 'hi' ? 'गलत कोड — फिर कोशिश करें' : 'Invalid code — try again');
      }
    } catch {
      setError(language === 'hi' ? 'कोई त्रुटि हुई' : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const exitMfa = () => {
    cancelMfa();
    setMfaStep(false);
    setMfaCode('');
    setUseRecovery(false);
    setError('');
    setPassword('');
  };

  // valid entry: 6-digit TOTP, or a recovery code with ≥8 alphanumerics
  const mfaEntryInvalid = useRecovery
    ? mfaCode.replace(/[^a-zA-Z0-9]/g, '').length < 8
    : mfaCode.length !== 6;

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpEmail.trim()) return;
    setFpLoading(true);
    const result = await sendPasswordReset(fpEmail.trim());
    setFpEmailSent(result.isEmailSent);
    setFpFailed(!result.success);
    setFpSubmitted(true);
    setFpLoading(false);
  };

  const whatsappHelpHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(L(
      'नमस्ते! मुझे सहकार लेखा में लॉगिन / शुरू करने में सहायता चाहिए।',
      'Hello! I need help signing in to / getting started with Sahakar Lekha.'))}`
    : '';

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent/20" />
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-primary-foreground">
          <div className="h-24 w-24 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center mb-8 shadow-lg">
            <span className="text-6xl font-bold leading-none">स</span>
          </div>
          <h1 className="text-4xl font-bold text-center mb-4">सहकार लेखा</h1>
          <p className="text-xl text-center text-primary-foreground/80 mb-2">
            Cooperative Society Accounting System
          </p>
          <p className="text-center text-primary-foreground/60 max-w-md">
            {L('भारतीय सहकारी समितियों के लिए विशेष रूप से डिज़ाइन किया गया क्लाउड-आधारित लेखा सॉफ्टवेयर',
              'Cloud-based accounting software designed especially for Indian cooperative societies')}
          </p>
          {/* What the product IS — no usage / uptime numbers (the old society / member / uptime figures
              were not true; public-claims rule, founder 2026-10-09). */}
          <div className="mt-12 grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-2xl font-bold">{L('हिंदी', 'Hindi')}</p>
              <p className="text-sm text-primary-foreground/70">{L('और English में', 'and English')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{L('डबल-एंट्री', 'Double-entry')}</p>
              <p className="text-sm text-primary-foreground/70">{L('लेखा', 'accounting')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{L('ऑडिट', 'Audit')}</p>
              <p className="text-sm text-primary-foreground/70">{L('के लिए तैयार रिपोर्ट', 'ready reports')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-background">
        {/* Language Toggle */}
        <div className="absolute top-6 right-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLanguage(language === 'hi' ? 'en' : 'hi')}
            className="gap-2"
          >
            <Languages className="h-4 w-4" />
            {language === 'hi' ? 'English' : 'हिंदी'}
          </Button>
        </div>

        {/* Mobile Logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="h-16 w-16 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="text-4xl font-bold leading-none">स</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">सहकार लेखा</h1>
        </div>

        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('welcomeBack')}</CardTitle>
            <CardDescription>
              {language === 'hi'
                ? 'अपने खाते में लॉगिन करने के लिए अपना विवरण दर्ज करें'
                : 'Enter your credentials to access your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mfaStep ? (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-2 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                {useRecovery
                  ? (language === 'hi' ? 'अपने सुरक्षित recovery codes में से कोई एक डालें' : 'Enter one of your saved recovery codes')
                  : (language === 'hi' ? 'Authenticator app का 6-अंकों वाला कोड डालें' : 'Enter the 6-digit code from your authenticator app')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">{useRecovery ? 'Recovery code' : (language === 'hi' ? '2FA कोड' : '2FA code')}</Label>
                {useRecovery ? (
                  <Input
                    id="otp"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="xxxxx-xxxxx"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 12))}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                ) : (
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-lg tracking-[0.5em] font-mono"
                  />
                )}
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isLoading || mfaEntryInvalid}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {language === 'hi' ? 'जाँच हो रही है...' : 'Verifying...'}
                  </span>
                ) : (language === 'hi' ? 'सत्यापित करें' : 'Verify')}
              </Button>
              <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={exitMfa} disabled={isLoading}>
                  {language === 'hi' ? '← वापस' : '← Back'}
                </Button>
                <button
                  type="button"
                  onClick={() => { setUseRecovery(v => !v); setMfaCode(''); setError(''); }}
                  className="text-xs text-primary hover:underline"
                >
                  {useRecovery
                    ? (language === 'hi' ? 'Authenticator कोड डालें' : 'Use authenticator code')
                    : (language === 'hi' ? 'Recovery code इस्तेमाल करें' : 'Use a recovery code')}
                </button>
              </div>
            </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {logoutReason && !error && (
                <Alert role="status">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertDescription>
                    {logoutReason === 'idle'
                      ? L('काफ़ी देर से कोई काम नहीं हुआ था, इसलिए सुरक्षा के लिए आपको लॉगआउट कर दिया गया। दोबारा लॉगिन करें — आपका सेव किया हुआ डेटा सुरक्षित है।',
                        'You were signed out for safety after a long period of no activity. Please log in again — your saved data is safe.')
                      : L('यह लॉगिन अब चालू नहीं है, इसलिए आपको लॉगआउट कर दिया गया। अपनी समिति के Admin से संपर्क करें।',
                        'This login is no longer active, so you were signed out. Please contact your society Admin.')}
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('password')}</Label>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setFpSubmitted(false); setFpEmail(''); }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {language === 'hi' ? 'पासवर्ड भूल गए?' : 'Forgot Password?'}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {language === 'hi' ? 'लॉगिन हो रहा है...' : 'Logging in...'}
                  </span>
                ) : t('login')}
              </Button>
            </form>
            )}

            {/* Forgot User ID link */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowForgotId(true)}
                className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 mx-auto"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {language === 'hi' ? 'User ID / ईमेल भूल गए?' : 'Forgot User ID / Email?'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Register link */}
        <p className="mt-4 text-sm text-center">
          {language === 'hi' ? 'नई समिति?' : 'New society?'}{' '}
          <a href="/register" className="text-primary font-medium hover:underline">
            {language === 'hi' ? 'यहाँ पंजीकरण करें' : 'Register here'}
          </a>
        </p>

        {/* Someone who landed here without an account: show them the product and a way to ask. */}
        <p className="mt-3 text-sm text-center text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a
            href="/#demo"
            onClick={() => trackEvent('cta_click', { location: 'login', target: 'demo' })}
            className="inline-flex items-center gap-1 hover:text-primary hover:underline"
          >
            <PlayCircle className="h-4 w-4" />
            {language === 'hi' ? '1 मिनट का डेमो देखें' : 'Watch the 1-minute demo'}
          </a>
          {whatsappHelpHref && (
            <a
              href={whatsappHelpHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('whatsapp_click', { location: 'login', page: '/login' })}
              className="inline-flex items-center gap-1 hover:text-primary hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              {language === 'hi' ? 'WhatsApp पर सहायता लें' : 'Get help on WhatsApp'}
            </a>
          )}
        </p>

        {/* Footer */}
        <p className="mt-4 text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} सहकार लेखा (SahakarLekha) | {language === 'hi' ? 'सभी अधिकार सुरक्षित' : 'All rights reserved'}
        </p>
      </div>

      {/* ── Forgot Password Modal ── */}
      <Dialog open={showForgotPassword} onOpenChange={(open) => { setShowForgotPassword(open); setFpSubmitted(false); setFpEmailSent(false); setFpFailed(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {language === 'hi' ? 'पासवर्ड भूल गए' : 'Forgot Password'}
            </DialogTitle>
            <DialogDescription>
              {language === 'hi'
                ? 'अपना पंजीकृत ईमेल दर्ज करें'
                : 'Enter your registered email address'}
            </DialogDescription>
          </DialogHeader>

          {!fpSubmitted ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{language === 'hi' ? 'ईमेल पता' : 'Email Address'}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    value={fpEmail}
                    onChange={e => setFpEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={fpLoading}>
                {fpLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {language === 'hi' ? 'भेज रहे हैं...' : 'Sending...'}
                  </span>
                ) : (language === 'hi' ? 'अनुरोध भेजें' : 'Submit Request')}
              </Button>
            </form>
          ) : (
            <div className="pt-2 space-y-4">
              {fpFailed ? (
                // The request did not go through (no network, too many requests, server error). Nothing was
                // recorded anywhere, so this must not say "request received" (audit 2026-11-16, J-2b).
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    {L('लिंक अभी नहीं भेजा जा सका', 'The link could not be sent right now')}
                  </div>
                  <p>
                    {L('इंटरनेट कनेक्शन देखें और एक-दो मिनट बाद दोबारा कोशिश करें (लगातार कई बार माँगने पर भी लिंक कुछ देर रुक जाता है)।',
                      'Check your connection and try again in a minute or two (asking several times in a row also pauses the link for a while).')}
                  </p>
                  <p className="font-medium">
                    {L('जल्दी हो तो अपनी समिति के Admin से कहें — वे User Management में आपका पासवर्ड बदल सकते हैं।',
                      'If it is urgent, ask your society Admin — they can change your password in User Management.')}
                  </p>
                </div>
              ) : fpEmailSent ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    {L('ईमेल देखें', 'Check your email')}
                  </div>
                  <p>
                    {L(`अगर "${fpEmail}" सहकार लेखा में पंजीकृत है, तो उस पर पासवर्ड बदलने का लिंक भेज दिया गया है।`,
                      `If "${fpEmail}" is registered with SahakarLekha, a link to change the password has been sent to it.`)}
                  </p>
                  <p className="font-medium">
                    {L('Inbox और spam folder दोनों देखें। कुछ मिनट में ईमेल न आए तो ईमेल की spelling जाँचें।',
                      'Look in both the inbox and the spam folder. If nothing arrives in a few minutes, check the spelling of the email.')}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    {L('Admin से पासवर्ड बदलवाएँ', 'Ask your Admin to change the password')}
                  </div>
                  <p className="font-medium">
                    {L('इस ईमेल पर लिंक नहीं भेजा जा सका। अपनी समिति के Admin से कहें — वे User Management में आपका पासवर्ड बदल सकते हैं।',
                      'A link could not be emailed to this address. Ask your society Admin — they can change your password in User Management.')}
                  </p>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setShowForgotPassword(false)}>
                {language === 'hi' ? 'बंद करें' : 'Close'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Forgot User ID Modal ── */}
      <Dialog open={showForgotId} onOpenChange={setShowForgotId}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              {language === 'hi' ? 'User ID / ईमेल भूल गए' : 'Forgot User ID / Email'}
            </DialogTitle>
            <DialogDescription>
              {L('आपका User ID वही ईमेल है जिससे लॉगिन बना था। उसे ऐसे पता करें:',
                'Your User ID is the email your login was created with. Here is how to find it:')}
            </DialogDescription>
          </DialogHeader>

          <div className="pt-2 space-y-4">
            <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
              <li>
                {L('अपनी समिति के Admin से पूछें — सहकार लेखा में User Management खोलने पर हर यूज़र का लॉगिन ईमेल दिखता है।',
                  'Ask your society Admin — User Management in SahakarLekha lists every user\'s login email.')}
              </li>
              <li>
                {L('आपने ही समिति पंजीकृत की थी? तो यह वही ईमेल है जो पंजीकरण के समय लिखा था। अपने ईमेल inbox में "SahakarLekha" खोजकर देखें।',
                  'Did you register the society yourself? Then it is the email you entered at registration. Search your inbox for "SahakarLekha".')}
              </li>
              <li>
                {L('ईमेल याद है पर पासवर्ड नहीं? यह खिड़की बंद करके "पासवर्ड भूल गए?" दबाएँ।',
                  'Remember the email but not the password? Close this and use "Forgot Password?".')}
              </li>
            </ol>
            {whatsappHelpHref && (
              <a
                href={whatsappHelpHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('whatsapp_click', { location: 'login_forgot_id', page: '/login' })}
                className="flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted"
              >
                <MessageCircle className="h-4 w-4" />
                {L('फिर भी न मिले तो WhatsApp पर सहायता लें', 'Still stuck? Get help on WhatsApp')}
              </a>
            )}
            <Button variant="outline" className="w-full" onClick={() => setShowForgotId(false)}>
              {L('बंद करें', 'Close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
