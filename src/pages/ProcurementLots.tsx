import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getBankAccountIds } from '@/lib/storage';
import { Wheat, Plus } from 'lucide-react';

// Phase 1.0 — a small fixed crop list (no Crop master CRUD in scope).
const CROPS = [
  { id: 'wheat', name: 'Wheat', nameHi: 'गेहूँ' },
  { id: 'paddy', name: 'Paddy', nameHi: 'धान' },
  { id: 'mustard', name: 'Mustard', nameHi: 'सरसों' },
  { id: 'gram', name: 'Gram', nameHi: 'चना' },
  { id: 'bajra', name: 'Bajra', nameHi: 'बाजरा' },
];

const QUALITY_RESULTS = [
  { id: 'accepted', en: 'Accepted', hi: 'स्वीकृत' },
  { id: 'accepted_with_cut', en: 'Accepted (with cut)', hi: 'कटौती सहित स्वीकृत' },
  { id: 'rejected', en: 'Rejected', hi: 'अस्वीकृत' },
];

export default function ProcurementLots() {
  const { vouchers, accounts, procurementFarmers, procurementLots, procurementQualityTests, procurementMoistureRecords, procurementJForms, procurementFinancialIntents, procurementPostingRequests, procurementPostingRuleResults, addFarmer, addProcurementLot, recordQualityInspection, generateJForm, generateFinancialIntent, generatePostingRequest, generatePostingRuleResult, generateEngineVoucher, recordFarmerPayment } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  // Create-lot form
  const [farmerId, setFarmerId] = useState('');
  const [cropId, setCropId] = useState('');
  const [variety, setVariety] = useState('');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');

  // Add-farmer dialog
  const [farmerOpen, setFarmerOpen] = useState(false);
  const [farmerName, setFarmerName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [mobile, setMobile] = useState('');

  // Quality dialog
  const [qualityOpen, setQualityOpen] = useState(false);
  const [qualityLotId, setQualityLotId] = useState('');
  const [qualityResult, setQualityResult] = useState('');
  const [moistureValue, setMoistureValue] = useState('');
  const [inspector, setInspector] = useState('');

  // Farmer Payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payEvId, setPayEvId] = useState('');
  const [payOutstanding, setPayOutstanding] = useState(0);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payMode, setPayMode] = useState<'cash' | 'bank'>('cash');
  const [payBankId, setPayBankId] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');

  const cropName = (id: string) => { const c = CROPS.find(x => x.id === id); return c ? (hi ? c.nameHi : c.name) : id; };
  const farmerLabel = (id: string) => { const f = procurementFarmers.find(x => x.id === id); return f ? `${f.farmerName} (${f.farmerCode})` : id; };
  const lotQuality = (lotId: string) => procurementQualityTests.find(q => q.lotId === lotId);
  const lotMoisture = (lotId: string) => procurementMoistureRecords.find(m => m.lotId === lotId);
  const resultLabel = (id: string) => { const r = QUALITY_RESULTS.find(x => x.id === id); return r ? (hi ? r.hi : r.en) : id; };
  const openQuality = (lotId: string) => { setQualityLotId(lotId); setQualityResult(''); setMoistureValue(''); setInspector(''); setQualityOpen(true); };
  const saveQuality = () => {
    const m = Number(moistureValue);
    if (!qualityResult) { toast({ title: hi ? 'परिणाम चुनें' : 'Select a result', variant: 'destructive' }); return; }
    if (moistureValue === '' || !(m >= 0)) { toast({ title: hi ? 'नमी मान दर्ज करें' : 'Enter a valid moisture value', variant: 'destructive' }); return; }
    const qt = recordQualityInspection({ lotId: qualityLotId, result: qualityResult, moisture: m, inspectedBy: inspector.trim() || undefined });
    if (qt.id) { toast({ title: hi ? 'क्वालिटी दर्ज हुई' : 'Quality recorded', description: `${resultLabel(qualityResult)} · ${m}%` }); setQualityOpen(false); }
  };
  const lotJForm = (lotId: string) => procurementJForms.find(j => j.lotId === lotId);
  const handleGenerateJForm = (lotId: string) => {
    // documentNo is DB-generated; generateJForm shows the success toast with the authoritative
    // number once the RPC responds (and toasts on FY-lock / duplicate guard). Nothing to do here.
    generateJForm({ lotId });
  };
  const lotIntent = (lotId: string) => procurementFinancialIntents.find(i => i.lotId === lotId);
  const handleGenerateIntent = (jformId: string) => {
    // generateFinancialIntent shows the success toast (and toasts on FY-lock / missing-J-Form /
    // duplicate guard). Nothing to do here.
    generateFinancialIntent({ jformId });
  };
  const lotPostingRequest = (lotId: string) => procurementPostingRequests.find(p => p.lotId === lotId);
  const handleGeneratePostingRequest = (financialIntentId: string) => {
    // generatePostingRequest shows the success toast (and toasts on FY-lock / missing-intent /
    // duplicate guard). Nothing to do here.
    generatePostingRequest({ financialIntentId });
  };
  const lotRuleResult = (lotId: string) => procurementPostingRuleResults.find(r => r.lotId === lotId);
  const handleResolve = (postingRequestId: string) => {
    // generatePostingRuleResult shows the success toast (and toasts on FY-lock / missing-request /
    // duplicate / no-rule guard). Nothing to do here.
    generatePostingRuleResult({ postingRequestId });
  };
  // The engine Voucher is the authoritative record (origin='engine' + refType/refId → the result).
  const lotEngineVoucher = (lotId: string) => {
    const rr = lotRuleResult(lotId);
    return rr ? vouchers.find(v => !v.isDeleted && v.origin === 'engine' && v.refType === 'posting.rule.result' && v.refId === rr.id) : undefined;
  };
  const handlePost = (postingRuleResultId: string) => {
    // generateEngineVoucher shows the success toast (and toasts on FY-lock / missing-result /
    // duplicate / unresolved-legs guard). Nothing to do here.
    generateEngineVoucher({ postingRuleResultId });
  };
  // Farmer Payment — Payable/Paid/Outstanding are DERIVED from vouchers (no stored balance).
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));
  const lotPayments = (evId: string) => vouchers.filter(v => !v.isDeleted && v.refType === 'farmer.payment' && v.refId === evId);
  const payInfo = (lotId: string) => {
    const ev = lotEngineVoucher(lotId);
    if (!ev) return null;
    const payable = ev.amount;
    const paid = lotPayments(ev.id).reduce((s, v) => s + (v.amount || 0), 0);
    const outstanding = +(payable - paid).toFixed(2);
    const status: 'unpaid' | 'partial' | 'paid' = paid <= 0 ? 'unpaid' : outstanding <= 0 ? 'paid' : 'partial';
    return { ev, payable, paid, outstanding, status };
  };
  const openPay = (lotId: string) => {
    const info = payInfo(lotId);
    if (!info) return;
    setPayEvId(info.ev.id); setPayOutstanding(info.outstanding);
    setPayAmount(String(info.outstanding)); setPayDate(new Date().toISOString().split('T')[0]);
    setPayMode('cash'); setPayBankId(bankAccounts[0]?.id || ''); setPayRef(''); setPayRemarks('');
    setPayOpen(true);
  };
  const savePay = () => {
    const amt = Number(payAmount);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    if (amt > payOutstanding) { toast({ title: hi ? 'राशि बकाया से अधिक' : 'Exceeds outstanding', description: `${hi ? 'बकाया' : 'Outstanding'} ${money(payOutstanding)}`, variant: 'destructive' }); return; }
    const v = recordFarmerPayment({ engineVoucherId: payEvId, amount: amt, mode: payMode, bankAccountId: payMode === 'bank' ? (payBankId || undefined) : undefined, paymentDate: payDate, reference: payRef.trim() || undefined, remarks: payRemarks.trim() || undefined });
    if (v.id) { toast({ title: hi ? 'भुगतान दर्ज हुआ' : 'Payment recorded', description: `${money(amt)} · ${payMode === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक' : 'Bank')}` }); setPayOpen(false); }
  };

  const saveFarmer = () => {
    if (!farmerName.trim()) { toast({ title: hi ? 'किसान का नाम आवश्यक है' : 'Farmer name is required', variant: 'destructive' }); return; }
    const f = addFarmer({ farmerName: farmerName.trim(), fatherName: fatherName.trim() || undefined, mobile: mobile.trim() || undefined });
    if (f.id) { setFarmerId(f.id); toast({ title: hi ? 'किसान जोड़ा गया' : 'Farmer added', description: `${f.farmerName} (${f.farmerCode})` }); }
    setFarmerName(''); setFatherName(''); setMobile(''); setFarmerOpen(false);
  };

  const saveLot = () => {
    const q = Number(qty), r = Number(rate);
    if (!farmerId) { toast({ title: hi ? 'किसान चुनें' : 'Select a farmer', variant: 'destructive' }); return; }
    if (!cropId) { toast({ title: hi ? 'फसल चुनें' : 'Select a crop', variant: 'destructive' }); return; }
    if (!(q > 0)) { toast({ title: hi ? 'मात्रा दर्ज करें' : 'Enter a valid quantity', variant: 'destructive' }); return; }
    if (!(r > 0)) { toast({ title: hi ? 'MSP दर दर्ज करें' : 'Enter a valid MSP rate', variant: 'destructive' }); return; }
    const lot = addProcurementLot({ farmerId, cropId, varietyId: variety.trim() || undefined, quantity: { value: q, unit: 'qtl' }, mspRate: { amount: r, currency: 'INR' } });
    if (lot.id) {
      toast({ title: hi ? 'प्रोक्योरमेंट लॉट बना' : 'Procurement Lot created', description: `${farmerLabel(farmerId)} · ${cropName(cropId)} · ${q} qtl` });
      setCropId(''); setVariety(''); setQty(''); setRate('');
    }
  };

  const lots = [...procurementLots].reverse();

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Wheat className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'प्रोक्योरमेंट लॉट' : 'Procurement Lots'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'किसान चुनें और नया लॉट बनाएँ' : 'Select a farmer and create a new lot'}</p>
        </div>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया लॉट' : 'New Lot'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{hi ? 'किसान' : 'Farmer'}</Label>
            <div className="flex gap-2">
              <Select value={farmerId} onValueChange={setFarmerId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder={hi ? 'किसान चुनें' : 'Select farmer'} /></SelectTrigger>
                <SelectContent>
                  {procurementFarmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmerName} ({f.farmerCode})</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setFarmerOpen(true)} className="gap-1"><Plus className="h-4 w-4" />{hi ? 'किसान जोड़ें' : 'Add Farmer'}</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'फसल' : 'Crop'}</Label>
              <Select value={cropId} onValueChange={setCropId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फसल चुनें' : 'Select crop'} /></SelectTrigger>
                <SelectContent>
                  {CROPS.map(c => <SelectItem key={c.id} value={c.id}>{hi ? c.nameHi : c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'किस्म' : 'Variety'}</Label>
              <Input value={variety} onChange={e => setVariety(e.target.value)} placeholder={hi ? 'किस्म (वैकल्पिक)' : 'Variety (optional)'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'मात्रा (क्विंटल)' : 'Quantity (qtl)'}</Label>
              <Input type="number" min={0} value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'MSP दर (₹/क्विंटल)' : 'MSP Rate (₹/qtl)'}</Label>
              <Input type="number" min={0} value={rate} onChange={e => setRate(e.target.value)} placeholder="0" />
            </div>
          </div>

          <Button onClick={saveLot} className="w-full">{hi ? 'लॉट सेव करें' : 'Save Lot'}</Button>
        </CardContent>
      </Card>

      {/* Lot list */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'बने हुए लॉट' : 'Created Lots'} ({lots.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {lots.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी तक कोई लॉट नहीं।' : 'No lots yet.'}</p>}
          {lots.map(l => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium">{farmerLabel(l.farmerId)} · {cropName(l.cropId)}{l.varietyId ? ` (${l.varietyId})` : ''}</div>
                <div className="text-muted-foreground">
                  {l.quantity?.value ?? 0} {l.quantity?.unit ?? 'qtl'} · ₹{l.mspRate?.amount ?? 0}/{hi ? 'क्विंटल' : 'qtl'}
                </div>
                {lotQuality(l.id) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hi ? 'क्वालिटी' : 'Quality'}: {resultLabel(lotQuality(l.id)!.result)}
                    {lotMoisture(l.id) ? ` · ${hi ? 'नमी' : 'Moisture'} ${lotMoisture(l.id)!.moisture.value}%` : ''}
                  </div>
                )}
                {lotJForm(l.id) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    J-Form: {lotJForm(l.id)!.documentNo} · ₹{lotJForm(l.id)!.net.amount}
                  </div>
                )}
                {lotIntent(l.id) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hi ? 'इंटेंट' : 'Intent'}: {lotIntent(l.id)!.intentType} · ₹{lotIntent(l.id)!.amount.amount}
                  </div>
                )}
                {lotPostingRequest(l.id) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hi ? 'पोस्टिंग' : 'Posting Req'}: {lotPostingRequest(l.id)!.requestType} · ₹{lotPostingRequest(l.id)!.amount.amount}
                  </div>
                )}
                {lotRuleResult(l.id) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hi ? 'लेग्स' : 'Legs'}: {lotRuleResult(l.id)!.requestType} · {lotRuleResult(l.id)!.legs.length} legs
                  </div>
                )}
                {lotEngineVoucher(l.id) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hi ? 'वाउचर' : 'Voucher'}: {lotEngineVoucher(l.id)!.voucherNo}
                  </div>
                )}
                {payInfo(l.id) && (
                  <div className="text-xs mt-0.5">
                    <span className={payInfo(l.id)!.status === 'paid' ? 'text-green-600' : payInfo(l.id)!.status === 'partial' ? 'text-amber-600' : 'text-muted-foreground'}>
                      {payInfo(l.id)!.status === 'paid' ? (hi ? '● पूर्ण भुगतान' : '● Fully Paid') : payInfo(l.id)!.status === 'partial' ? (hi ? '◐ आंशिक भुगतान' : '◐ Partially Paid') : (hi ? '○ अभुगतान' : '○ Unpaid')}
                    </span>
                    {' · '}{hi ? 'देय' : 'Payable'} {money(payInfo(l.id)!.payable)} · {hi ? 'भुगतान' : 'Paid'} {money(payInfo(l.id)!.paid)} · {hi ? 'बकाया' : 'Outstanding'} {money(payInfo(l.id)!.outstanding)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary">{l.operationalStatus}</Badge>
                {!lotQuality(l.id) && <Button size="sm" variant="outline" onClick={() => openQuality(l.id)}>{hi ? 'क्वालिटी' : 'Quality'}</Button>}
                {!lotJForm(l.id) && <Button size="sm" variant="outline" onClick={() => handleGenerateJForm(l.id)}>J-Form</Button>}
                {lotJForm(l.id) && !lotIntent(l.id) && <Button size="sm" variant="outline" onClick={() => handleGenerateIntent(lotJForm(l.id)!.id)}>{hi ? 'इंटेंट' : 'Intent'}</Button>}
                {lotIntent(l.id) && !lotPostingRequest(l.id) && <Button size="sm" variant="outline" onClick={() => handleGeneratePostingRequest(lotIntent(l.id)!.id)}>{hi ? 'पोस्टिंग' : 'Posting Req'}</Button>}
                {lotPostingRequest(l.id) && !lotRuleResult(l.id) && <Button size="sm" variant="outline" onClick={() => handleResolve(lotPostingRequest(l.id)!.id)}>{hi ? 'रिज़ॉल्व' : 'Resolve'}</Button>}
                {lotRuleResult(l.id) && !lotEngineVoucher(l.id) && <Button size="sm" variant="outline" onClick={() => handlePost(lotRuleResult(l.id)!.id)}>{hi ? 'पोस्ट' : 'Post'}</Button>}
                {lotEngineVoucher(l.id) && payInfo(l.id)!.outstanding > 0 && <Button size="sm" variant="outline" onClick={() => openPay(l.id)}>{hi ? 'किसान को भुगतान' : 'Pay Farmer'}</Button>}
                {lotEngineVoucher(l.id) && payInfo(l.id)!.outstanding <= 0 && <span className="text-xs text-green-600 font-medium">{hi ? '✓ पूर्ण भुगतान' : '✓ Fully Paid'}</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add-farmer dialog */}
      <Dialog open={farmerOpen} onOpenChange={setFarmerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'नया किसान' : 'Add Farmer'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'किसान का नाम' : 'Farmer Name'} *</Label>
              <Input value={farmerName} onChange={e => setFarmerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'पिता का नाम' : 'Father Name'}</Label>
              <Input value={fatherName} onChange={e => setFatherName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'मोबाइल' : 'Mobile'}</Label>
              <Input value={mobile} onChange={e => setMobile(e.target.value)} maxLength={10} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFarmerOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveFarmer}>{hi ? 'जोड़ें' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quality inspection dialog */}
      <Dialog open={qualityOpen} onOpenChange={setQualityOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'क्वालिटी जाँच' : 'Quality Inspection'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'परिणाम' : 'Result'} *</Label>
              <Select value={qualityResult} onValueChange={setQualityResult}>
                <SelectTrigger><SelectValue placeholder={hi ? 'परिणाम चुनें' : 'Select result'} /></SelectTrigger>
                <SelectContent>{QUALITY_RESULTS.map(r => <SelectItem key={r.id} value={r.id}>{hi ? r.hi : r.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'नमी (%)' : 'Moisture (%)'} *</Label>
              <Input type="number" min={0} value={moistureValue} onChange={e => setMoistureValue(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'निरीक्षक' : 'Inspector'}</Label>
              <Input value={inspector} onChange={e => setInspector(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualityOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveQuality}>{hi ? 'दर्ज करें' : 'Record'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'किसान को भुगतान' : 'Pay Farmer'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">{hi ? 'बकाया' : 'Outstanding'}: {money(payOutstanding)}</div>
            <div className="space-y-1.5">
              <Label>{hi ? 'राशि' : 'Amount'} *</Label>
              <Input type="number" min={0} max={payOutstanding} value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'भुगतान तिथि' : 'Payment Date'} *</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'माध्यम' : 'Mode'} *</Label>
              <Select value={payMode} onValueChange={v => setPayMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMode === 'bank' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={payBankId} onValueChange={setPayBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{hi ? 'संदर्भ' : 'Reference'}</Label>
              <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={hi ? 'वैकल्पिक (चेक/UTR)' : 'optional (cheque/UTR)'} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'टिप्पणी' : 'Remarks'}</Label>
              <Input value={payRemarks} onChange={e => setPayRemarks(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={savePay}>{hi ? 'भुगतान करें' : 'Pay'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
