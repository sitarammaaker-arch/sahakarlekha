/**
 * Member-360 (staff) — /members/:id. One member's whole account on one page: share capital, loans,
 * deposits, KCC, dairy, housing, consumer credit and profile. Read-only (no RULE 1 / RULE 6 surface).
 *
 * The body is the SAME MemberAccountView the member sees on the portal, fed by buildMember360 — the
 * staff state run through the portal's view builders — so staff, member and every source page show
 * the same figures (RULE 2). Access follows the Members page: CapabilityGuard maps /members/:id to
 * the /members module (lib/navigation/routeModule.ts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useDistributionRuns } from '@/hooks/useDistributionRuns';
import { useLoanAccruals } from '@/hooks/useLoanAccruals';
import { useDairyData } from '@/contexts/DairyDataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Printer, ContactRound, KeyRound } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { buildMember360 } from '@/lib/member360';
import { MemberAccountView } from '@/components/member-portal/MemberAccountView';
import type { SectionLinks } from '@/components/member-portal/SectionHeader';
import { MemberPortalDialog } from '@/components/members/MemberPortalDialog';
import { callMemberPortalAdmin, portalPlanAllowed, type PortalLoginRow } from '@/lib/memberPortalAdmin';

const STATUS_HI: Record<string, string> = { active: 'सक्रिय', inactive: 'निष्क्रिय', resigned: 'त्यागपत्र', expelled: 'निष्कासित', deceased: 'मृत' };

export default function Member360() {
  const { id = '' } = useParams();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const {
    members, vouchers, loans, depositAccounts, depositTransactions, kccLoans, accounts, sales, society, matchesActiveBranch,
  } = useData();
  const { milkEntries, settlements, inputIssues, distributions } = useDairyData();
  const { maintenanceBills, housingFlats } = useHousingData();
  const { memberRecoveries, salesReturns, patronageRuns } = useConsumerData();

  const member = members.find((m) => m.id === id);
  const { runs: distributionRuns } = useDistributionRuns();
  const { accruals: loanAccruals } = useLoanAccruals();

  // Admin only: the member's portal-login state + the same issue/reset/revoke dialog as the Members list.
  // (The Edge Function re-checks admin + plan; non-admins never call it.)
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { plan, status: subStatus } = useSubscription();
  const [portalLogin, setPortalLogin] = useState<PortalLoginRow | null | undefined>(undefined);
  const [portalOpen, setPortalOpen] = useState(false);
  const loadPortalLogin = useCallback(async () => {
    if (!isAdmin || !id) return;
    const res = await callMemberPortalAdmin<{ logins: PortalLoginRow[] }>('list');
    if (res.ok) setPortalLogin(res.data.logins.find((l) => l.member_id === id) ?? null);
  }, [isAdmin, id]);
  useEffect(() => { void loadPortalLogin(); }, [loadPortalLogin]);

  // Source pages — where staff act on each part of the account (this page is read-only).
  const open = (hiName: string, enName: string) => (hi ? `${hiName} में खोलें` : `Open in ${enName}`);
  const links: SectionLinks = {
    share: { to: '/share-register', label: open('शेयर रजिस्टर', 'Share Register') },
    loans: { to: '/loan-register', label: open('ऋण रजिस्टर', 'Loan Register') },
    deposits: { to: '/deposits', label: open('जमा', 'Deposits') },
    kcc: { to: '/kcc-loan', label: open('KCC', 'KCC') },
    dairy: { to: '/dairy-registers', label: open('डेयरी रजिस्टर', 'Dairy Registers') },
    housing: { to: '/member-statement', label: open('सदस्य विवरण', 'Member Statement') },
    consumer: { to: '/member-credit', label: open('सदस्य उधार', 'Member Credit') },
    dividend: { to: '/profit-distribution', label: open('लाभ का बँटवारा', 'Profit Distribution') },
  };

  const m360 = useMemo(() => {
    if (!member) return null;
    return buildMember360(member, {
      society: { name: society.name, nameHi: society.nameHi },
      vouchers, loans, depositAccounts, depositTransactions, kccLoans, accounts,
      milkEntries, dairySettlements: settlements, dairyInputIssues: inputIssues, dairyDistributions: distributions,
      maintenanceBills, housingFlats,
      sales, memberRecoveries, salesReturns, patronageRuns, distributionRuns, loanAccruals,
    }, new Date().toISOString().slice(0, 10));
  }, [member, society.name, society.nameHi, vouchers, loans, depositAccounts, depositTransactions, kccLoans, accounts,
    milkEntries, settlements, inputIssues, distributions, maintenanceBills, housingFlats, sales, memberRecoveries, salesReturns, patronageRuns, distributionRuns, loanAccruals]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="gap-1 print:hidden">
      <Link to="/members"><ArrowLeft className="h-4 w-4" />{hi ? 'सदस्य सूची' : 'Members'}</Link>
    </Button>
  );

  if (!member || !m360) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {back}
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          {hi ? 'यह सदस्य नहीं मिला — हो सकता है हटा दिया गया हो या दूसरी समिति का हो।' : 'Member not found — it may have been removed or belong to another society.'}
        </CardContent></Card>
      </div>
    );
  }

  // ECR-17: respect the branch selector, like the Members list does.
  if (!matchesActiveBranch(member.branchId)) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {back}
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          {hi ? 'यह सदस्य चुनी गई शाखा में नहीं है। ऊपर से "सभी शाखाएँ" चुनें।' : 'This member is not in the selected branch. Switch to all branches.'}
        </CardContent></Card>
      </div>
    );
  }

  const { snapshot, view, verticals } = m360;
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          {back}
          <h1 className="text-2xl font-bold flex items-center gap-2"><ContactRound className="h-6 w-6 text-primary" />{member.name}</h1>
          <p className="text-sm text-muted-foreground">
            {hi ? 'सदस्य संख्या' : 'Member no.'} <span className="font-mono font-semibold text-foreground">{member.memberId}</span>
            {member.joinDate && <> · {hi ? 'सदस्यता' : 'Member since'} {fmtDate(member.joinDate)}</>}
            {' · '}<Badge variant="outline">{hi ? (STATUS_HI[member.status] ?? member.status) : member.status}</Badge>
          </p>
          <p className="text-xs text-muted-foreground">{hi ? 'सदस्य का पूरा हिसाब — वही जो सदस्य portal पर देखता है।' : 'The member’s whole account — exactly what they see on the member portal.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {isAdmin && portalLogin !== undefined && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setPortalOpen(true)}>
              <KeyRound className="h-4 w-4" />
              {hi ? 'सदस्य portal:' : 'Member portal:'}{' '}
              {portalLogin?.is_active
                ? <Badge className="bg-green-600">{hi ? 'चालू' : 'Active'}</Badge>
                : portalLogin
                  ? <Badge variant="outline" className="border-destructive text-destructive">{hi ? 'बंद' : 'Revoked'}</Badge>
                  : <Badge variant="outline">{hi ? 'नहीं दिया' : 'Not issued'}</Badge>}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />Print / PDF
          </Button>
        </div>
      </div>

      <MemberAccountView member={snapshot.member} view={view} verticals={verticals} hi={hi} links={links} />

      {isAdmin && (
        <MemberPortalDialog
          member={portalOpen ? member : null}
          login={portalLogin ?? undefined}
          societyName={(hi ? society.nameHi : society.name) || society.name || ''}
          planAllowed={portalPlanAllowed(plan, subStatus)}
          hi={hi}
          onClose={() => setPortalOpen(false)}
          onChanged={loadPortalLogin}
        />
      )}
    </div>
  );
}
