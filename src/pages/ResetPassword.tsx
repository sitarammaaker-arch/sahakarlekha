import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Languages } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const hi = language === 'hi';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [syncWarning, setSyncWarning] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  // Supabase sends the user back to this page with a session in the URL hash.
  // getSession() picks it up automatically.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        // Check onAuthStateChange for PASSWORD_RECOVERY event
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' && session) {
            setSessionReady(true);
          }
        });
        // Give it a moment, then show error if still no session
        setTimeout(() => {
          if (!sessionReady) setSessionError(true);
        }, 3000);
        return () => subscription.unsubscribe();
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(hi ? 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए' : 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError(hi ? 'दोनों पासवर्ड मेल नहीं खाते' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Update the Supabase Auth (JWT) password — the primary login path.
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(hi ? 'पासवर्ड अपडेट नहीं हो सका। कृपया पुनः प्रयास करें।' : 'Could not update password. Please try again.');
        return;
      }

      // 2. CRITICAL: also sync the app's RPC-login store (society_users.password).
      //    Without this, the app_login() fallback still checks the OLD password,
      //    so a user whose JWT path is unavailable would be locked out with their
      //    new password. The email is read server-side from the recovery-session
      //    JWT, so a user can only ever change THEIR OWN password.
      //    Best-effort: the Auth password is already changed (primary path works),
      //    so on sync failure we surface a gentle note but still let them proceed.
      const { error: syncError } = await supabase.rpc('app_set_my_password', { p_password: password });
      if (syncError) {
        console.warn('[Reset] society_users password sync failed:', syncError.message);
        setSyncWarning(true);
      }

      setSuccess(true);
      // Auto-redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      setError(hi ? 'कोई त्रुटि हुई' : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-background">
      {/* Language toggle */}
      <div className="absolute top-6 right-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(hi ? 'en' : 'hi')}
          className="gap-2"
        >
          <Languages className="h-4 w-4" />
          {hi ? 'English' : 'हिंदी'}
        </Button>
      </div>

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mx-auto mb-4 shadow-md">
          <span className="text-4xl font-bold leading-none">स</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">समिति लेखा प्रणाली</h1>
      </div>

      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {hi ? 'नया पासवर्ड सेट करें' : 'Set New Password'}
          </CardTitle>
          <CardDescription>
            {hi ? 'अपना नया पासवर्ड दर्ज करें' : 'Enter your new password below'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  {hi ? 'पासवर्ड सफलतापूर्वक बदल गया!' : 'Password changed successfully!'}
                </div>
                <p>{hi ? 'आपको कुछ ही क्षणों में लॉगिन पेज पर भेजा जाएगा।' : 'Redirecting you to login in a moment…'}</p>
              </div>
              {syncWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  {hi
                    ? 'नोट: नया पासवर्ड लागू हो गया है। अगर लॉगिन में कोई दिक्कत आए तो एक बार दोबारा कोशिश करें या एडमिन से संपर्क करें।'
                    : 'Note: your new password is active. If login has any trouble, try once more or contact your admin.'}
                </div>
              )}
              <Button className="w-full" onClick={() => navigate('/login')}>
                {hi ? 'लॉगिन पेज पर जाएं' : 'Go to Login'}
              </Button>
            </div>
          ) : sessionError && !sessionReady ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  {hi ? 'लिंक अमान्य या समय सीमा समाप्त' : 'Link invalid or expired'}
                </div>
                <p>
                  {hi
                    ? 'यह पासवर्ड reset लिंक पुराना हो गया है। कृपया लॉगिन पेज से दोबारा अनुरोध करें।'
                    : 'This password reset link has expired. Please request a new one from the login page.'}
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                {hi ? 'वापस लॉगिन पेज पर' : 'Back to Login'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{hi ? 'नया पासवर्ड' : 'New Password'}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">{hi ? 'पासवर्ड की पुष्टि करें' : 'Confirm Password'}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading || !sessionReady}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {hi ? 'अपडेट हो रहा है...' : 'Updating…'}
                  </span>
                ) : (hi ? 'पासवर्ड बदलें' : 'Change Password')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
