/**
 * OnboardingChecklist — a first-run "get started" card for a brand-new society.
 *
 * The app had no in-app onboarding: a fresh user landed on an empty dashboard with no
 * path (audit HP-1). This card lists the first steps in order, each a one-click
 * deep-link. It is intentionally additive & schema-free:
 *   - shows ONLY when the society is empty (no members AND no live vouchers),
 *   - auto-hides the moment they add their first member or voucher (they've started),
 *   - can be dismissed ("बाद में"), remembered per browser via localStorage.
 * So it never gets in the way of an established society.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Rocket, ChevronRight, X, CheckCircle2, Circle } from 'lucide-react';

const DISMISS_KEY = 'sl.onboarding.dismissed';

const OnboardingChecklist: React.FC = () => {
  const navigate = useNavigate();
  const { members, vouchers } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [dismissed, setDismissed] = React.useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const hasMembers = members.length > 0;
  const hasVouchers = vouchers.some(v => !v.isDeleted);

  // Established society (or dismissed) → nothing to show.
  if (dismissed || hasMembers || hasVouchers) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const steps: { label: string; route: string; done: boolean }[] = [
    { label: hi ? 'समिति सेटअप पूरा करें' : 'Complete society setup', route: '/society-setup', done: false },
    { label: hi ? 'ओपनिंग बैलेंस डालें' : 'Enter opening balances', route: '/opening-balances', done: false },
    { label: hi ? 'पहला सदस्य जोड़ें' : 'Add your first member', route: '/members', done: hasMembers },
    { label: hi ? 'पहला वाउचर बनाएं (रसीद/भुगतान)' : 'Make your first voucher (receipt/payment)', route: '/vouchers', done: hasVouchers },
    { label: hi ? 'उपयोगकर्ता जोड़ें (वैकल्पिक)' : 'Invite users (optional)', route: '/user-management', done: false },
  ];

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary shrink-0" />
            {hi ? 'शुरू कैसे करें — पहले ये कदम' : 'Get started — first steps'}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 -mt-1 -mr-1 shrink-0"
            onClick={dismiss}
            title={hi ? 'बाद में' : 'Later'}
            aria-label={hi ? 'बंद करें' : 'Dismiss'}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {hi ? 'नई समिति के लिए क्रम से — हर कदम एक क्लिक पर खुलेगा।' : 'For a new society, in order — each step opens in one click.'}
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.route}>
              <button
                type="button"
                onClick={() => navigate(s.route)}
                className="w-full flex items-center gap-3 rounded-lg border bg-background/60 px-3 py-2.5 text-sm hover:bg-background transition-colors text-left"
              >
                {s.done
                  ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="w-5 text-xs font-semibold text-muted-foreground shrink-0">{i + 1}.</span>
                <span className={`flex-1 ${s.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{s.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          {hi ? 'मदद चाहिए? ' : 'Need help? '}
          <button type="button" onClick={() => navigate('/guide')} className="text-primary hover:underline">
            {hi ? 'पूरी गाइड देखें' : 'Open the full guide'}
          </button>
        </p>
      </CardContent>
    </Card>
  );
};

export default OnboardingChecklist;
