/**
 * SubscriptionBanner — slim in-app notice about the trial / plan period.
 * Reads useSubscription(), whose status is derived from period_end (migration 159's rule), so the
 * notice is right even before the hourly server job has rewritten the stored status.
 *   trialing             → days of trial left
 *   active, near its end → reminder (a paid plan: last RENEWAL_NOTICE_DAYS days; a grandfathered
 *                          'legacy' society: last LEGACY_NOTICE_DAYS days of its free period)
 *   grace                → the period has ended; entries pause in N days
 *   expired              → new entries are paused; data, reports and export keep working
 * Shows NOTHING for a healthy plan, or a legacy society with no end date. Presentation only — the
 * pause itself is DataContext's guardSubscriptionExpired.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';
import { LEGACY_NOTICE_DAYS, RENEWAL_NOTICE_DAYS, daysUntil, graceDaysLeft } from '@/lib/plans';

/** Where a plan is bought (the plan card with the Razorpay buttons). */
const PLAN_PAGE = '/user-management';

const SubscriptionBanner: React.FC = () => {
  const { loading, plan, status, periodEnd } = useSubscription();
  const { language } = useLanguage();
  const hi = language === 'hi';

  if (loading) return null;
  if (plan === 'legacy' && !periodEnd) return null; // grandfathered with no end date → no banner

  // What ended, in the user's words. Hindi carries the gender in the whole phrase ("अवधि" is feminine).
  const whatEn = plan === 'trial' ? 'free trial' : plan === 'legacy' ? 'free period' : 'plan';
  const endedHi = plan === 'legacy' ? 'आपकी मुफ़्त अवधि समाप्त हो गई है' : `आपका ${plan === 'trial' ? 'free trial' : 'plan'} समाप्त हो गया है`;

  if (status === 'expired') {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="font-medium text-destructive">
          {hi
            ? `${endedHi} — नई एंट्री रुकी है। आपका डेटा सुरक्षित है; रिपोर्ट और export चालू हैं।`
            : `Your ${whatEn} has ended — new entries are paused. Your data is safe; reports and export still work.`}
        </span>
        <Link to={PLAN_PAGE} className="ml-auto font-medium text-destructive underline">
          {hi ? 'Plan लें' : 'Get a plan'}
        </Link>
      </div>
    );
  }

  if (status === 'grace') {
    const left = graceDaysLeft(periodEnd) ?? 0;
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="font-medium text-destructive">
          {hi
            ? `${endedHi} — ${left} दिन बाद नई एंट्री रुक जाएगी। जारी रखने के लिए plan लें।`
            : `Your ${whatEn} has ended — new entries pause in ${left} day(s). Get a plan to continue.`}
        </span>
        <Link to={PLAN_PAGE} className="ml-auto font-medium text-destructive underline">
          {hi ? 'Plan लें' : 'Get a plan'}
        </Link>
      </div>
    );
  }

  const left = daysUntil(periodEnd);
  if (status === 'trialing' && left != null) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm dark:bg-amber-950/30">
        <Clock className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="font-medium text-amber-800 dark:text-amber-300">
          {hi
            ? `Free trial: ${Math.max(left, 0)} दिन बाकी — जारी रखने के लिए plan चुनें।`
            : `Free trial: ${Math.max(left, 0)} day(s) left — choose a plan to continue.`}
        </span>
        <Link to={PLAN_PAGE} className="ml-auto font-medium text-amber-700 underline dark:text-amber-300">
          {hi ? 'Plan देखें' : 'View plans'}
        </Link>
      </div>
    );
  }

  const noticeDays = plan === 'legacy' ? LEGACY_NOTICE_DAYS : RENEWAL_NOTICE_DAYS;
  if (status === 'active' && left != null && left <= noticeDays) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm dark:bg-amber-950/30">
        <Clock className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="font-medium text-amber-800 dark:text-amber-300">
          {plan === 'legacy'
            ? (hi
              ? `आपकी मुफ़्त अवधि ${Math.max(left, 0)} दिन में पूरी हो रही है — जारी रखने के लिए plan चुनें।`
              : `Your free period ends in ${Math.max(left, 0)} day(s) — choose a plan to continue.`)
            : (hi
              ? `आपका plan ${Math.max(left, 0)} दिन में पूरा हो रहा है — समय रहते renew करें।`
              : `Your plan ends in ${Math.max(left, 0)} day(s) — renew in time.`)}
        </span>
        <Link to={PLAN_PAGE} className="ml-auto font-medium text-amber-700 underline dark:text-amber-300">
          {plan === 'legacy' ? (hi ? 'Plan देखें' : 'View plans') : (hi ? 'Renew करें' : 'Renew')}
        </Link>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;
