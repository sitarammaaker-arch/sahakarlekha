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
import { resolveProcurementAccountId, missingProcurementRoles, PROCUREMENT_ROLE_LABEL_HI } from '@/lib/procurement/accounts';
import { deriveLotStage, LOT_STAGE_LABEL, isRejectedQuality, suggestDeductionAccountId, deductionAccountWarning, DEDUCTION_WARNING_TEXT, canRecordQuality, agencyDirectAccounts, procurementLegsOf, commissionAmount, moistureLimitFor, qualityResultAllowed, deductionRuleAmount, deductionRuleLabel, netWeight, maskAccount, planBulkPayment, bulkBatchRef, FARMER_PAYMENT_REF_TYPE } from '@/lib/procurement/agentFlow';
import { jformSlipHTML, paymentSlipHTML, openPrint, type SlipParty } from '@/lib/procurement/print';
import { Wheat, Plus, AlertTriangle } from 'lucide-react';
import type { Voucher } from '@/types';

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

// MSP deduction types. The pre-selected account comes from suggestDeductionAccountId: a PAYABLE
// (liability) for money withheld for someone else (TDS / मंडी शुल्क / HRDF / हमाली), found in this
// society's chart by name — never an invented id. Otherwise the operator selects the account.
const DEDUCTION_TYPES = [
  { id: 'tds', en: 'TDS', hi: 'TDS' },
  { id: 'market_fee', en: 'Market Fee', hi: 'मंडी शुल्क' },
  { id: 'hrdf', en: 'HRDF', hi: 'HRDF' },
  { id: 'labour', en: 'Labour', hi: 'हमाली' },
  { id: 'weighment', en: 'Weighment', hi: 'तौल' },
  { id: 'bardana', en: 'Bardana', hi: 'बारदाना' },
  { id: 'transport', en: 'Transportation', hi: 'परिवहन' },
  { id: 'other', en: 'Other Recovery', hi: 'अन्य वसूली' },
];

export default function ProcurementLots() {
  const { vouchers, accounts, procurementFarmers, procurementLots, procurementQualityTests, procurementMoistureRecords, procurementJForms, procurementFinancialIntents, procurementPostingRequests, procurementPostingRuleResults, procurementSettlements, addFarmer, addProcurementLot, recordQualityInspection, generateJForm, generateFinancialIntent, generatePostingRequest, generatePostingRuleResult, generateEngineVoucher, createFarmerSettlement, addSettlementDeductionLine, removeSettlementDeductionLine, approveFarmerSettlement, recordFarmerPayment, cancelProcurementLot, updateFarmer, society } = useData();
  const { crops, varieties, seasons, agencies, centres, resolveMspRate, deductionRules, qualitySpecs, arhtiyas, accrueProcurementCommission, commissionAccruals, deleteCommissionAccrual } = useMarketingData();
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
  // D2a: arhtiya (register only) + weighment slip. When gross and tare are both filled, the net weight
  // becomes the lot quantity.
  const [arhtiyaId, setArhtiyaId] = useState('');
  const [grossW, setGrossW] = useState('');
  const [tareW, setTareW] = useState('');
  const [bags, setBags] = useState('');
  const onWeight = (g: string, t: string) => { setGrossW(g); setTareW(t); const n = netWeight(Number(g), Number(t)); if (n != null) setQty(String(n)); };
  const [rate, setRate] = useState('');
  // Batch B: the business date of the purchase (back-dating allowed within the open FY/period). Sticky.
  const [lotDate, setLotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mspAuto, setMspAuto] = useState(false);

  // Auto-fill the MSP rate from the effective rate master when crop + season are both chosen.
  // The operator can still edit the rate afterwards (manual override clears the "auto" hint).
  useEffect(() => {
    if (!cropId || !seasonId) { setMspAuto(false); return; }
    const r = resolveMspRate({ cropId, seasonId, date: lotDate || undefined });
    if (r != null) { setRate(String(r)); setMspAuto(true); } else { setMspAuto(false); }
  }, [cropId, seasonId, lotDate, resolveMspRate]);

  // Add-farmer dialog
  const [farmerOpen, setFarmerOpen] = useState(false);
  const [farmerName, setFarmerName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [mobile, setMobile] = useState('');
  // D2b: edit an existing farmer + bank / village / portal id.
  const [editFarmerId, setEditFarmerId] = useState<string | null>(null);
  const [fVillage, setFVillage] = useState('');
  const [fBankName, setFBankName] = useState('');
  const [fAccount, setFAccount] = useState('');
  const [fIfsc, setFIfsc] = useState('');
  const [fPortal, setFPortal] = useState('');
  const openAddFarmer = () => { setEditFarmerId(null); setFarmerName(''); setFatherName(''); setMobile(''); setFVillage(''); setFBankName(''); setFAccount(''); setFIfsc(''); setFPortal(''); setFarmerOpen(true); };
  const openEditFarmer = (id: string) => {
    const f = procurementFarmers.find(x => x.id === id); if (!f) return;
    setEditFarmerId(id); setFarmerName(f.farmerName); setFatherName(f.fatherName || ''); setMobile(f.mobile || ''); setFVillage(f.village || ''); setFBankName(f.bankName || ''); setFAccount(f.bankAccountNo || ''); setFIfsc(f.ifsc || ''); setFPortal(f.portalId || ''); setFarmerOpen(true);
  };

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
  const [payMode, setPayMode] = useState<'cash' | 'bank' | 'agency'>('cash');
  const [payBankId, setPayBankId] = useState('');
  const [payAgencyId, setPayAgencyId] = useState('');   // agency receivable (MSP Receivable) when the agency paid farmers directly
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
    if (c) return hi && c.nameHi ? (c.nameHi || c.name) : c.name;
    const legacy = LEGACY_CROPS[id];
    return legacy ? (hi ? (legacy.nameHi || legacy.name) : legacy.name) : id;
  };
  const varietyLabel = (id?: string) => {
    if (!id) return '';
    const v = varieties.find(x => x.id === id);
    return v ? (hi && v.nameHi ? (v.nameHi || v.name) : v.name) : id; // legacy lots stored free-text in varietyId
  };
  const cropVarieties = varieties.filter(v => v.cropId === cropId);
  const seasonLabel = (id?: string) => { const s = seasons.find(x => x.id === id); return s ? (hi && s.nameHi ? (s.nameHi || s.name) : s.name) : ''; };
  const centreLabel = (id?: string) => {
    const c = centres.find(x => x.id === id);
    if (!c) return '';
    const ag = agencies.find(a => a.id === c.agencyId);
    return `${hi && c.nameHi ? (c.nameHi || c.name) : c.name}${ag ? ` · ${ag.code || ag.name}` : ''}`;
  };
  const farmerLabel = (id: string) => { const f = procurementFarmers.find(x => x.id === id); return f ? `${f.farmerName} (${f.farmerCode})` : id; };
  const lotQuality = (lotId: string) => procurementQualityTests.find(q => q.lotId === lotId);
  const lotRejected = (lotId: string) => isRejectedQuality(lotQuality(lotId)?.result);
  const lotMoisture = (lotId: string) => procurementMoistureRecords.find(m => m.lotId === lotId);
  const resultLabel = (id: string) => { const r = QUALITY_RESULTS.find(x => x.id === id); return r ? (hi ? r.hi : r.en) : id; };
  const openQuality = (lotId: string) => { setQualityLotId(lotId); setQualityResult(''); setMoistureValue(''); setInspector(''); setQualityOpen(true); };
  const qualityLot = procurementLots.find(l => l.id === qualityLotId);
  const qualityLimit = qualityLot ? moistureLimitFor(qualitySpecs, qualityLot.cropId, qualityLot.seasonId) : null;
  const saveQuality = () => {
    const m = Number(moistureValue);
    if (!qualityResult) { toast({ title: hi ? 'परिणाम चुनें' : 'Select a result', variant: 'destructive' }); return; }
    if (moistureValue === '' || !(m >= 0)) { toast({ title: hi ? 'नमी मान दर्ज करें' : 'Enter a valid moisture value', variant: 'destructive' }); return; }
    // D1: the society's own Quality Spec (no state's limit is hard-coded) — above it, not plain "accepted".
    if (!qualityResultAllowed(qualityResult, m, qualityLimit)) {
      toast({ title: hi ? 'नमी सीमा से अधिक' : 'Moisture above the limit', description: hi ? `नमी ${m}% है, सीमा ${qualityLimit}% — "कटौती सहित स्वीकृत" या "अस्वीकृत" चुनें।` : `Moisture ${m}% exceeds ${qualityLimit}% — choose "accepted with cut" or "rejected".`, variant: 'destructive', duration: 10000 });
      return;
    }
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
  const lotPostingRequest = (lotId: string) => procurementPostingRequests.find(p => p.lotId === lotId);
  const lotRuleResult = (lotId: string) => procurementPostingRuleResults.find(r => r.lotId === lotId);
  // The engine Voucher is the authoritative record (origin='engine' + refType/refId → the result).
  const lotEngineVoucher = (lotId: string) => {
    const rr = lotRuleResult(lotId);
    return rr ? vouchers.find(v => !v.isDeleted && v.origin === 'engine' && v.refType === 'posting.rule.result' && v.refId === rr.id) : undefined;
  };
  // M2 hot-path: ONE click runs the whole financial pipeline Intent→PostingRequest→Resolve→Post.
  // Each step starts only once the server committed the previous one (onCommitted), so a later step
  // never references a row the server refused. Resume-safe: reuse any step already done. Each generator
  // toasts on failure and bails (empty id) — so a broken step stops the chain cleanly.
  const [postingLotId, setPostingLotId] = useState<string | null>(null);
  const handlePostToLedger = (lotId: string) => {
    const jf = lotJForm(lotId);
    if (!jf || postingLotId === lotId) return;
    setPostingLotId(lotId);
    const done = () => setPostingLotId(null);
    // D1 (founder): commission is accrued AUTOMATICALLY once the posting voucher is durably saved.
    const autoCommission = (ev: Voucher) => {
      const l = procurementLots.find(x => x.id === lotId);
      const ag = l ? lotAgency(l) : undefined;
      if (!l || !ag || !(Number(ag.commissionRate) > 0)) return;
      const amt = commissionAmount(ag, l, procurementLegsOf(ev).value);
      if (amt > 0) accrueProcurementCommission({ lotId, amount: amt, note: `${ag.commissionBasis === 'perQtl' ? `₹${ag.commissionRate}/qtl` : `${ag.commissionRate}%`} · ${ag.name}`, date: ev.date, agencyId: ag.id, quiet: true });
    };
    const post = (rrId: string) => { if (!lotEngineVoucher(lotId)) generateEngineVoucher({ postingRuleResultId: rrId }, { onSaved: autoCommission }); done(); };
    const lotRow = procurementLots.find(x => x.id === lotId);
    const receivableAccountId = (lotRow && lotAgency(lotRow)?.ledgerAccountId) || undefined;
    const resolve = (reqId: string) => {
      const rr = lotRuleResult(lotId);
      if (rr) return post(rr.id);
      if (!generatePostingRuleResult({ postingRequestId: reqId }, { onCommitted: r => post(r.id), onFailed: done, receivableAccountId })?.id) done();
    };
    const request = (intentId: string) => {
      const pr = lotPostingRequest(lotId);
      if (pr) return resolve(pr.id);
      if (!generatePostingRequest({ financialIntentId: intentId }, { onCommitted: p => resolve(p.id), onFailed: done })?.id) done();
    };
    const fi = lotIntent(lotId);
    if (fi) return request(fi.id);
    if (!generateFinancialIntent({ jformId: jf.id }, { onCommitted: i => request(i.id), onFailed: done })?.id) done();
  };
  // Farmer Payment — Payable/Paid/Outstanding are DERIVED from vouchers (no stored balance).
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));
  // "Agency paid directly" credits ONLY the agency receivable (3308, or a ledger opened under it) —
  // any other asset (cash, stock) bypassed the receivable and broke the per-agency balance.
  const mspReceivableId = resolveProcurementAccountId(accounts, 'agencyReceivable');
  const agencyAccounts = agencyDirectAccounts(accounts, mspReceivableId, agencies.map(a => a.ledgerAccountId));
  // MSP ledgers missing (PACS / sugar charts) → tell the operator where to create them, up front.
  const missingMsp = missingProcurementRoles(accounts, ['agencyReceivable', 'farmerPayable']);
  // Settlement is the SOURCE OF TRUTH — gross/deductions/net/paid read STORED fields, never vouchers.
  const settlementForLot = (lotId: string) => { const ev = lotEngineVoucher(lotId); return ev ? procurementSettlements.find(s => !s.isDeleted && s.engineVoucherId === ev.id) : undefined; };
  const currentSettlement = procurementSettlements.find(s => s.id === setlId && !s.isDeleted);
  const payInfo = (lotId: string) => {
    const ev = lotEngineVoucher(lotId);
    if (!ev) return null;
    const s = procurementSettlements.find(x => !x.isDeleted && x.engineVoucherId === ev.id);
    const value = procurementLegsOf(ev).value;
    if (!s) return { ev, settlement: null, gross: value, totalDeductions: 0, netPayable: value, paid: 0, outstanding: value, payStatus: 'unpaid' as const };
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
    const amount = commissionAmount(ag, l, procurementLegsOf(ev).value);
    return { agency: ag, rate: ag.commissionRate, perQtl: ag.commissionBasis === 'perQtl', amount };
  };
  const commissionNote = (ci: NonNullable<ReturnType<typeof lotCommissionInfo>>) => `${ci.perQtl ? `₹${ci.rate}/qtl` : `${ci.rate}%`} · ${ci.agency.name}`;
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
  const onDedType = (id: string) => { setDedType(id); setDedAccId(suggestDeductionAccountId(id, accounts) || ''); };
  const dedWarning = deductionAccountWarning(dedType, accounts.find(a => a.id === dedAccId));
  const ruleWarning = (r: (typeof deductionRules)[number]) => deductionAccountWarning(r.basis, accounts.find(a => a.id === r.accountId));
  const addLine = () => {
    const amt = Number(dedAmount);
    if (!dedType) { toast({ title: hi ? 'प्रकार चुनें' : 'Select type', variant: 'destructive' }); return; }
    if (!dedAccId) { toast({ title: hi ? 'खाता चुनें' : 'Select account', variant: 'destructive' }); return; }
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    const t = DEDUCTION_TYPES.find(x => x.id === dedType);
    addSettlementDeductionLine({ settlementId: setlId, deductionType: t ? (hi ? t.hi : t.en) : dedType, accountId: dedAccId, amount: amt, reference: dedRef.trim() || undefined, remarks: dedRemarks.trim() || undefined });
    setDedType(''); setDedAccId(''); setDedAmount(''); setDedRef(''); setDedRemarks('');
  };
  // M3b/D2a: one-click deduction from a rule — % of gross, ₹ per quintal or ₹ per bag (the lot's own
  // quantity / bag count), posted to the rule's dedicated account.
  const lotOfSettlement = (st?: { engineVoucherId: string }) => st ? procurementLots.find(l => lotEngineVoucher(l.id)?.id === st.engineVoucherId) : undefined;
  const ruleAmountFor = (rule: (typeof deductionRules)[number], st: { gross: { amount: number }; engineVoucherId: string }) => {
    const l = lotOfSettlement(st);
    return deductionRuleAmount(rule, { gross: st.gross.amount, qty: l?.quantity?.value, bags: l?.bags });
  };
  const addRuleDeduction = (ruleId: string) => {
    const rule = deductionRules.find(r => r.id === ruleId);
    const s = procurementSettlements.find(x => x.id === setlId && !x.isDeleted);
    if (!rule || !s) return;
    if (!rule.accountId) { toast({ title: hi ? 'नियम में खाता नहीं' : 'Rule has no account', description: hi ? 'प्रोक्योरमेंट मास्टर → नियम में खाता जोड़ें।' : 'Add an account to the rule in Procurement Masters.', variant: 'destructive' }); return; }
    const amt = ruleAmountFor(rule, s);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि शून्य' : 'Amount is zero', description: rule.basisUnit === 'perBag' ? (hi ? 'इस लॉट में बोरी संख्या दर्ज नहीं है।' : 'This lot has no bag count.') : undefined, variant: 'destructive' }); return; }
    addSettlementDeductionLine({ settlementId: setlId, deductionType: (hi && rule.nameHi ? rule.nameHi : (rule.name || rule.code)), accountId: rule.accountId, amount: amt, reference: deductionRuleLabel(rule) });
  };
  const approveSettlement = () => { if (setlId) approveFarmerSettlement({ settlementId: setlId }); };
  const openPay = (lotId: string) => {
    const info = payInfo(lotId);
    if (!info) return;
    setPayEvId(info.ev.id); setPayOutstanding(info.outstanding);
    setPayAmount(String(info.outstanding)); setPayDate(new Date().toISOString().split('T')[0]);
    setPayMode('cash'); setPayBankId(bankAccounts[0]?.id || ''); setPayAgencyId(agencyAccounts[0]?.id || ''); setPayRef(''); setPayRemarks('');
    setPayOpen(true);
  };
  const savePay = () => {
    const amt = Number(payAmount);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    if (amt > payOutstanding) { toast({ title: hi ? 'राशि बकाया से अधिक' : 'Exceeds outstanding', description: `${hi ? 'बकाया' : 'Outstanding'} ${money(payOutstanding)}`, variant: 'destructive' }); return; }
    const v = recordFarmerPayment({ engineVoucherId: payEvId, amount: amt, mode: payMode, bankAccountId: payMode === 'bank' ? (payBankId || undefined) : undefined, agencyAccountId: payMode === 'agency' ? (payAgencyId || undefined) : undefined, paymentDate: payDate, reference: payRef.trim() || undefined, remarks: payRemarks.trim() || undefined });
    if (v.id) { const modeLabel = payMode === 'cash' ? (hi ? 'नकद' : 'Cash') : payMode === 'bank' ? (hi ? 'बैंक' : 'Bank') : (hi ? 'एजेंसी सीधे' : 'Agency direct'); toast({ title: hi ? 'भुगतान दर्ज हुआ' : 'Payment recorded', description: `${money(amt)} · ${modeLabel}` }); setPayOpen(false); }
  };

  const [farmerSaving, setFarmerSaving] = useState(false);
  const saveFarmer = async () => {
    if (!farmerName.trim()) { toast({ title: hi ? 'किसान का नाम आवश्यक है' : 'Farmer name is required', variant: 'destructive' }); return; }
    if (farmerSaving) return;
    const extra = { village: fVillage.trim() || undefined, bankName: fBankName.trim() || undefined, bankAccountNo: fAccount.trim() || undefined, ifsc: fIfsc.trim() || undefined, portalId: fPortal.trim() || undefined };
    if (editFarmerId) {
      updateFarmer(editFarmerId, { farmerName: farmerName.trim(), fatherName: fatherName.trim() || undefined, mobile: mobile.trim() || undefined, ...extra });
      setFarmerOpen(false);
      return;
    }
    setFarmerSaving(true);
    try {
      // The farmer code is issued by the server (unique across devices), so this waits for it.
      const f = await addFarmer({ farmerName: farmerName.trim(), fatherName: fatherName.trim() || undefined, mobile: mobile.trim() || undefined, ...extra });
      if (!f.id) return;   // addFarmer already showed why (FY lock / no code) — keep the dialog open
      setFarmerId(f.id);
      toast({ title: hi ? 'किसान जोड़ा गया' : 'Farmer added', description: `${f.farmerName} (${f.farmerCode})` });
      setFarmerName(''); setFatherName(''); setMobile(''); setFarmerOpen(false);
    } finally {
      setFarmerSaving(false);
    }
  };

  const saveLot = () => {
    const q = Number(qty), r = Number(rate);
    if (!farmerId) { toast({ title: hi ? 'किसान चुनें' : 'Select a farmer', variant: 'destructive' }); return; }
    if (!cropId) { toast({ title: hi ? 'फसल चुनें' : 'Select a crop', variant: 'destructive' }); return; }
    if (!(q > 0)) { toast({ title: hi ? 'मात्रा दर्ज करें' : 'Enter a valid quantity', variant: 'destructive' }); return; }
    if (!(r > 0)) { toast({ title: hi ? 'MSP दर दर्ज करें' : 'Enter a valid MSP rate', variant: 'destructive' }); return; }
    if ((grossW || tareW) && netWeight(Number(grossW), Number(tareW)) == null) { toast({ title: hi ? 'तौल ठीक करें' : 'Check the weighment', description: hi ? 'कुल वज़न खाली-बोरी (tare) से अधिक होना चाहिए।' : 'Gross must exceed tare.', variant: 'destructive' }); return; }
    const lot = addProcurementLot({ farmerId, cropId, varietyId: varietyId || undefined, seasonId: seasonId || undefined, centreId: centreId || undefined, quantity: { value: q, unit: 'qtl' }, mspRate: { amount: r, currency: 'INR' }, lotDate: lotDate || undefined,
      arhtiyaId: arhtiyaId || undefined, grossWeight: grossW ? Number(grossW) : undefined, tareWeight: tareW ? Number(tareW) : undefined, bags: bags ? Number(bags) : undefined });
    if (lot.id) {
      toast({ title: hi ? 'प्रोक्योरमेंट लॉट बना' : 'Procurement Lot created', description: `${farmerLabel(farmerId)} · ${cropName(cropId)} · ${q} qtl` });
      // Hot-path: keep season + centre sticky (same for the day's procurement at a centre); reset the rest.
      setFarmerId(''); setCropId(''); setVarietyId(''); setQty(''); setRate(''); setMspAuto(false); setGrossW(''); setTareW(''); setBags('');
    }
  };

  // Batch B: cancel a lot — reverses its posting and cancels its settlement / commission. Refused while
  // money has moved (farmer paid, agency or commission money received); the toast says what to undo.
  const [cancellingLotId, setCancellingLotId] = useState<string | null>(null);
  const handleCancelLot = async (lotId: string) => {
    const posted = !!lotEngineVoucher(lotId);
    const reason = window.prompt(hi
      ? `यह लॉट रद्द करें?${posted ? ' इसकी बहीखाता पोस्टिंग का उल्टा (reversal) वाउचर बनेगा, और निपटान व कमीशन रद्द होंगे।' : ''}\nकारण लिखें:`
      : `Cancel this lot?${posted ? ' Its posting is reversed and its settlement / commission cancelled.' : ''}\nReason:`);
    if (reason == null) return;
    setCancellingLotId(lotId);
    try { await cancelProcurementLot({ lotId, reason }); } finally { setCancellingLotId(null); }
  };

  // ── D2b: prints ──
  const slipParty = (farmerId2: string): SlipParty => {
    const f = procurementFarmers.find(x => x.id === farmerId2);
    return f ? { name: f.farmerName, code: f.farmerCode, fatherName: f.fatherName, village: f.village, mobile: f.mobile, bankName: f.bankName, bankAccountMasked: maskAccount(f.bankAccountNo), ifsc: f.ifsc, portalId: f.portalId } : { name: farmerId2 };
  };
  const popupBlocked = () => toast({ title: hi ? 'प्रिंट विंडो नहीं खुली' : 'Print window blocked', description: hi ? 'ब्राउज़र में इस साइट के pop-up की अनुमति दें।' : 'Allow pop-ups for this site.', variant: 'destructive' });
  const printJForm = (lotId: string) => {
    const l = procurementLots.find(x => x.id === lotId); const jf = lotJForm(lotId); if (!l || !jf) return;
    const ev = lotEngineVoucher(lotId); const q = lotQuality(lotId); const ag = lotAgency(l);
    const ok = openPrint(jformSlipHTML({
      hi, societyName: (hi && society.nameHi) ? society.nameHi : society.name, documentNo: jf.documentNo, date: l.lotDate || ev?.date || jf.createdAt.slice(0, 10),
      farmer: slipParty(l.farmerId), crop: cropName(l.cropId), variety: l.varietyId ? varietyLabel(l.varietyId) : undefined,
      season: seasonLabel(l.seasonId) || undefined, centre: centreLabel(l.centreId) || undefined, agency: ag ? (hi && ag.nameHi ? ag.nameHi : ag.name) : undefined,
      arhtiya: l.arhtiyaId ? arhtiyas.find(a => a.id === l.arhtiyaId)?.name : undefined,
      grossWeight: l.grossWeight, tareWeight: l.tareWeight, bags: l.bags, quantity: l.quantity?.value || 0, rate: l.mspRate?.amount || 0, value: jf.net.amount,
      moisture: lotMoisture(lotId)?.moisture.value, quality: q ? resultLabel(q.result) : undefined,
    }));
    if (!ok) popupBlocked();
  };
  const printPaymentSlip = (lotId: string) => {
    const l = procurementLots.find(x => x.id === lotId); const info = payInfo(lotId); if (!l || !info?.settlement) return;
    const s2 = info.settlement;
    const pays = vouchers.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected' && v.refType === FARMER_PAYMENT_REF_TYPE && v.refId === info.ev.id)
      .map(v => ({ date: v.date, voucherNo: v.voucherNo, amount: v.amount, mode: accounts.find(a => a.id === (v.lines?.find(x => x.type === 'Cr')?.accountId || v.creditAccountId))?.name, reference: (v.narration.match(/Ref ([^·]+)/)?.[1] || '').trim() || undefined }));
    const ok = openPrint(paymentSlipHTML({
      hi, societyName: (hi && society.nameHi) ? society.nameHi : society.name, farmer: slipParty(l.farmerId), settlementNo: s2.settlementNo, jformNo: lotJForm(lotId)?.documentNo,
      gross: s2.gross.amount, deductions: s2.deductionLines.map(d => ({ label: d.deductionType, amount: d.amount.amount })), netPayable: s2.netPayable.amount,
      payments: pays, outstanding: info.outstanding,
    }));
    if (!ok) popupBlocked();
  };

  // ── D2b: bulk payment — one payment voucher PER farmer, one shared batch reference (founder) ──
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSel, setBulkSel] = useState<Record<string, boolean>>({});
  const [bulkMode, setBulkMode] = useState<'bank' | 'cash' | 'agency'>('bank');
  const [bulkBank, setBulkBank] = useState('');
  const [bulkDate, setBulkDate] = useState('');
  const [bulkRef, setBulkRef] = useState('');
  const payableLots = procurementLots.filter(l => !l.cancelledAt && settlementForLot(l.id)?.status === 'approved' && (payInfo(l.id)?.outstanding ?? 0) > 0.005);
  const openBulk = () => {
    const sel: Record<string, boolean> = {}; for (const l of payableLots) sel[l.id] = true;
    setBulkSel(sel); setBulkMode('bank'); setBulkBank(bankAccounts[0]?.id || ''); setBulkDate(new Date().toISOString().slice(0, 10)); setBulkRef(bulkBatchRef()); setBulkOpen(true);
  };
  const bulkRows = payableLots.filter(l => bulkSel[l.id]).map(l => ({ lotId: l.id, engineVoucherId: payInfo(l.id)!.ev.id, outstanding: payInfo(l.id)!.outstanding }));
  const bulkPlan = planBulkPayment(bulkRows);
  const runBulk = () => {
    if (!bulkRef.trim()) { toast({ title: hi ? 'batch संदर्भ डालें' : 'Enter a batch reference', variant: 'destructive' }); return; }
    if (bulkMode === 'bank' && !bulkBank) { toast({ title: hi ? 'बैंक खाता चुनें' : 'Select a bank account', variant: 'destructive' }); return; }
    if (bulkMode === 'agency' && !agencyAccounts[0]) { toast({ title: hi ? 'एजेंसी प्राप्य खाता नहीं' : 'No agency receivable', variant: 'destructive' }); return; }
    let done = 0;
    for (const r of bulkPlan.pay) {
      const lot = procurementLots.find(x => x.id === (bulkRows.find(b => b.engineVoucherId === r.engineVoucherId)?.lotId));
      const agencyAcc = lot ? (lotAgency(lot)?.ledgerAccountId || agencyAccounts[0]?.id) : agencyAccounts[0]?.id;
      const v = recordFarmerPayment({ engineVoucherId: r.engineVoucherId, amount: r.outstanding, mode: bulkMode, bankAccountId: bulkMode === 'bank' ? bulkBank : undefined, agencyAccountId: bulkMode === 'agency' ? agencyAcc : undefined, paymentDate: bulkDate, reference: bulkRef.trim(), remarks: hi ? 'एक साथ भुगतान' : 'Bulk payment' });
      if (v.id) done++;
    }
    toast({ title: hi ? `${done} किसानों का भुगतान दर्ज` : `${done} farmer payments recorded`, description: `${bulkRef.trim()} · ${money(bulkPlan.total)}${done < bulkPlan.pay.length ? (hi ? ` — ${bulkPlan.pay.length - done} नहीं हुए (ऊपर की चेतावनी देखें)` : ` — ${bulkPlan.pay.length - done} failed (see warnings)`) : ''}` });
    setBulkOpen(false);
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

      {missingMsp.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            {hi
              ? <>इस समिति के चार्ट में <b>{missingMsp.map(r => PROCUREMENT_ROLE_LABEL_HI[r]).join(' और ')}</b> खाता नहीं है, इसलिए लॉट बहीखाते में पोस्ट नहीं होगा। <Link to="/ledger-hygiene" className="underline font-medium">लेजर स्वच्छता</Link> पेज पर “डोमेन खाते बनाएँ” दबाएँ।</>
              : <>This society's chart has no MSP Receivable / MSP Payable ledger, so lots cannot be posted. Open <Link to="/ledger-hygiene" className="underline font-medium">Ledger Hygiene</Link> and click “Create domain accounts”.</>}
          </div>
        </div>
      )}

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
              {farmerId && <Button variant="outline" onClick={() => openEditFarmer(farmerId)}>{hi ? 'संपादित' : 'Edit'}</Button>}
              <Button variant="outline" onClick={openAddFarmer} className="gap-1"><Plus className="h-4 w-4" />{hi ? 'किसान जोड़ें' : 'Add Farmer'}</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'सीज़न' : 'Season'} <span className="text-muted-foreground text-xs">({hi ? 'वैकल्पिक' : 'optional'})</span></Label>
              <Select value={seasonId || '__none__'} onValueChange={v => setSeasonId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सीज़न चुनें' : 'Select season'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? '— कोई नहीं —' : '— none —'}</SelectItem>
                  {seasons.map(s => <SelectItem key={s.id} value={s.id}>{hi && s.nameHi ? (s.nameHi || s.name) : s.name}</SelectItem>)}
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
              <Label>{hi ? 'खरीद की तारीख' : 'Purchase date'}</Label>
              <Input type="date" value={lotDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setLotDate(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{hi ? 'J-Form और बहीखाते की पोस्टिंग इसी तारीख की होगी।' : 'The J-Form posting is dated with this day.'}</p>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'फसल' : 'Crop'}</Label>
              <Select value={cropId} onValueChange={v => { setCropId(v); setVarietyId(''); }}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फसल चुनें' : 'Select crop'} /></SelectTrigger>
                <SelectContent>
                  {crops.map(c => <SelectItem key={c.id} value={c.id}>{hi && c.nameHi ? (c.nameHi || c.name) : c.name}</SelectItem>)}
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
                  {cropVarieties.map(v => <SelectItem key={v.id} value={v.id}>{hi && v.nameHi ? (v.nameHi || v.name) : v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'आढ़ती (वैकल्पिक)' : 'Arhtiya (optional)'}</Label>
              <Select value={arhtiyaId || '__none__'} onValueChange={v => setArhtiyaId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? '— सीधे किसान से —' : '— direct from farmer —'}</SelectItem>
                  {arhtiyas.map(a => <SelectItem key={a.id} value={a.id}>{hi && a.nameHi ? a.nameHi : a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'तौल पर्ची (क्विंटल) · बोरी' : 'Weighment (qtl) · bags'}</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" min={0} step="0.001" value={grossW} onChange={e => onWeight(e.target.value, tareW)} placeholder={hi ? 'कुल' : 'Gross'} />
                <Input type="number" min={0} step="0.001" value={tareW} onChange={e => onWeight(grossW, e.target.value)} placeholder={hi ? 'खाली बोरी' : 'Tare'} />
                <Input type="number" min={0} step="1" value={bags} onChange={e => setBags(e.target.value)} placeholder={hi ? 'बोरी' : 'Bags'} />
              </div>
              <p className="text-[11px] text-muted-foreground">{hi ? 'कुल और खाली-बोरी भरने पर शुद्ध वज़न अपने-आप मात्रा में आ जाएगा।' : 'Gross − tare fills the quantity.'}</p>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'मात्रा (क्विंटल)' : 'Quantity (qtl)'}</Label>
              <Input type="number" min={0} value={qty} onChange={e => setQty(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveLot(); }} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {hi ? 'MSP दर (₹/क्विंटल)' : 'MSP Rate (₹/qtl)'}
                {mspAuto && <Badge variant="secondary" className="text-[10px] font-normal">{hi ? 'ऑटो-भरा' : 'auto'}</Badge>}
              </Label>
              <Input type="number" min={0} value={rate} onChange={e => { setRate(e.target.value); setMspAuto(false); }} onKeyDown={e => { if (e.key === 'Enter') saveLot(); }} placeholder="0" />
            </div>
          </div>

          <Button onClick={saveLot} className="w-full">{hi ? 'लॉट सेव करें' : 'Save Lot'}</Button>
        </CardContent>
      </Card>

      {/* Lot list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{hi ? 'बने हुए लॉट' : 'Created Lots'} ({lots.length})</CardTitle>
          {payableLots.length > 0 && <Button size="sm" variant="outline" onClick={openBulk}>{hi ? `एक साथ भुगतान (${payableLots.length})` : `Bulk payment (${payableLots.length})`}</Button>}
        </CardHeader>
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
                  {l.lotDate ? `${l.lotDate} · ` : ''}{l.quantity?.value ?? 0} {l.quantity?.unit ?? 'qtl'}{l.bags ? ` (${l.bags} ${hi ? 'बोरी' : 'bags'})` : ''} · ₹{l.mspRate?.amount ?? 0}/{hi ? 'क्विंटल' : 'qtl'}{l.arhtiyaId ? ` · ${hi ? 'आढ़ती' : 'arhtiya'}: ${(arhtiyas.find(a => a.id === l.arhtiyaId)?.name) || '—'}` : ''}
                </div>
                {l.cancelledAt && (
                  <div className="text-xs text-red-600 mt-0.5">
                    {hi ? 'रद्द' : 'Cancelled'}: {l.cancelledAt.slice(0, 10)}{l.cancelledBy ? ` · ${l.cancelledBy}` : ''}{l.cancelReason ? ` · ${l.cancelReason}` : ''}
                  </div>
                )}
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
                {lotEngineVoucher(l.id) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hi ? 'वाउचर' : 'Voucher'}: {lotEngineVoucher(l.id)!.voucherNo}
                  </div>
                )}
                {commissionForLot(l.id) && (
                  <div className="text-xs text-emerald-600 mt-0.5">
                    {hi ? 'कमीशन' : 'Commission'}: {money(commissionForLot(l.id)!.amount)} · {commissionForLot(l.id)!.voucherNo}
                    {' · '}
                    <button type="button" className="underline text-destructive" onClick={() => { const c = commissionForLot(l.id)!; if (window.confirm(hi ? `कमीशन ${c.voucherNo} (${money(c.amount)}) रद्द करें?` : `Cancel commission ${c.voucherNo} (${money(c.amount)})?`)) deleteCommissionAccrual(c.id); }}>{hi ? 'रद्द करें' : 'Cancel'}</button>
                  </div>
                )}
                {lotRejected(l.id) && (
                  <div className="text-xs text-red-600 mt-0.5">
                    {hi ? 'क्वालिटी में अस्वीकृत — J-Form, पोस्टिंग, निपटान और भुगतान बंद।' : 'Rejected in quality — no J-Form, posting, settlement or payment.'}
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
                {(() => {
                  const st = deriveLotStage({ cancelled: !!l.cancelledAt, qualityResult: lotQuality(l.id)?.result, hasJForm: !!lotJForm(l.id), hasPosting: !!lotEngineVoucher(l.id), settlementStatus: settlementForLot(l.id)?.status, outstanding: payInfo(l.id)?.outstanding });
                  return <Badge variant={st === 'rejected' || st === 'cancelled' ? 'destructive' : 'secondary'}>{hi ? LOT_STAGE_LABEL[st].hi : LOT_STAGE_LABEL[st].en}</Badge>;
                })()}
                {!l.cancelledAt && canRecordQuality({ hasQualityTest: !!lotQuality(l.id), hasJForm: !!lotJForm(l.id) }) && <Button size="sm" variant="outline" onClick={() => openQuality(l.id)}>{hi ? 'क्वालिटी' : 'Quality'}</Button>}
                {!lotRejected(l.id) && !l.cancelledAt && <>
                {!lotJForm(l.id) && lotQuality(l.id) && <Button size="sm" variant="outline" onClick={() => handleGenerateJForm(l.id)}>J-Form</Button>}
                {lotJForm(l.id) && !lotEngineVoucher(l.id) && <Button size="sm" disabled={postingLotId === l.id} onClick={() => handlePostToLedger(l.id)}>{postingLotId === l.id ? (hi ? 'पोस्ट हो रहा है…' : 'Posting…') : (hi ? 'बहीखाता में पोस्ट' : 'Post to Ledger')}</Button>}
                {lotEngineVoucher(l.id) && !settlementForLot(l.id) && <Button size="sm" variant="outline" onClick={() => handleCreateSettlement(l.id)}>{hi ? 'निपटान बनाएँ' : 'Create Settlement'}</Button>}
                {settlementForLot(l.id)?.status === 'draft' && <Button size="sm" variant="outline" onClick={() => openSettlement(l.id)}>{hi ? 'निपटान प्रबंधन' : 'Manage Settlement'}</Button>}
                {settlementForLot(l.id)?.status === 'approved' && payInfo(l.id)!.outstanding > 0 && <Button size="sm" variant="ghost" onClick={() => openSettlement(l.id)}>{hi ? 'देखें' : 'View'}</Button>}
                {settlementForLot(l.id)?.status === 'approved' && payInfo(l.id)!.outstanding > 0 && <Button size="sm" variant="outline" onClick={() => openPay(l.id)}>{hi ? 'किसान को भुगतान' : 'Pay Farmer'}</Button>}
                {settlementForLot(l.id)?.status === 'approved' && payInfo(l.id)!.outstanding <= 0 && <span className="text-xs text-green-600 font-medium">{hi ? '✓ पूर्ण भुगतान' : '✓ Fully Paid'}</span>}
                {lotJForm(l.id) && <Button size="sm" variant="ghost" onClick={() => printJForm(l.id)}>{hi ? 'J-Form प्रिंट' : 'Print J-Form'}</Button>}
                {settlementForLot(l.id)?.status === 'approved' && <Button size="sm" variant="ghost" onClick={() => printPaymentSlip(l.id)}>{hi ? 'भुगतान पर्ची' : 'Payment slip'}</Button>}
                </>}
                {!lotRejected(l.id) && !l.cancelledAt && lotEngineVoucher(l.id) && !commissionForLot(l.id) && lotCommissionInfo(l) && (
                  // Manual click by design (founder decision pending: automate on posting?). Dated with
                  // the lot's posting (J-Form) day, not today.
                  <Button size="sm" variant="outline" onClick={() => { const ci = lotCommissionInfo(l); const ev = lotEngineVoucher(l.id); if (ci) accrueProcurementCommission({ lotId: l.id, amount: ci.amount, note: commissionNote(ci), date: ev?.date, agencyId: ci.agency.id }); }}>
                    {hi ? 'कमीशन' : 'Commission'} {money(lotCommissionInfo(l)!.amount)}
                  </Button>
                )}
                {!l.cancelledAt && (
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={cancellingLotId === l.id} onClick={() => handleCancelLot(l.id)}>
                    {cancellingLotId === l.id ? (hi ? 'रद्द हो रहा है…' : 'Cancelling…') : (hi ? 'रद्द करें' : 'Cancel lot')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* D2b: bulk payment dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{hi ? 'एक साथ भुगतान' : 'Bulk Payment'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="max-h-60 overflow-y-auto rounded border divide-y">
              {payableLots.map(l => (
                <label key={l.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                  <span className="flex items-center gap-2"><input type="checkbox" checked={!!bulkSel[l.id]} onChange={e => setBulkSel(p => ({ ...p, [l.id]: e.target.checked }))} />{farmerLabel(l.farmerId)}{procurementFarmers.find(f => f.id === l.farmerId)?.bankAccountNo ? '' : <span className="text-xs text-amber-600">{hi ? ' · बैंक विवरण नहीं' : ' · no bank details'}</span>}</span>
                  <span className="tabular-nums">{money(payInfo(l.id)!.outstanding)}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{hi ? 'माध्यम' : 'Mode'}</Label>
                <Select value={bulkMode} onValueChange={v => setBulkMode(v as 'bank' | 'cash' | 'agency')}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem><SelectItem value="agency">{hi ? 'एजेंसी ने सीधे भुगतान किया' : 'Agency paid directly'}</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>{hi ? 'तारीख' : 'Date'}</Label><Input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} /></div>
              {bulkMode === 'bank' && <div className="space-y-1 col-span-2"><Label>{hi ? 'बैंक खाता' : 'Bank account'}</Label>
                <Select value={bulkBank} onValueChange={setBulkBank}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : a.name}</SelectItem>)}</SelectContent></Select></div>}
              <div className="space-y-1 col-span-2"><Label>{hi ? 'batch संदर्भ / UTR' : 'Batch ref / UTR'}</Label><Input value={bulkRef} onChange={e => setBulkRef(e.target.value)} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground">{hi ? 'हर किसान का अलग भुगतान वाउचर बनेगा (उसके निपटान से जुड़ा), सब पर यही batch संदर्भ — बैंक मिलान में इसी से जोड़ें।' : "One payment voucher per farmer (linked to their settlement), all with this batch reference — match the bank line with it."}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={runBulk} disabled={bulkPlan.pay.length === 0}>{hi ? `${bulkPlan.pay.length} किसान · ${money(bulkPlan.total)} भुगतान करें` : `Pay ${bulkPlan.pay.length} · ${money(bulkPlan.total)}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add-farmer dialog */}
      <Dialog open={farmerOpen} onOpenChange={setFarmerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editFarmerId ? (hi ? 'किसान संपादित करें' : 'Edit Farmer') : (hi ? 'नया किसान' : 'Add Farmer')}</DialogTitle></DialogHeader>
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{hi ? 'गाँव' : 'Village'}</Label><Input value={fVillage} onChange={e => setFVillage(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'पोर्टल पंजीकरण ID' : 'Portal registration ID'}</Label><Input value={fPortal} onChange={e => setFPortal(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>{hi ? 'बैंक का नाम' : 'Bank name'}</Label><Input value={fBankName} onChange={e => setFBankName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{hi ? 'खाता नंबर' : 'Account no.'}</Label><Input inputMode="numeric" value={fAccount} onChange={e => setFAccount(e.target.value.replace(/\D/g, ''))} maxLength={18} /></div>
              <div className="space-y-1.5"><Label>IFSC</Label><Input value={fIfsc} onChange={e => setFIfsc(e.target.value.toUpperCase())} maxLength={11} placeholder="SBIN0001234" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFarmerOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveFarmer} disabled={farmerSaving}>{farmerSaving ? (hi ? 'जोड़ रहे हैं…' : 'Adding…') : editFarmerId ? (hi ? 'सेव करें' : 'Save') : (hi ? 'जोड़ें' : 'Add')}</Button>
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
              <Label>{hi ? 'नमी (%)' : 'Moisture (%)'} *{qualityLimit != null ? <span className="font-normal text-muted-foreground"> · {hi ? 'सीमा' : 'limit'} {qualityLimit}%</span> : null}</Label>
              <Input type="number" min={0} value={moistureValue} onChange={e => setMoistureValue(e.target.value)} placeholder="0" />
              {qualityLimit != null && Number(moistureValue) > qualityLimit && <p className="text-xs text-red-600">{hi ? 'नमी सीमा से अधिक — "कटौती सहित स्वीकृत" या "अस्वीकृत" चुनें।' : 'Above the limit — choose "accepted with cut" or "rejected".'}</p>}
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
              <Select value={payMode} onValueChange={v => setPayMode(v as 'cash' | 'bank' | 'agency')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                  <SelectItem value="agency">{hi ? 'एजेंसी ने सीधे भुगतान किया' : 'Agency paid directly'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMode === 'bank' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={payBankId} onValueChange={setPayBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {payMode === 'agency' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'एजेंसी प्राप्य खाता (MSP Receivable)' : 'Agency receivable (MSP Receivable)'}</Label>
                <Select value={payAgencyId} onValueChange={setPayAgencyId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{agencyAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : a.name}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{hi ? 'नकद/बैंक नहीं घटेगा — एजेंसी का प्राप्य घटेगा (एजेंसी ने किसानों को सीधे भुगतान किया)।' : 'Cash/bank untouched — the agency’s receivable is reduced (it paid the farmers directly).'}</p>
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
                        <Plus className="h-3 w-3" />{hi && r.nameHi ? r.nameHi : (r.name || r.code)} {deductionRuleLabel(r)} · {money(ruleAmountFor(r, currentSettlement))}
                        {ruleWarning(r) && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                      </Button>
                    ))}
                  </div>
                  {deductionRules.some(r => ruleWarning(r) === 'income_for_third_party') && (
                    <p className="text-[11px] text-amber-700">
                      {hi
                        ? '⚠ निशान वाले नियम कटौती को आय खाते में डालते हैं। किसान से किसी और के लिए काटी गई राशि देनदारी है — प्रोक्योरमेंट मास्टर में नियम का खाता बदलें।'
                        : '⚠ Marked rules credit an income account. Money withheld for someone else is a liability — change the rule\'s account in Procurement Masters.'}
                    </p>
                  )}
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
                      <SelectContent>{postableAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.id} · {hi ? (a.nameHi || a.name) : a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {dedWarning && <p className="text-[11px] text-amber-700">{hi ? DEDUCTION_WARNING_TEXT[dedWarning].hi : DEDUCTION_WARNING_TEXT[dedWarning].en}</p>}
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
