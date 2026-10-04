import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useSubscription } from '@/hooks/useSubscription';
import { setReportBranding, brandFooterFor } from '@/lib/reportBranding';
import { setReportAuditSink, buildReportAuditInput } from '@/lib/reportAudit';
import { logAudit } from '@/lib/auditLog';
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

  // exportUtils pulls in xlsx and pdfDevanagari pulls in jspdf. This component is mounted on EVERY page
  // (login, landing, blog), so both are imported lazily and only for a signed-in user — a static import
  // put the xlsx/pdf chunks on the public pages (e2e/initial-bundle.spec.ts). Same-module dynamic imports
  // resolve in call order, so a cleanup's reset always lands before the next effect's set.
  const signedIn = !!user?.societyId;
  useEffect(() => {
    if (!signedIn || !society?.name) return;
    const ctx = { society: { name: society.name, registrationNo: society.registrationNo, financialYear: society.financialYear }, userName: user?.name };
    let live = true;
    void import('@/lib/exportUtils').then((m) => { if (live) m.setExportContext(ctx); });
    return () => { live = false; void import('@/lib/exportUtils').then((m) => m.setExportContext(null)); };
  }, [signedIn, society?.name, society?.registrationNo, society?.financialYear, user?.name]);

  // The app's own Hindi vocabulary, so a Hindi PDF says things the way the screens do (R12).
  useEffect(() => {
    if (!signedIn) return;
    void import('@/lib/pdfDevanagari').then((m) => m.setAppVocabulary(translations));
  }, [signedIn]);

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
