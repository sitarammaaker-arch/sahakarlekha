import { Link } from 'react-router-dom';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { todayStr } from '@/lib/dateUtils';
import { licenceAlerts, LICENCE_STATUS_TEXT } from '@/lib/marketing/dealerCompliance';
import { AlertTriangle } from 'lucide-react';

/** E1 — banner for licences that are expiring / in grace / lapsed. Used here and on the Inventory page. */
export function LicenceExpiryBanner({ hi }: { hi: boolean }) {
  const { dealerLicences } = useMarketingData();
  const alerts = licenceAlerts(dealerLicences, todayStr());
  if (!alerts.length) return null;
  const worst = alerts[0].status;
  return (
    <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${worst === 'lapsed' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        {alerts.slice(0, 3).map(a => (
          <div key={a.licence.id}>
            <b>{a.licence.kind === 'authorisation' ? (hi ? 'खाद प्राधिकार पत्र' : 'Fertiliser authorisation') : `Form O · ${a.licence.sourceName || ''}`}</b>
            {a.licence.licenceNo ? ` ${a.licence.licenceNo}` : ''} — {hi ? LICENCE_STATUS_TEXT[a.status].hi : LICENCE_STATUS_TEXT[a.status].en} ({a.licence.validUpto})
          </div>
        ))}
        <Link to="/dealer-compliance" className="underline text-xs">{hi ? 'लाइसेंस रजिस्टर खोलें' : 'Open the licence register'}</Link>
      </div>
    </div>
  );
}
