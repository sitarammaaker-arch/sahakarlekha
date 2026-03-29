import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Building2, Lock, Mail, Eye, EyeOff, Languages, AlertCircle, KeyRound, HelpCircle, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, sendPasswordReset } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password modal
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpSubmitted, setFpSubmitted] = useState(false);
  const [fpEmailSent, setFpEmailSent] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);

  // Forgot ID modal
  const [showForgotId, setShowForgotId] = useState(false);
  const [fiName, setFiName] = useState('');
  const [fiPhone, setFiPhone] = useState('');
  const [fiSubmitted, setFiSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError(language === 'hi' ? 'गलत ईमेल या पासवर्ड' : 'Invalid email or password');
      }
    } catch {
      setError(language === 'hi' ? 'कोई त्रुटि हुई' : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpEmail.trim()) return;
    setFpLoading(true);
    const result = await sendPasswordReset(fpEmail.trim());
    setFpEmailSent(result.isEmailSent);
    setFpSubmitted(true);
    setFpLoading(false);
  };

  const handleForgotIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fiName.trim()) return;
    setFiSubmitted(true);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent/20" />
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-primary-foreground">
          <div className="h-24 w-24 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-8">
            <Building2 className="h-12 w-12" />
          </div>
          <h1 className="text-4xl font-bold text-center mb-4">समिति लेखा प्रणाली</h1>
          <p className="text-xl text-center text-primary-foreground/80 mb-2">
            Cooperative Society Accounting System
          </p>
          <p className="text-center text-primary-foreground/60 max-w-md">
            भारतीय सहकारी विपणन समितियों के लिए विशेष रूप से डिज़ाइन किया गया
            क्लाउड-आधारित लेखा सॉफ्टवेयर
          </p>
          <div className="mt-12 grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold">500+</p>
              <p className="text-sm text-primary-foreground/70">समितियां</p>
            </div>
            <div>
              <p className="text-3xl font-bold">10,000+</p>
              <p className="text-sm text-primary-foreground/70">सदस्य</p>
            </div>
            <div>
              <p className="text-3xl font-bold">99.9%</p>
              <p className="text-sm text-primary-foreground/70">अपटाइम</p>
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
          <div className="h-16 w-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">समिति लेखा प्रणाली</h1>
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
            <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Forgot User ID link */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setShowForgotId(true); setFiSubmitted(false); setFiName(''); setFiPhone(''); }}
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

        {/* Footer */}
        <p className="mt-4 text-sm text-muted-foreground text-center">
          © 2024 समिति लेखा प्रणाली | {language === 'hi' ? 'सभी अधिकार सुरक्षित' : 'All rights reserved'}
        </p>
      </div>

      {/* ── Forgot Password Modal ── */}
      <Dialog open={showForgotPassword} onOpenChange={(open) => { setShowForgotPassword(open); setFpSubmitted(false); setFpEmailSent(false); }}>
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
              {fpEmailSent ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    {language === 'hi' ? 'ईमेल भेज दिया गया!' : 'Email Sent!'}
                  </div>
                  <p>
                    {language === 'hi'
                      ? `"${fpEmail}" पर पासवर्ड reset लिंक भेजा गया है।`
                      : `A password reset link has been sent to "${fpEmail}".`}
                  </p>
                  <p className="font-medium">
                    {language === 'hi'
                      ? 'अपना ईमेल inbox (और spam folder) चेक करें।'
                      : 'Please check your email inbox (and spam folder).'}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    {language === 'hi' ? 'अनुरोध प्राप्त हुआ' : 'Request Received'}
                  </div>
                  <p>
                    {language === 'hi'
                      ? `"${fpEmail}" के लिए पासवर्ड reset अनुरोध दर्ज किया गया।`
                      : `Password reset request noted for "${fpEmail}".`}
                  </p>
                  <p className="font-medium">
                    {language === 'hi'
                      ? 'कृपया अपनी समिति के Admin से संपर्क करें। Admin, User Management में जाकर आपका पासवर्ड reset कर सकते हैं।'
                      : 'Please contact your society Admin. The Admin can reset your password from the User Management page.'}
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
      <Dialog open={showForgotId} onOpenChange={(open) => { setShowForgotId(open); setFiSubmitted(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              {language === 'hi' ? 'User ID / ईमेल भूल गए' : 'Forgot User ID / Email'}
            </DialogTitle>
            <DialogDescription>
              {language === 'hi'
                ? 'पहचान के लिए अपना नाम और फ़ोन नंबर दर्ज करें'
                : 'Enter your name and phone to identify your account'}
            </DialogDescription>
          </DialogHeader>

          {!fiSubmitted ? (
            <form onSubmit={handleForgotIdSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{language === 'hi' ? 'पूरा नाम' : 'Full Name'}</Label>
                <Input
                  placeholder={language === 'hi' ? 'जैसे: राम कुमार शर्मा' : 'e.g. Ram Kumar Sharma'}
                  value={fiName}
                  onChange={e => setFiName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'hi' ? 'मोबाइल नंबर (वैकल्पिक)' : 'Mobile Number (optional)'}</Label>
                <Input
                  placeholder="9876543210"
                  value={fiPhone}
                  onChange={e => setFiPhone(e.target.value)}
                  type="tel"
                />
              </div>
              <Button type="submit" className="w-full">
                {language === 'hi' ? 'अनुरोध भेजें' : 'Submit Request'}
              </Button>
            </form>
          ) : (
            <div className="pt-2 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  {language === 'hi' ? 'अनुरोध प्राप्त हुआ' : 'Request Received'}
                </div>
                <p>
                  {language === 'hi'
                    ? `"${fiName}" के नाम से अनुरोध दर्ज किया गया।`
                    : `Request noted for "${fiName}".`}
                </p>
                <p className="font-medium">
                  {language === 'hi'
                    ? 'कृपया अपनी समिति के Admin से संपर्क करें। Admin आपको आपका लॉगिन ईमेल / User ID बता सकते हैं।'
                    : 'Please contact your society Admin. The Admin can find and share your login email / User ID.'}
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setShowForgotId(false)}>
                {language === 'hi' ? 'बंद करें' : 'Close'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
