/**
 * Member Portal S2b — the admin's "सदस्य portal" dialog on the Members page.
 * Issue / reset PIN / revoke a member's portal login through the member-portal-admin Edge Function.
 * The server enforces admin-only + plan + eligibility; this UI only mirrors those rules for clarity.
 * A new PIN is held in local state for the one screen that shows it and is dropped when the dialog closes.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fmtDate } from '@/lib/dateUtils';
import { KeyRound, Copy, MessageCircle, Loader2 } from 'lucide-react';
import type { Member } from '@/types';
import {
  callMemberPortalAdmin, handoutMessage, portalUrl, whatsappLink,
  type PortalHandout, type PortalLoginRow,
} from '@/lib/memberPortalAdmin';
import { memberPortalPath } from '@/lib/memberPortalLogin';

interface Props {
  member: Member | null;
  login: PortalLoginRow | undefined;
  societyName: string;
  planAllowed: boolean;
  hi: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function MemberPortalDialog({ member, login, societyName, planAllowed, hi, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [handout, setHandout] = useState<PortalHandout | null>(null);

  // Drop the PIN and any pending confirmation whenever the dialog closes or switches member.
  useEffect(() => { setHandout(null); setConfirmRevoke(false); }, [member?.id]);

  if (!member) return null;
  const close = () => { setHandout(null); setConfirmRevoke(false); onClose(); };

  const run = async (action: 'issue' | 'reset_pin' | 'revoke') => {
    setBusy(true);
    const res = await callMemberPortalAdmin<PortalHandout>(action, member.id);
    setBusy(false);
    setConfirmRevoke(false);
    if (res.ok === false) {
      toast({ title: hi ? 'नहीं हो सका' : 'Could not complete', description: res.message, variant: 'destructive', duration: 10000 });
      return;
    }
    onChanged();
    if (action === 'revoke') {
      toast({ title: hi ? 'Login बंद कर दिया' : 'Login revoked', description: member.name });
    } else {
      setHandout(res.data);
    }
  };

  const url = handout ? portalUrl(window.location.origin, memberPortalPath(handout.societyId)) : '';
  const message = handout ? handoutMessage({ memberName: member.name, societyName, memberNo: handout.memberNo, pin: handout.pin, url }) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: hi ? 'Copy हो गया' : 'Copied' });
    } catch {
      toast({ title: hi ? 'Copy नहीं हुआ — हाथ से लिख लें' : 'Copy failed — note it down', variant: 'destructive' });
    }
  };

  const active = !!login?.is_active;
  const revoked = !!login && !login.is_active;

  return (
    <Dialog open={!!member} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />{hi ? 'सदस्य portal' : 'Member portal'}</DialogTitle>
          <DialogDescription>{member.name} · {member.memberId}</DialogDescription>
        </DialogHeader>

        {handout ? (
          <div className="space-y-4">
            <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 rounded-md p-2">
              {hi ? 'यह PIN केवल अभी दिखेगा। सदस्य को भेज दें — dialog बंद होते ही यह दोबारा नहीं दिखेगा।' : 'This PIN is shown only now. Send it to the member — it cannot be shown again.'}
            </p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{hi ? 'सदस्य संख्या' : 'Member no.'}</p>
                <p className="font-mono text-lg font-semibold">{handout.memberNo}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">PIN</p>
                <p className="font-mono text-2xl font-bold tracking-widest">{handout.pin}</p>
              </div>
            </div>
            <p className="text-xs break-all text-muted-foreground">{url}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={copy}><Copy className="h-4 w-4" />{hi ? 'संदेश copy करें' : 'Copy message'}</Button>
              <Button asChild className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                <a href={whatsappLink(member.phone, message)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />{hi ? 'WhatsApp पर भेजें' : 'Send on WhatsApp'}</a>
              </Button>
            </div>
          </div>
        ) : !planAllowed && !active ? (
          <div className="space-y-3 text-sm">
            <p>{hi ? 'सदस्य portal Plus plan और उससे ऊपर में उपलब्ध है।' : 'The member portal is available on the Plus plan and above.'}</p>
            <Button asChild variant="outline"><Link to="/user-management" onClick={close}>{hi ? 'Plan देखें' : 'View plans'}</Link></Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{hi ? 'स्थिति:' : 'Status:'}</span>
              {active && <Badge className="bg-green-600">{hi ? 'चालू' : 'Active'}</Badge>}
              {revoked && <Badge variant="outline" className="border-destructive text-destructive">{hi ? 'बंद' : 'Revoked'}</Badge>}
              {!login && <Badge variant="outline">{hi ? 'अभी login नहीं दिया' : 'No login yet'}</Badge>}
            </div>
            {active && <p className="text-muted-foreground">{hi ? 'चालू तिथि:' : 'Active since:'} {fmtDate(login!.created_at)}</p>}
            {revoked && login?.revoked_at && <p className="text-muted-foreground">{hi ? 'बंद तिथि:' : 'Revoked on:'} {fmtDate(login.revoked_at)}</p>}
            {confirmRevoke && (
              <p className="text-destructive font-medium">
                {hi ? `क्या आप सच में ${member.name} का portal login बंद करना चाहते हैं?` : `Revoke ${member.name}'s portal login?`}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {handout ? (
            <Button onClick={close}>{hi ? 'हो गया' : 'Done'}</Button>
          ) : confirmRevoke ? (
            <>
              <Button variant="outline" onClick={() => setConfirmRevoke(false)} disabled={busy}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button variant="destructive" onClick={() => run('revoke')} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{hi ? 'हाँ, बंद करें' : 'Yes, revoke'}
              </Button>
            </>
          ) : (
            <>
              {active && (
                <Button variant="outline" className="text-destructive" onClick={() => setConfirmRevoke(true)} disabled={busy}>{hi ? 'बंद करें' : 'Revoke'}</Button>
              )}
              {active && planAllowed && (
                <Button onClick={() => run('reset_pin')} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{hi ? 'नया PIN बनाएँ' : 'Reset PIN'}
                </Button>
              )}
              {!active && planAllowed && (
                <Button onClick={() => run('issue')} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{revoked ? (hi ? 'फिर चालू करें' : 'Re-activate') : (hi ? 'Login दें' : 'Give login')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
