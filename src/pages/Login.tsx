import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Lock, Mail, Eye, EyeOff, Languages, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    } catch (err) {
      setError(language === 'hi' ? 'कोई त्रुटि हुई' : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const demoCredentials = [
    { role: 'Admin', email: 'admin@society.com', password: 'admin123' },
    { role: 'Accountant', email: 'accountant@society.com', password: 'acc123' },
    { role: 'Viewer', email: 'viewer@society.com', password: 'view123' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent/20" />
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-primary-foreground">
          <div className="h-24 w-24 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-8">
            <Building2 className="h-12 w-12" />
          </div>
          
          <h1 className="text-4xl font-bold text-center mb-4">
            समिति लेखा प्रणाली
          </h1>
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

      {/* Right Panel - Login Form */}
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
                <Label htmlFor="password">{t('password')}</Label>
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
                ) : (
                  t('login')
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground text-center mb-3">
                {language === 'hi' ? 'डेमो क्रेडेंशियल्स' : 'Demo Credentials'}
              </p>
              <div className="space-y-2">
                {demoCredentials.map((cred) => (
                  <button
                    key={cred.role}
                    type="button"
                    onClick={() => {
                      setEmail(cred.email);
                      setPassword(cred.password);
                    }}
                    className="w-full text-left p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                  >
                    <span className="font-medium">{cred.role}:</span>{' '}
                    <span className="text-muted-foreground">{cred.email}</span>
                  </button>
                ))}
              </div>
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
    </div>
  );
};

export default Login;
