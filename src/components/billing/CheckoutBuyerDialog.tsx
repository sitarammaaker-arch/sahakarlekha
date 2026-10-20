/**
 * Checkout step that collects the buyer details printed on the tax invoice: name, state (required — it
 * decides CGST+SGST vs IGST), GSTIN (optional — a registered society gets a B2B invoice for its ITC) and
 * address. Prefilled from Society Setup. buyerProblem (lib/billing/checkoutBuyer) only helps the user;
 * create-order re-validates everything (_shared/invoice-core.mjs validateBuyer) and its message is shown if it refuses.
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INDIAN_STATES } from '@/lib/constants';
import { stateCodeFromGstin, stateCodeFromSetupValue } from '@/lib/gstStates';
import { buyerProblem, type CheckoutBuyer } from '@/lib/billing/checkoutBuyer';
import type { SocietySettings } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  society: SocietySettings;
  hi: boolean;
  /** e.g. "Upgrade: Plus (₹3,999/वर्ष)" */
  title: string;
  note?: string;
  busy: boolean;
  onConfirm: (buyer: CheckoutBuyer) => void;
}

const SETUP_STATES = INDIAN_STATES.map((s) => ({ ...s, code: stateCodeFromSetupValue(s.value) })).filter((s) => s.code);

export default function CheckoutBuyerDialog({ open, onOpenChange, society, hi, title, note, busy, onConfirm }: Props) {
  const initial = (): CheckoutBuyer => ({
    name: society.name || '',
    gstin: (society.gstin || '').toUpperCase(),
    stateCode: stateCodeFromGstin(society.gstin) || stateCodeFromSetupValue(society.state),
    address: [society.address, society.district, society.pinCode].filter(Boolean).join(', '),
  });
  const [b, setB] = useState<CheckoutBuyer>(initial);
  const [touched, setTouched] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setB(initial()); setTouched(false); } }, [open]);

  const problem = buyerProblem(b, hi);
  const submit = () => {
    setTouched(true);
    if (!problem) onConfirm({ ...b, name: b.name.trim(), gstin: b.gstin.trim().toUpperCase(), address: b.address.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {note ? `${note} ` : ''}
            {hi ? 'ये जानकारी आपके GST tax invoice पर छपेगी।' : 'These details are printed on your GST tax invoice.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="buyer-name">{hi ? 'समिति का नाम' : 'Society name'}</Label>
            <Input id="buyer-name" value={b.name} maxLength={200} onChange={(e) => setB({ ...b, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{hi ? 'राज्य' : 'State'}</Label>
            <Select value={b.stateCode} onValueChange={(v) => setB({ ...b, stateCode: v })}>
              <SelectTrigger><SelectValue placeholder={hi ? 'राज्य चुनें' : 'Choose the state'} /></SelectTrigger>
              <SelectContent>
                {SETUP_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.code}>{s.code} - {hi ? s.labelHi : s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-gstin">GSTIN <span className="text-muted-foreground font-normal">({hi ? 'अगर है' : 'if registered'})</span></Label>
            <Input id="buyer-gstin" value={b.gstin} maxLength={15} placeholder="06AAAAA0000A1Z5" className="font-mono"
              onChange={(e) => {
                const g = e.target.value.toUpperCase().replace(/\s/g, '');
                const gs = stateCodeFromGstin(g);
                setB({ ...b, gstin: g, ...(gs ? { stateCode: gs } : {}) }); // a full GSTIN sets its own state
              }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-address">{hi ? 'पता' : 'Address'}</Label>
            <Input id="buyer-address" value={b.address} maxLength={500} onChange={(e) => setB({ ...b, address: e.target.value })} />
          </div>
          {touched && problem && <p className="text-sm text-destructive">{problem}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? (hi ? 'खुल रहा है…' : 'Opening…') : (hi ? 'भुगतान पर जाएँ' : 'Continue to payment')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
