import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { SIGNATORY_ROLES, type SignatoryRole } from '@/lib/reportSignatures';

const LABELS: Record<SignatoryRole, { hi: string; en: string }> = {
  accountant: { hi: 'लेखाकार', en: 'Accountant' },
  secretary: { hi: 'सचिव', en: 'Secretary' },
  president: { hi: 'अध्यक्ष', en: 'Chairman' },
};

const GRID_COLS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'];

/** The on-screen / browser-print signature row of a report. Follows the society's choice (lib/reportSignatures). */
export default function ReportSignatureRow() {
  const { society } = useData();
  const { language } = useLanguage();
  const chosen = society.signatories?.reportRoles;
  const roles = SIGNATORY_ROLES.filter((r) => !chosen || chosen.includes(r));
  if (roles.length === 0) return null;
  return (
    <div className={`mt-8 pt-8 border-t grid ${GRID_COLS[roles.length]} gap-4 text-center text-sm`}>
      {roles.map((role) => (
        <div key={role}>
          <div className="h-16 border-b border-dashed border-muted-foreground/30 mb-2" />
          <p className="font-medium">{language === 'hi' ? LABELS[role].hi : LABELS[role].en}</p>
        </div>
      ))}
    </div>
  );
}
