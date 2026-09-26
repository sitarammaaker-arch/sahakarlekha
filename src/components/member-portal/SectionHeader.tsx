/**
 * Section header for the member account (portal + staff Member-360). On the staff page a section can
 * carry a link to its source page ("Loan Register में खोलें") so staff can act there — the account
 * itself stays read-only. Links are never printed.
 */
import { Link } from 'react-router-dom';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

export type SectionKey = 'share' | 'loans' | 'deposits' | 'kcc' | 'dairy' | 'housing' | 'consumer';
export type SectionLinks = Partial<Record<SectionKey, { to: string; label: string }>>;

export function SectionHeader({ title, link }: { title: string; link?: { to: string; label: string } }) {
  return (
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
      <CardTitle className="text-base">{title}</CardTitle>
      {link && (
        <Link to={link.to} className="inline-flex items-center gap-1 text-xs text-primary hover:underline print:hidden">
          {link.label}<ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </CardHeader>
  );
}
