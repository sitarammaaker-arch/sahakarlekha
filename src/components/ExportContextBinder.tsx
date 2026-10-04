import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useSubscription } from '@/hooks/useSubscription';
import { setExportContext } from '@/lib/exportUtils';
import { setReportBranding, brandFooterFor } from '@/lib/reportBranding';
import { setReportAuditSink, buildReportAuditInput } from '@/lib/reportAudit';
import { logAudit } from '@/lib/auditLog';
import { setAppVocabulary } from '@/lib/pdfDevanagari';
import { translations } from '@/contexts/LanguageContext';

/**
 * Binds the current society + user + plan to the shared report helpers (renders nothing):
 *  - EVERY Excel / CSV carries the standard file name and the README provenance sheet (R13/R14);
 *  - the PDF footer drops the "Generated free with SahakarLekha" marketing line for PAYING plans (R9);
 *  - every PDF that gets a Report ID is recorded in the audit trail (who, when, which report) — non-blocking.
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

  // The app's own Hindi vocabulary, so a Hindi PDF says things the way the screens do (R12).
  useEffect(() => { setAppVocabulary(translations); }, []);

  useEffect(() => {
    setReportBranding({ showBrandFooter: brandFooterFor(plan) });
    return () => setReportBranding({ showBrandFooter: true });
  }, [plan]);

  useEffect(() => {
    if (!user?.societyId) { setReportAuditSink(null); return; }
    const ctx = { societyId: user.societyId, actor: { name: user.name, email: user.email, role: user.role } };
    setReportAuditSink(event => logAudit(buildReportAuditInput(event), ctx));
    return () => setReportAuditSink(null);
  }, [user?.societyId, user?.name, user?.email, user?.role]);

  return null;
}
