import { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
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

// Legacy crop ids (used before the M1a Crop master). Kept only so lots created earlier still
// render a readable crop name; new lots pick from the Crop master (useMarketingData().crops).
const LEGACY_CROPS: Record<string, { name: string; nameHi: string }> = {
  wheat: { name: 'Wheat', nameHi: 'गेहूँ' },
  paddy: { name: 'Paddy', nameHi: 'धान' },
  mustard: { name: 'Mustard', nameHi: 'सरसों' },
  gram: { name: 'Gram', nameHi: 'चना' },
  bajra: { name: 'Bajra', nameHi: 'बाजरा' },
};

const QUALITY_RESULTS = [
  { id: 'accepted', en: 'Accepted', hi: 'स्वीकृत' },
  { id: 'accepted_with_cut', en: 'Accepted (with cut)', hi: 'कटौती सहित स्वीकृत' },
  { id: 'rejected', en: 'Rejected', hi: 'अस्वीकृत' },
];

// MSP deduction types. `acc` is a default credit account ONLY where the chart binding is unambiguous
// (TDS → 2202 TDS Payable). For the rest the operator selects the account from the chart (no invented
// IDs / no baked-in accounting treatment).
const DEDUCTION_TYPES = [
  { id: 'tds', en: 'TDS', hi: 'TDS', acc: '2202' },
  { id: 'market_fee', en: 'Market Fee', hi: 'मंडी शुल्क', acc: '' },
  { id: 'hrdf', en: 'HRDF', hi: 'HRDF', acc: '' },
  { id: 'labour', en: 'Labour', hi: 'हमाली', acc: '' },
  { id: 'weighment', en: 'Weighment', hi: 'तौल', acc: '' },
  { id: 'bardana', en: 'Bardana', hi: 'बारदाना', acc: '' },
  { id: 'transport', en: 'Transportation', hi: 'परिवहन', acc: '' },
  { id: 'other', en: 'Other Recovery', hi: 'अन्य वसूली', acc: '' },
];

export default function ProcurementLots() {
  const { vouchers, accounts, procurementFarmers, procurementLots, procurementQualityTests, procurementMoistureRecords, procurementJForms, procurementFinancialIntents, procurementPostingRequests, procurementPostingRuleResults, procurementSettlements, addFarmer, addProcurementLot, recordQualityInspection, generateJForm, generateFinancialIntent, generatePostingRequest, generatePostingRuleResult, generateEngineVoucher, createFarmerSettlement, addSettlementDeductionLine, removeSettlementDeductionLine, approveFarmerSettlement, recordFarmerPayment } = useData();
  const { crops, varieties, seasons, agencies, centres, resolveMspRate, deductionRules, accrueProcurementCommission, commissionAccruals } = useMarketingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  // Create-lot form
  const [farmerId, setFarmerId] = useState('');
  const [cropId, setCropId] = useState('');
  const [varietyId, setVarietyId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [centreId, setCentreId] = useState('');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [mspAuto, setMspAuto] = useState(false);

  // Auto-fill the MSP rate from the effective rate master when crop + season are both chosen.
  // The operator can still edit the rate afterwards (manual override clears the "auto" hint).
  useEffect(() => {
    if (!cropId || !seasonId) { setMspAuto(false); return; }
    const r = resolveMspRate({ cropId, seasonId });
    if (r != null) { setRate(String(r)); setMspAuto(true); } else { setMspAuto(false); }
  }, [cropId, seasonId, resolveMspRate]);

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

  // Farmer Settlement dialog (build draft deduction lines → approve). Deductions live ONLY here.
  const [setlOpen, setSetlOpen] = useState(false);
  const [setlId, setSetlId] = useState('');
  // add-deduction-line sub-form (inside the settlement dialog)
  const [dedType, setDedType] = useState('');
  const [dedAccId, setDedAccId] = useState('');
  const [dedAmount, setDedAmount] = useState('');
  const [dedRef, setDedRef] = useState('');
  const [dedRemarks, setDedRemarks] = useState('');

  const cropName = (id: string) => {
    const c = crops.find(x => x.id === id);
    if (c) return hi && c.nameHi ? c.nameHi : c.name;
    const legacy = LEGACY_CROPS[id];
    return legacy ? (hi ? legacy.nameHi : legacy.name) : id;
  };
  const varietyLabel = (id?: string) => {
    if (!id) return '';
    const v = varieties.find(x => x.id === id);
    return v ? (hi && v.nameHi ? v.nameHi : v.name) : id; // legacy lots stored free-text in varietyId
  };
  const cropVarieties = varieties.filter(v => v.cropId === cropId);
  const seasonLabel = (id?: string) => { const s = seasons.find(x => x.id === id); return s ? (hi && s.nameHi ? s.nameHi : s.name) : ''; };
  const centreLabel = (id?: string) => {
    const c = centres.find(x => x.id === id);
    if (!c) return '';
    const ag = agencies.find(a => a.id === c.agencyId);
    return `${hi && c.nameHi ? c.nameHi : c.name}${ag ? ` · ${ag.code || ag.name}` : ''}`;
  };
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
  // Settlement is the SOURCE OF TRUTH — gross/deductions/net/paid read STORED fields, never vouchers.
  const settlementForLot = (lotId: string) => { const ev = lotEngineVoucher(lotId); return ev ? procurementSettlements.find(s => !s.isDeleted && s.engineVoucherId === ev.id) : undefined; };
  const currentSettlement = procurementSettlements.find(s => s.id === setlId && !s.isDeleted);
  const payInfo = (lotId: string) => {
    const ev = lotEngineVoucher(lotId);
    if (!ev) return null;
    const s = procurementSettlements.find(x => !x.isDeleted && x.engineVoucherId === ev.id);
    if (!s) return { ev, settlement: null, gross: ev.amount, totalDeductions: 0, netPayable: ev.amount, paid: 0, outstanding: ev.amount, payStatus: 'unpaid' as const };
    const gross = s.gross.amount;
    const totalDeductions = +s.deductionLines.reduce((a, l) => a + l.amount.amount, 0).toFixed(2);
    const netPayable = s.netPayable.amount;
    const paid = s.amountPaid.amount;
    const outstanding = +(netPayable - paid).toFixed(2);
    const payStatus: 'unpaid' | 'partial' | 'paid' = (s.status === 'approved' && outstanding <= 0) ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    return { ev, settlement: s, gross, totalDeductions, netPayable, paid, outstanding, payStatus };
  };
  const postableAccounts = accounts.filter(a => !a.isGroup);
  // M3d — commission: agency via lot's centre; amount = agency rate% × posted procurement value.
  const lotAgency = (l: (typeof procurementLots)[number]) => { const c = centres.find(x => x.id === l.centreId); return c ? agencies.find(a => a.id === c.agencyId) : undefined; };
  const commissionForLot = (lotId: string) => commissionAccruals.find(v => v.refId === lotId);
  const lotCommissionInfo = (l: (typeof procurementLots)[number]) => {
    const ev = lotEngineVoucher(l.id);
    const ag = lotAgency(l);
    if (!ev || !ag || ag.commissionRate == null || !(ag.commissionRate > 0)) return null;
    const amount = Math.round((ag.commissionRate / 100 * ev.amount + Number.EPSILON) * 100) / 100;
    return { agency: ag, rate: ag.commissionRate, amount };
  };
  const openSettlement = (lotId: string) => {
    const s = settlementForLot(lotId);
    if (!s) return;
    setSetlId(s.id); setDedType(''); setDedAccId(''); setDedAmount(''); setDedRef(''); setDedRemarks(''); setSetlOpen(true);
  };
  const handleCreateSettlement = (lotId: string) => {
    const ev = lotEngineVoucher(lotId);
    if (!ev) return;
    const s = createFarmerSettlement({ engineVoucherId: ev.id });
    if (s.id) { setSetlId(s.id); setDedType(''); setDedAccId(''); setDedAmount(''); setDedRef(''); setDedRemarks(''); setSetlOpen(true); }
  };
  const onDedType = (id: string) => { setDedType(id); const t = DEDUCTION_TYPES.find(x => x.id === id); setDedAccId(t?.acc || ''); };
  const addLine = () => {
    const amt = Number(dedAmount);
    if (!dedType) { toast({ title: hi ? 'प्रकार चुनें' : 'Select type', variant: 'destructive' }); return; }
    if (!dedAccId) { toast({ title: hi ? 'खाता चुनें' : 'Select account', variant: 'destructive' }); return; }
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    const t = DEDUCTION_TYPES.find(x => x.id === dedType);
    addSettlementDeductionLine({ settlementId: setlId, deductionType: t ? (hi ? t.hi : t.en) : dedType, accountId: dedAccId, amount: amt, reference: dedRef.trim() || undefined, remarks: dedRemarks.trim() || undefined });
    setDedType(''); setDedAccId(''); setDedAmount(''); setDedRef(''); setDedRemarks('');
  };
  // M3b: one-click deduction from a rule — amount = rate% × gross, posted to the rule's dedicated account.
  const ruleAmount = (ratePct: number, gross: number) => Math.round((ratePct / 100 * gross + Number.EPSILON) * 100) / 100;
  const addRuleDeduction = (ruleId: string) => {
    const rule = deductionRules.find(r => r.id === ruleId);
    const s = procurementSettlements.find(x => x.id === setlId && !x.isDeleted);
    if (!rule || !s) return;
    if (!rule.accountId) { toast({ title: hi ? 'नियम में खाता नहीं' : 'Rule has no account', description: hi ? 'प्रोक्योरमेंट मास्टर → नियम में खाता जोड़ें।' : 'Add an account to the rule in Procurement Masters.', variant: 'destructive' }); return; }
    const amt = ruleAmount(rule.rate.value, s.gross.amount);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि शून्य' : 'Amount is zero', variant: 'destructive' }); return; }
    addSettlementDeductionLine({ settlementId: setlId, deductionType: (hi && rule.nameHi ? rule.nameHi : (rule.name || rule.code)), accountId: rule.accountId, amount: amt, reference: `${rule.rate.value}%` });
  };
  const approveSettlement = () => { if (setlId) approveFarmerSettlement({ settlementId: setlId }); };
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
    const lot = addProcurementLot({ farmerId, cropId, varietyId: varietyId || undefined, seasonId: seasonId || undefined, centreId: centreId || undefined, quantity: { value: q, unit: 'qtl' }, mspRate: { amount: r, currency: 'INR' } });
    if (lot.id) {
      toast({ title: hi ? 'प्रोक्योरमेंट लॉट बना' : 'Procurement Lot created', description: `${farmerLabel(farmerId)} · ${cropName(cropId)} · ${q} qtl` });
      setCropId(''); setVarietyId(''); setSeasonId(''); setCentreId(''); setQty(''); setRate(''); setMspAuto(false);
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
              <Label>{hi ? 'सीज़न' : 'Season'} <span className="text-muted-foreground text-xs">({hi ? 'वैकल्पिक' : 'optional'})</span></Label>
              <Select value={seasonId || '__none__'} onValueChange={v => setSeasonId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सीज़न चुनें' : 'Select season'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? '— कोई नहीं —' : '— none —'}</SelectItem>
                  {seasons.map(s => <SelectItem key={s.id} value={s.id}>{hi && s.nameHi ? s.nameHi : s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'खरीद केंद्र' : 'Procurement Centre'} <span className="text-muted-foreground text-xs">({hi ? 'वैकल्पिक' : 'optional'})</span></Label>
              <Select value={centreId || '__none__'} onValueChange={v => setCentreId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={hi ? 'केंद्र चुनें' : 'Select centre'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? '— कोई नहीं —' : '— none —'}</SelectItem>
                  {centres.map(c => <SelectItem key={c.id} value={c.id}>{centreLabel(c.id)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'फसल' : 'Crop'}</Label>
              <Select value={cropId} onValueChange={v => { setCropId(v); setVarietyId(''); }}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फसल चुनें' : 'Select crop'} /></SelectTrigger>
                <SelectContent>
                  {crops.map(c => <SelectItem key={c.id} value={c.id}>{hi && c.nameHi ? c.nameHi : c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {crops.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {hi ? 'कोई फसल नहीं। ' : 'No crops yet. '}
                  <Link to="/procurement-masters" className="text-primary underline">{hi ? 'प्रोक्योरमेंट मास्टर में जोड़ें' : 'Add in Procurement Masters'}</Link>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'किस्म' : 'Variety'}</Label>
              <Select value={varietyId || '__none__'} onValueChange={v => setVarietyId(v === '__none__' ? '' : v)} disabled={!cropId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'किस्म (वैकल्पिक)' : 'Variety (optional)'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? '— कोई नहीं —' : '— none —'}</SelectItem>
                  {cropVarieties.map(v => <SelectItem key={v.id} value={v.id}>{hi && v.nameHi ? v.nameHi : v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'मात्रा (क्विंटल)' : 'Quantity (qtl)'}</Label>
              <Input type="number" min={0} value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {hi ? 'MSP दर (₹/क्विंटल)' : 'MSP Rate (₹/qtl)'}
                {mspAuto && <Badge variant="secondary" className="text-[10px] font-normal">{hi ? 'ऑटो-भरा' : 'auto'}</Badge>}
              </Label>
              <Input type="number" min={0} value={rate} onChange={e => { setRate(e.target.value); setMspAuto(false); }} placeholder="0" />
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
                <div className="font-medium">{farmerLabel(l.farmerId)} · {cropName(l.cropId)}{l.varietyId ? ` (${varietyLabel(l.varietyId)})` : ''}</div>
                {(seasonLabel(l.seasonId) || centreLabel(l.centreId)) && (
                  <div className="text-xs text-muted-foreground">
                    {[centreLabel(l.centreId), seasonLabel(l.seasonId)].filter(Boolean).join(' · ')}
                  </div>
                )}
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
                {commissionForLot(l.id) && (
                  <div className="text-xs text-emerald-600 mt-0.5">
                    {hi ? 'कमीशन' : 'Commission'}: {money(commissionForLot(l.id)!.amount)} · {commissionForLot(l.id)!.voucherNo}
                  </div>
                )}
                {(() => {
                  const pi = payInfo(l.id);
                  const s = pi?.settlement;
                  if (!pi || !s) return null;
                  return (
                    <div className="text-xs mt-0.5">
                      <span className={s.status === 'approved' ? (pi.payStatus === 'paid' ? 'text-green-600' : 'text-amber-600') : 'text-blue-600'}>
                        {s.status === 'draft'
                          ? (hi ? '✎ निपटान ड्राफ्ट' : '✎ Settlement Draft')
                          : (hi ? `● निपटान ${s.settlementNo || '…'} (स्वीकृत)` : `● Settlement ${s.settlementNo || '…'} (Approved)`)}
                      </span>
                      {' · '}{hi ? 'सकल' : 'Gross'} {money(pi.gross)} · {hi ? 'कटौती' : 'Deductions'} {money(pi.totalDeductions)} · {hi ? 'निवल देय' : 'Net'} {money(pi.netPayable)}
                      {s.status === 'approved' ? ` · ${hi ? 'भुगतान' : 'Paid'} ${money(pi.paid)} · ${hi ? 'बकाया' : 'Outstanding'} ${money(pi.outstanding)}` : ''}
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary">{l.operationalStatus}</Badge>
                {!lotQuality(l.id) && <Button size="sm" variant="outline" onClick={() => openQuality(l.id)}>{hi ? 'क्वालिटी' : 'Quality'}</Button>}
                {!lotJForm(l.id) && <Button size="sm" variant="outline" onClick={() => handleGenerateJForm(l.id)}>J-Form</Button>}
                {lotJForm(l.id) && !lotIntent(l.id) && <Button size="sm" variant="outline" onClick={() => handleGenerateIntent(lotJForm(l.id)!.id)}>{hi ? 'इंटेंट' : 'Intent'}</Button>}
                {lotIntent(l.id) && !lotPostingRequest(l.id) && <Button size="sm" variant="outline" onClick={() => handleGeneratePostingRequest(lotIntent(l.id)!.id)}>{hi ? 'पोस्टिंग' : 'Posting Req'}</Button>}
                {lotPostingRequest(l.id) && !lotRuleResult(l.id) && <Button size="sm" variant="outline" onClick={() => handleResolve(lotPostingRequest(l.id)!.id)}>{hi ? 'रिज़ॉल्व' : 'Resolve'}</Button>}
                {lotRuleResult(l.id) && !lotEngineVoucher(l.id) && <Button size="sm" variant="outline" onClick={() => handlePost(lotRuleResult(l.id)!.id)}>{hi ? 'पोस्ट' : 'Post'}</Button>}
                {lotEngineVoucher(l.id) && !settlementForLot(l.id) && <Button size="sm" variant="outline" onClick={() => handleCreateSettlement(l.id)}>{hi ? 'निपटान बनाएँ' : 'Create Settlement'}</Button>}
                {settlementForLot(l.id)?.status === 'draft' && <Button size="sm" variant="outline" onClick={() => openSettlement(l.id)}>{hi ? 'निपटान प्रबंधन' : 'Manage Settlement'}</Button>}
                {settlementForLot(l.id)?.status === 'approved' && payInfo(l.id)!.outstanding > 0 && <Button size="sm" variant="ghost" onClick={() => openSettlement(l.id)}>{hi ? 'देखें' : 'View'}</Button>}
                {settlementForLot(l.id)?.status === 'approved' && payInfo(l.id)!.outstanding > 0 && <Button size="sm" variant="outline" onClick={() => openPay(l.id)}>{hi ? 'किसान को भुगतान' : 'Pay Farmer'}</Button>}
                {settlementForLot(l.id)?.status === 'approved' && payInfo(l.id)!.outstanding <= 0 && <span className="text-xs text-green-600 font-medium">{hi ? '✓ पूर्ण भुगतान' : '✓ Fully Paid'}</span>}
                {lotEngineVoucher(l.id) && !commissionForLot(l.id) && lotCommissionInfo(l) && (
                  <Button size="sm" variant="outline" onClick={() => { const ci = lotCommissionInfo(l); if (ci) accrueProcurementCommission({ lotId: l.id, amount: ci.amount, note: `${ci.rate}% · ${ci.agency.name}` }); }}>
                    {hi ? 'कमीशन' : 'Commission'} {money(lotCommissionInfo(l)!.amount)}
                  </Button>
                )}
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

      {/* Farmer Settlement dialog — build draft deduction lines, then approve (the accounting trigger) */}
      <Dialog open={setlOpen} onOpenChange={setSetlOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {hi ? 'किसान निपटान' : 'Farmer Settlement'}{currentSettlement?.settlementNo ? ` · ${currentSettlement.settlementNo}` : ''}
            </DialogTitle>
          </DialogHeader>
          {currentSettlement && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={currentSettlement.status === 'approved' ? 'default' : 'secondary'}>
                  {currentSettlement.status === 'approved' ? (hi ? 'स्वीकृत' : 'Approved') : (hi ? 'ड्राफ्ट' : 'Draft')}
                </Badge>
                <span className="text-muted-foreground">{hi ? 'सकल' : 'Gross'}: {money(currentSettlement.gross.amount)}</span>
              </div>

              <div className="space-y-1.5">
                <Label>{hi ? 'कटौतियाँ' : 'Deductions'}</Label>
                {currentSettlement.deductionLines.length === 0 && <p className="text-xs text-muted-foreground">{hi ? 'अभी कोई कटौती नहीं' : 'No deductions yet'}</p>}
                {currentSettlement.deductionLines.map(line => (
                  <div key={line.id} className="flex items-center justify-between text-sm rounded border p-2 gap-2">
                    <span className="min-w-0 truncate">{line.deductionType} · {line.accountId} · {money(line.amount.amount)}</span>
                    {currentSettlement.status === 'draft' && (
                      <Button size="sm" variant="ghost" className="shrink-0" onClick={() => removeSettlementDeductionLine({ settlementId: currentSettlement.id, lineId: line.id })}>{hi ? 'हटाएँ' : 'Remove'}</Button>
                    )}
                  </div>
                ))}
              </div>

              {currentSettlement.status === 'draft' && deductionRules.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{hi ? 'नियम से जोड़ें (दर% × सकल, अपने-आप)' : 'Add from a rule (rate% × gross, auto)'}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {deductionRules.map(r => (
                      <Button key={r.id} size="sm" variant="secondary" className="h-7 gap-1 text-xs font-normal" onClick={() => addRuleDeduction(r.id)}>
                        <Plus className="h-3 w-3" />{hi && r.nameHi ? r.nameHi : (r.name || r.code)} {r.rate.value}% · {money(ruleAmount(r.rate.value, currentSettlement.gross.amount))}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {currentSettlement.status === 'draft' && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{hi ? 'या हाथ से जोड़ें:' : 'Or add manually:'}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select value={dedType} onValueChange={onDedType}>
                      <SelectTrigger><SelectValue placeholder={hi ? 'प्रकार' : 'Type'} /></SelectTrigger>
                      <SelectContent>{DEDUCTION_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={dedAccId} onValueChange={setDedAccId}>
                      <SelectTrigger><SelectValue placeholder={hi ? 'खाता' : 'Account'} /></SelectTrigger>
                      <SelectContent>{postableAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.id} · {hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Input type="number" min={0} value={dedAmount} onChange={e => setDedAmount(e.target.value)} placeholder={hi ? 'राशि' : 'Amount'} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input value={dedRef} onChange={e => setDedRef(e.target.value)} placeholder={hi ? 'संदर्भ (वैकल्पिक)' : 'Reference (optional)'} />
                    <Input value={dedRemarks} onChange={e => setDedRemarks(e.target.value)} placeholder={hi ? 'टिप्पणी (वैकल्पिक)' : 'Remarks (optional)'} />
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={addLine}>{hi ? '+ कटौती जोड़ें' : '+ Add Deduction'}</Button>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm font-medium">
                <span>{hi ? 'निवल देय' : 'Net Payable'}</span>
                <span>{money(currentSettlement.netPayable.amount)}</span>
              </div>

              {currentSettlement.status === 'approved' && (
                <p className="text-xs text-muted-foreground">{hi ? 'स्वीकृत — अब "किसान को भुगतान" से निवल देय का निपटान करें। कटौतियाँ अब बदली नहीं जा सकतीं।' : 'Approved — use "Pay Farmer" to settle the net payable. Deductions are now locked.'}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetlOpen(false)}>{hi ? 'बंद करें' : 'Close'}</Button>
            {currentSettlement?.status === 'draft' && <Button onClick={approveSettlement}>{hi ? 'निपटान स्वीकृत करें' : 'Approve Settlement'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
