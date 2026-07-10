/**
 * Per-page export button (T-18).
 *
 * Drop `<EntityExportButton entityKey="deposit_account" />` onto a register and it gains
 * a CSV / Excel export that is:
 *
 *   - gated by the registry (role, capability, custody policy). If the current user may
 *     not export this entity, the button DOES NOT RENDER. It is not disabled — it is
 *     absent, the same way capability-gated entities are absent from the Export Center.
 *   - audited before delivery. runEntityExport awaits the audit row; a failure means the
 *     user gets a message and no file.
 *   - refused when the table is too large to serialize inline, rather than handing over
 *     a partial file that looks complete.
 *
 * This component is why T-19..T-22 are cheap: migrating a page is one import and one
 * line, not fifteen lines of headers[] / rows[][] assembly. The ~46 registers the audit
 * found with no export at all get one for free.
 *
 * IT DOES NOT TAKE ROWS. The page already has rows in memory, but the page's copy is
 * filtered, sorted and paginated for display. Exporting it would export whatever the
 * user happened to be looking at. The runner re-reads from the database, so the file is
 * the register, not the screen.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Loader2 } from 'lucide-react';

import { getEntity } from '@/lib/export/registry';
import { authorizeExport, type TabularFormat } from '@/lib/export/generator';
import { runEntityExport } from '@/lib/export/run';

interface Props {
  /** A key from the Export Registry, e.g. 'deposit_account'. */
  entityKey: string;
  /** Formats to offer. Intersected with what the entity declares. */
  formats?: TabularFormat[];
  size?: 'sm' | 'default';
  variant?: 'outline' | 'default' | 'ghost';
}

const EntityExportButton: React.FC<Props> = ({
  entityKey,
  formats = ['csv', 'xlsx'],
  size = 'sm',
  variant = 'outline',
}) => {
  const { language } = useLanguage();
  const { society } = useData();
  const { user } = useAuth();
  const { capabilities } = useCapabilities();
  const { toast } = useToast();

  const hi = language === 'hi';
  const [busy, setBusy] = useState(false);

  const entity = getEntity(entityKey);
  const principal = useMemo(
    () => ({ role: (user?.role ?? 'viewer') as 'admin' | 'accountant' | 'viewer', capabilities: [...capabilities] }),
    [user?.role, capabilities],
  );

  const offered = useMemo(
    () => (entity ? formats.filter(f => entity.formats.includes(f) && authorizeExport(entity, principal, f).ok) : []),
    [entity, formats, principal],
  );

  // Absent, not disabled. A button the user can see but never press teaches them nothing.
  if (!entity || offered.length === 0 || !user?.societyId) return null;

  async function handle(format: TabularFormat) {
    setBusy(true);
    try {
      const outcome = await runEntityExport(
        entity!,
        user!.societyId,
        {
          entityKey,
          format,
          mode: 'standard',
          filenameBase: `${entityKey}-${society.financialYear}`,
        },
        {
          societyId: user!.societyId,
          actor: { name: user!.name, email: user!.email, role: user!.role },
          principal,
          language,
          meta: {
            societyName: society.name,
            registrationNo: society.registrationNo,
            financialYear: society.financialYear,
            generatedBy: user!.name,
            mode: 'standard',
          },
        },
      );

      // Each outcome gets its own sentence. None of them is "exported zero rows".
      switch (outcome.status) {
        case 'exported':
          toast({
            title: hi ? 'एक्सपोर्ट डाउनलोड हुआ' : 'Export downloaded',
            description: hi ? `${outcome.rowCount} पंक्तियाँ · इतिहास में दर्ज` : `${outcome.rowCount} rows · recorded in the export history`,
          });
          break;
        case 'too-large':
          toast({
            title: hi ? 'डेटा बहुत बड़ा है' : 'Too much data',
            description: hi
              ? `${outcome.fetched} पंक्तियाँ पढ़ी गईं, पर और भी हैं। अधूरी फ़ाइल देने के बजाय रोका गया — एक्सपोर्ट सेंटर से कोशिश करें।`
              : `Read ${outcome.fetched} rows, but there are more. Stopped rather than hand you an incomplete file — try the Export Center.`,
            variant: 'destructive',
            duration: 15000,
          });
          break;
        case 'audit-failed':
          toast({
            title: hi ? 'एक्सपोर्ट दर्ज नहीं हो सका' : 'Export could not be recorded',
            description: hi
              ? 'ऑडिट लॉग में लिखा नहीं जा सका, इसलिए कोई फ़ाइल नहीं बनी। यह सुरक्षा है, ख़राबी नहीं।'
              : 'The audit trail could not be written, so no file was produced. That is the safeguard working.',
            variant: 'destructive',
            duration: 12000,
          });
          break;
        case 'read-failed':
        case 'denied':
        case 'failed':
          toast({
            title: hi ? 'एक्सपोर्ट नहीं हुआ' : 'Export failed',
            description: outcome.message,
            variant: 'destructive',
            duration: 12000,
          });
          break;
      }
    } finally {
      setBusy(false);
    }
  }

  const label = hi ? 'एक्सपोर्ट' : 'Export';

  if (offered.length === 1) {
    return (
      <Button size={size} variant={variant} disabled={busy} onClick={() => handle(offered[0])} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {offered.map(f => (
          <DropdownMenuItem key={f} onClick={() => handle(f)}>{f.toUpperCase()}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default EntityExportButton;
