/**
 * SubscriptionBanner — slim in-app notice for trial days-left / expired-renew.
 * Reads useSubscription(); shows NOTHING for legacy (grandfathered) or a healthy
 * active paid plan, so the 19 existing societies never see it. Presentation only —
 * the write-block on expiry is enforced server-side in a later slice.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';

const daysLeft = (iso: string | null): number | null =>
  iso == null ? null : Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

const SubscriptionBanner: React.FC = () => {
  const { loading, plan, status, periodEnd } = useSubscription();
  const { language } = useLanguage();
  const hi = language === 'hi';

  if (loading || plan === 'legacy') return null; // grandfathered / pre-billing → no banner

  if (status === 'expired' || status === 'grace') {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="font-medium text-destructive">
          {hi
            ? 'आपका plan समाप्त हो गया है — नई एंट्री रुक सकती है। कृपया renew करें (आपका डेटा सुरक्षित है)।'
            : 'Your plan has expired — new entries may be blocked. Please renew (your data is safe).'}
        </span>
        <Link to="/pricing" className="ml-auto font-medium text-destructive underline">
          {hi ? 'Renew करें' : 'Renew'}
        </Link>
      </div>
    );
  }

  const left = daysLeft(periodEnd);
  if (status === 'trialing' && left != null) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm dark:bg-amber-950/30">
        <Clock className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="font-medium text-amber-800 dark:text-amber-300">
          {hi
            ? `Free trial: ${Math.max(left, 0)} दिन बाकी — जारी रखने के लिए plan चुनें।`
            : `Free trial: ${Math.max(left, 0)} day(s) left — choose a plan to continue.`}
        </span>
        <Link to="/pricing" className="ml-auto font-medium text-amber-700 underline dark:text-amber-300">
          {hi ? 'Plan देखें' : 'View plans'}
        </Link>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;
