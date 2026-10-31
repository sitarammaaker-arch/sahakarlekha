import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';
import { formatSecret } from '@/lib/totp';
import { ShieldCheck, Copy, Check, KeyRound } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Override the enrolled state (default: the current user's mfaEnabled). The platform-admin
   *  card passes its own is-enrolled status here, since the platform admin's flag lives in
   *  platform_admins, not on the society-user `user` object. */
  enrolled?: boolean;
}

/**
 * ECR-12 — self-service TOTP 2FA setup. Any authenticator app (Google
 * Authenticator, Authy, Microsoft Authenticator) works: the user adds the key
 * shown here, then confirms one code. Login is not yet gated on 2FA, so enabling
 * this is safe and reversible.
 */
export const MfaSetupDialog: React.FC<Props> = ({ open, onOpenChange, enrolled: enrolledOverride }) => {
  const { user, enrollMfa, confirmMfa, disableMfa, generateRecoveryCodes } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const L = (h: string, e: string) => (language === 'hi' ? h : e);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const enrolled = enrolledOverride ?? !!user?.mfaEnabled;

  // Generate a fresh secret each time the dialog opens for a not-yet-enrolled user.
  useEffect(() => {
    if (open && !enrolled) {
      const { secret: s, uri: u } = enrollMfa();
      setSecret(s);
      // Render the otpauth URI as a scannable QR (falls back to manual key if it fails).
      QRCode.toDataURL(u, { margin: 1, width: 200 }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }
    if (!open) { setCode(''); setCopied(false); setRecoveryCodes(null); setQrDataUrl(''); }
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
      toast({ title: L('गलत कोड', 'Wrong code'), description: L('Authenticator app का 6-अंकों वाला कोड सही डालें (हर 30 सेकंड में बदलता है).', 'Enter the 6-digit code from your authenticator app (it changes every 30 seconds).'), variant: 'destructive' });
    } else {
      toast({ title: L('Save नहीं हुआ', 'Not saved'), description: L('Cloud save नहीं हो पाया — internet जाँचकर दोबारा कोशिश करें. आपका 2FA नहीं बदला.', 'Cloud save failed — check the internet and try again. Your 2FA did not change.'), variant: 'destructive', duration: 10000 });
    }
  };

  const handleEnable = async () => {
    setBusy(true);
    const r = await confirmMfa(secret, code);
    setBusy(false);
    showResult(r, L('2FA चालू ✅', '2FA on ✅'), L('अब आपके account पर two-factor authentication लगा है.', 'Two-factor authentication is now on for your account.'));
  };

  const handleDisable = async () => {
    setBusy(true);
    const r = await disableMfa(code);
    setBusy(false);
    showResult(r, L('2FA बंद', '2FA off'), L('Two-factor authentication हटा दिया गया.', 'Two-factor authentication was removed.'));
  };

  const handleGenRecovery = async () => {
    setBusy(true);
    const codes = await generateRecoveryCodes(code);
    setBusy(false);
    if (codes) {
      setRecoveryCodes(codes);
      setCode('');
    } else {
      toast({ title: L('नहीं बने', 'Not created'), description: L('मौजूदा authenticator कोड सही डालें, फिर दोबारा कोशिश करें.', 'Enter the current authenticator code correctly, then try again.'), variant: 'destructive' });
    }
  };

  const copyRecovery = () => {
    navigator.clipboard?.writeText((recoveryCodes || []).join('\n')).then(() => {
      toast({ title: L('Copy हो गया', 'Copied'), description: L('Recovery codes clipboard में हैं — सुरक्षित जगह रखें.', 'Recovery codes are on the clipboard — keep them somewhere safe.') });
    }).catch(() => { /* clipboard unavailable — codes are visible on screen */ });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {enrolled ? L('Two-Factor Authentication (चालू)', 'Two-Factor Authentication (on)') : L('Two-Factor Authentication सेट करें', 'Set up Two-Factor Authentication')}
          </DialogTitle>
          <DialogDescription>
            {enrolled
              ? L('आपके account पर 2FA चालू है. बंद करने के लिए app का मौजूदा कोड डालें.', '2FA is on for your account. Enter the current code from the app to turn it off.')
              : L('किसी भी authenticator app (Google Authenticator / Authy) में नीचे की key जोड़ें, फिर 6-अंकों वाला कोड डालकर पुष्टि करें.', 'Add the key below to any authenticator app (Google Authenticator / Authy), then confirm with the 6-digit code.')}
          </DialogDescription>
        </DialogHeader>

        {!enrolled && (
          <div className="space-y-2">
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-1">
                <img src={qrDataUrl} alt="2FA QR code" width={180} height={180} className="rounded-md border bg-white p-1" />
                <p className="text-xs text-muted-foreground">{L('Authenticator app से यह QR scan करें', 'Scan this QR with your authenticator app')}</p>
              </div>
            )}
            <Label>{qrDataUrl ? L('या manually key जोड़ें', 'Or add the key manually') : L('Secret key (app में manually जोड़ें)', 'Secret key (add it in the app manually)')}</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono tracking-wider break-all">
                {formatSecret(secret)}
              </code>
              <Button type="button" variant="outline" size="icon" onClick={copyKey} aria-label="Copy secret key">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="mfa-code">{L('Authenticator कोड (6 अंक)', 'Authenticator code (6 digits)')}</Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{L('रद्द करें', 'Cancel')}</Button>
          {enrolled ? (
            <Button variant="destructive" onClick={handleDisable} disabled={busy || code.length !== 6}>
              {L('2FA बंद करें', 'Turn off 2FA')}
            </Button>
          ) : (
            <Button onClick={handleEnable} disabled={busy || code.length !== 6}>
              {L('Verify & चालू करें', 'Verify & turn on')}
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
                {recoveryCodes ? L('फिर से बनाएं', 'Create again') : L('बनाएं', 'Create')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {L('Phone/authenticator खो जाए तो इनमें से कोई एक कोड डालकर login कर सकते हैं. हर कोड सिर्फ़ एक बार चलता है. बनाने के लिए ऊपर मौजूदा 6-अंकों वाला कोड डालें.',
                'If you lose the phone/authenticator, sign in with any one of these codes. Each code works only once. Enter the current 6-digit code above to create them.')}
            </p>
            {recoveryCodes && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3">
                  {recoveryCodes.map((rc, i) => (
                    <code key={i} className="text-sm font-mono tracking-wider">{rc.replace(/(.{5})(.{5})/, '$1-$2')}</code>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-amber-600">{L('⚠️ अभी save कर लें — ये दोबारा नहीं दिखेंगे.', '⚠️ Save them now — they will not be shown again.')}</p>
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
