import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useSubscription } from '@/hooks/useSubscription';
import { setExportContext } from '@/lib/exportUtils';
import { setReportBranding, brandFooterFor } from '@/lib/reportBranding';

/**
 * Binds the current society + user + plan to the shared report helpers (renders nothing):
 *  - EVERY Excel / CSV carries the standard file name and the README provenance sheet (R13/R14);
 *  - the PDF footer drops the "Generated free with SahakarLekha" marketing line for PAYING plans (R9).
 * See docs/research/REPORT-UNIFORMITY-STANDARD.md.
 */
export default function ExportContextBinder() {
  const { user } = useAuth();
  const { society } = useData();
  const { plan } = useSubscription();

  useEffect(() => {
    setExportContext(society?.name
      ? { society: { name: society.name, registrationNo: society.registrationNo, financialYear: society.financialYear }, userName: user?.name }
      : null);
    return () => setExportContext(null);
  }, [society?.name, society?.registrationNo, society?.financialYear, user?.name]);

  useEffect(() => {
    setReportBranding({ showBrandFooter: brandFooterFor(plan) });
    return () => setReportBranding({ showBrandFooter: true });
  }, [plan]);

  return null;
}
