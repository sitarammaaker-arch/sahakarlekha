import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { setExportContext } from '@/lib/exportUtils';

/**
 * Binds the current society + user to the shared export helpers so EVERY Excel / CSV carries the
 * standard file name and the README provenance sheet (docs/research/REPORT-UNIFORMITY-STANDARD-DRAFT.md
 * R13/R14) without editing each page. Renders nothing.
 */
export default function ExportContextBinder() {
  const { user } = useAuth();
  const { society } = useData();
  useEffect(() => {
    setExportContext(society?.name
      ? { society: { name: society.name, registrationNo: society.registrationNo, financialYear: society.financialYear }, userName: user?.name }
      : null);
    return () => setExportContext(null);
  }, [society?.name, society?.registrationNo, society?.financialYear, user?.name]);
  return null;
}
