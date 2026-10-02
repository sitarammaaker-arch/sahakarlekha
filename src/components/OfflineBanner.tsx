/**
 * OfflineBanner — F1 offline policy (अ): online-only entry.
 * Shown (and not dismissable) while the browser is offline or a core part of the books failed to
 * load; non-core load failures get a slim warning that never blocks entry. Reads the same store the
 * mutation guards read (lib/connectivity/writeBlock), so banner and guard can never disagree.
 */
import React, { useSyncExternalStore } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { getWriteBlock, subscribeWriteBlock, PART_LABEL_HI } from '@/lib/connectivity/writeBlock';
import { useLanguage } from '@/contexts/LanguageContext';

const OfflineBanner: React.FC = () => {
  const d = useSyncExternalStore(subscribeWriteBlock, getWriteBlock, getWriteBlock);
  const { language } = useLanguage();
  const hi = language === 'hi';
  const names = (parts: string[]) => parts.map(p => (hi ? PART_LABEL_HI[p] ?? p : p)).join(', ');

  if (d.blocked) {
    const offline = d.reason === 'offline';
    return (
      <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-start gap-2">
          {offline ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
          <div className="min-w-[14rem] flex-1 text-destructive">
            <p className="font-semibold">
              {offline
                ? (hi ? 'इंटरनेट नहीं है — entry बंद है' : 'You are offline — entry is paused')
                : (hi ? 'Data पूरा load नहीं हुआ — entry बंद है' : 'Data did not fully load — entry is paused')}
            </p>
            <p className="mt-0.5">
              {hi
                ? 'स्क्रीन के आँकड़े अधूरे हो सकते हैं, इन पर भरोसा न करें। आपका data cloud में सुरक्षित है।'
                : 'Figures on screen may be incomplete — do not rely on them. Your data is safe in the cloud.'}
              {offline && (hi ? ' इंटरनेट आते ही entry अपने-आप चालू हो जाएगी।' : ' Entry resumes automatically when you are back online.')}
            </p>
            {d.failedCore.length > 0 && (
              <p className="mt-0.5 font-medium">{hi ? 'load नहीं हुआ' : 'Not loaded'}: {names([...d.failedCore, ...d.failedOther])}</p>
            )}
          </div>
          {(!offline || d.failedCore.length > 0) && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-auto inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1.5 font-medium text-destructive hover:bg-destructive/10 sm:w-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {hi ? 'फिर से load करें' : 'Reload'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (d.failedOther.length > 0) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2 text-sm dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-amber-800 dark:text-amber-300">
          {hi ? 'कुछ हिस्से load नहीं हुए' : 'Some sections did not load'}: {names(d.failedOther)}
          {hi ? ' — इनके आँकड़े अधूरे हो सकते हैं।' : ' — their figures may be incomplete.'}
        </span>
        <button type="button" onClick={() => window.location.reload()} className="ml-auto font-medium text-amber-700 underline dark:text-amber-300">
          {hi ? 'फिर से load करें' : 'Reload'}
        </button>
      </div>
    );
  }

  return null;
};

export default OfflineBanner;
