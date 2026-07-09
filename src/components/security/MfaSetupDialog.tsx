import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatSecret } from '@/lib/totp';
import { ShieldCheck, Copy, Check, KeyRound } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ECR-12 — self-service TOTP 2FA setup. Any authenticator app (Google
 * Authenticator, Authy, Microsoft Authenticator) works: the user adds the key
 * shown here, then confirms one code. Login is not yet gated on 2FA, so enabling
 * this is safe and reversible.
 */
export const MfaSetupDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { user, enrollMfa, confirmMfa, disableMfa, generateRecoveryCodes } = useAuth();
  const { toast } = useToast();
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const enrolled = !!user?.mfaEnabled;

  // Generate a fresh secret each time the dialog opens for a not-yet-enrolled user.
  useEffect(() => {
    if (open && !enrolled) {
      const { secret: s, uri: u } = enrollMfa();
      setSecret(s);
      setUri(u);
    }
    if (!open) { setCode(''); setCopied(false); setRecoveryCodes(null); }
  }, [open, enrolled, enrollMfa]);

  const copyKey = () => {
    navigator.clipboard?.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* clipboard unavailable — key is visible for manual entry */ });
  };

  const showResult = (r: { ok: boolean; reason?: string }, okTitle: string, okDesc: string) => {
    if (r.ok) { toast({ title: okTitle, description: okDesc }); onOpenChange(false); return; }
    if (r.reason === 'bad-code') {
      toast({ title: 'गलत कोड', description: 'Authenticator app का 6-अंकों वाला कोड सही डालें (हर 30 सेकंड में बदलता है).', variant: 'destructive' });
    } else {
      toast({ title: 'Save नहीं हुआ', description: 'Cloud save नहीं हो पाया — internet जाँचकर दोबारा कोशिश करें. आपका 2FA नहीं बदला.', variant: 'destructive', duration: 10000 });
    }
  };

  const handleEnable = async () => {
    setBusy(true);
    const r = await confirmMfa(secret, code);
    setBusy(false);
    showResult(r, '2FA चालू ✅', 'अब आपके account पर two-factor authentication लगा है.');
  };

  const handleDisable = async () => {
    setBusy(true);
    const r = await disableMfa(code);
    setBusy(false);
    showResult(r, '2FA बंद', 'Two-factor authentication हटा दिया गया.');
  };

  const handleGenRecovery = async () => {
    setBusy(true);
    const codes = await generateRecoveryCodes(code);
    setBusy(false);
    if (codes) {
      setRecoveryCodes(codes);
      setCode('');
    } else {
      toast({ title: 'नहीं बने', description: 'मौजूदा authenticator कोड सही डालें, फिर दोबारा कोशिश करें.', variant: 'destructive' });
    }
  };

  const copyRecovery = () => {
    navigator.clipboard?.writeText((recoveryCodes || []).join('\n')).then(() => {
      toast({ title: 'Copy हो गया', description: 'Recovery codes clipboard में हैं — सुरक्षित जगह रखें.' });
    }).catch(() => { /* clipboard unavailable — codes are visible on screen */ });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {enrolled ? 'Two-Factor Authentication (चालू)' : 'Two-Factor Authentication सेट करें'}
          </DialogTitle>
          <DialogDescription>
            {enrolled
              ? 'आपके account पर 2FA चालू है. बंद करने के लिए app का मौजूदा कोड डालें.'
              : 'किसी भी authenticator app (Google Authenticator / Authy) में नीचे की key जोड़ें, फिर 6-अंकों वाला कोड डालकर पुष्टि करें.'}
          </DialogDescription>
        </DialogHeader>

        {!enrolled && (
          <div className="space-y-2">
            <Label>Secret key (app में manually जोड़ें)</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono tracking-wider break-all">
                {formatSecret(secret)}
              </code>
              <Button type="button" variant="outline" size="icon" onClick={copyKey} aria-label="Copy secret key">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="break-all text-xs text-muted-foreground">
              या यह लिंक/QR-URI इस्तेमाल करें: <span className="font-mono">{uri}</span>
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="mfa-code">Authenticator कोड (6 अंक)</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center text-lg tracking-[0.5em] font-mono"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>रद्द करें</Button>
          {enrolled ? (
            <Button variant="destructive" onClick={handleDisable} disabled={busy || code.length !== 6}>
              2FA बंद करें
            </Button>
          ) : (
            <Button onClick={handleEnable} disabled={busy || code.length !== 6}>
              Verify & चालू करें
            </Button>
          )}
        </div>

        {enrolled && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-primary" /> Recovery codes
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={handleGenRecovery} disabled={busy || code.length !== 6}>
                {recoveryCodes ? 'फिर से बनाएं' : 'बनाएं'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Phone/authenticator खो जाए तो इनमें से कोई एक कोड डालकर login कर सकते हैं. हर कोड सिर्फ़ एक बार चलता है. बनाने के लिए ऊपर मौजूदा 6-अंकों वाला कोड डालें.
            </p>
            {recoveryCodes && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3">
                  {recoveryCodes.map((rc, i) => (
                    <code key={i} className="text-sm font-mono tracking-wider">{rc.replace(/(.{5})(.{5})/, '$1-$2')}</code>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-amber-600">⚠️ अभी save कर लें — ये दोबारा नहीं दिखेंगे.</p>
                  <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={copyRecovery}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
