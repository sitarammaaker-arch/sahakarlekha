import { useMemo, useState } from 'react';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { todayStr } from '@/lib/dateUtils';
import { isRejectedQuality } from '@/lib/procurement/agentFlow';
import { billBase, incidentalAmount, dispatchTotals, type AgencyBillLine, type IncidentalUnit } from '@/lib/marketing/agencyBilling';
import { agencyBillHTML, openPrint } from '@/lib/procurement/print';
import { Plus, Trash2, Truck } from 'lucide-react';

/**
 * Marketing D3 — the agency side of MSP procurement, under the Agency Receipt page:
 *   • Dispatch (lifting): lots on a truck to the agency; on acceptance the shortage is POSTED
 *     (Dr the chosen shortage ledger / Cr the agency receivable — founder 2026-10-25).
 *   • Agency bill: accepted dispatches + the society's own incidental lines; approval POSTS the
 *     incidentals (Dr agency receivable / Cr each line's ledger). Print to send to the agency.
 *   • Matching: receipts (and payments the agency made to farmers directly) against approved bills,
 *     oldest first.
 */
export default function AgencyOps({ hi }: { hi: boolean }) {
  const { agencies, centres, transporters, dispatches, addDispatch, acceptDispatch, deleteDispatch, agencyBills, addAgencyBill, approveAgencyBill, deleteAgencyBill, billMatching, lotValue } = useMarketingData();
  const { accounts, procurementLots, procurementFarmers, procurementJForms, procurementQualityTests, society } = useData();
  const { toast } = useToast();

  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const agencyName = (id?: string) => { const a = agencies.find(x => x.id === id); return a ? (hi && a.nameHi ? a.nameHi : a.name) : '—'; };
  const farmerName = (id: string) => procurementFarmers.find(f => f.id === id)?.farmerName || id;
  const leaf = (type?: string) => accounts.filter(a => !a.isGroup && (!type || a.type === type));
  const accLabel = (a: (typeof accounts)[number]) => `${a.id.length <= 6 ? `${a.id} · ` : ''}${hi && a.nameHi ? a.nameHi : a.name}`;
  const shortageGuess = leaf('expense').find(a => /shortage|कमी/i.test(`${a.name} ${a.nameHi || ''}`))?.id || '';
  const liveDispatches = dispatches.filter(d => !d.isDeleted);
  const liveBills = agencyBills.filter(b => !b.isDeleted);

  // ── Dispatch form ──
  const [dAgency, setDAgency] = useState(agencies[0]?.id || '');
  const [dDate, setDDate] = useState(todayStr());
  const [dSel, setDSel] = useState<Record<string, boolean>>({});
  const [dVehicle, setDVehicle] = useState('');
  const [dTransporter, setDTransporter] = useState('');
  const [dDest, setDDest] = useState('');
  const inDispatch = useMemo(() => new Set(liveDispatches.flatMap(d => d.lotIds)), [liveDispatches]);
  const eligibleLots = procurementLots.filter(l => {
    if (l.cancelledAt || inDispatch.has(l.id) || !(lotValue(l.id) > 0)) return false;
    if (procurementQualityTests.some(q => q.lotId === l.id && isRejectedQuality(q.result))) return false;
    const ag = centres.find(c => c.id === l.centreId)?.agencyId;
    return !ag || ag === dAgency;
  });
  const selLots = eligibleLots.filter(l => dSel[l.id]);
  const selTot = dispatchTotals(selLots.map(l => ({ quantity: l.quantity, value: lotValue(l.id), bags: l.bags })));
  const saveDispatch = () => {
    const d = addDispatch({ date: dDate, agencyId: dAgency, lotIds: selLots.map(l => l.id), vehicleNo: dVehicle, transporterId: dTransporter || undefined, destination: dDest });
    if (d.id) { setDSel({}); setDVehicle(''); setDDest(''); }
  };

  // ── Acceptance (per dispatch) ──
  const [accQty, setAccQty] = useState<Record<string, string>>({});
  const [accDate, setAccDate] = useState<Record<string, string>>({});
  const [accShortAcc, setAccShortAcc] = useState<Record<string, string>>({});

  // ── Bill form ──
  const [bAgency, setBAgency] = useState(agencies[0]?.id || '');
  const [bDate, setBDate] = useState(todayStr());
  const [bSel, setBSel] = useState<Record<string, boolean>>({});
  const [bLines, setBLines] = useState<Array<{ label: string; unit: IncidentalUnit; rate: string; accountId: string }>>([]);
  const billedIds = new Set(liveBills.flatMap(b => b.dispatchIds));
  const billable = liveDispatches.filter(d => d.agencyId === bAgency && d.status === 'accepted' && !billedIds.has(d.id));
  const bBase = billBase(billable.filter(d => bSel[d.id]));
  const lineAmt = (l: { unit: IncidentalUnit; rate: string }) => incidentalAmount(l.unit, Number(l.rate), bBase);
  const saveBill = () => {
    const lines: AgencyBillLine[] = bLines.map(l => ({ id: crypto.randomUUID(), label: l.label, unit: l.unit, rate: Number(l.rate) || 0, amount: lineAmt(l), accountId: l.accountId }));
    const b = addAgencyBill({ date: bDate, agencyId: bAgency, dispatchIds: billable.filter(d => bSel[d.id]).map(d => d.id), lines });
    if (b.id) { setBSel({}); setBLines([]); }
  };
  const unitLabel = (u: IncidentalUnit, r: number) => (u === 'perQtl' ? `₹${r}/${hi ? 'क्विं' : 'qtl'}` : u === 'percent' ? `${r}%` : (hi ? 'निश्चित' : 'fixed'));
  const printBill = (id: string) => {
    const b = liveBills.find(x => x.id === id); if (!b) return;
    const ok = openPrint(agencyBillHTML({
      hi, societyName: (hi && society.nameHi) ? society.nameHi : society.name, agencyName: agencyName(b.agencyId), billNo: b.billNo, date: b.date,
      dispatches: b.dispatchIds.map(did => dispatches.find(d => d.id === did)).filter(Boolean).map(d => ({ no: d!.dispatchNo, date: d!.date, acceptedQty: d!.acceptedQty ?? d!.dispatchedQty, value: d!.dispatchedValue - (d!.shortageValue || 0) })),
      qty: b.qty, mspValue: b.mspValue, lines: b.lines.map(l => ({ label: l.label, basis: unitLabel(l.unit, l.rate), amount: l.amount })), total: b.total,
    }));
    if (!ok) toast({ title: hi ? 'प्रिंट विंडो नहीं खुली' : 'Print window blocked', description: hi ? 'pop-up की अनुमति दें।' : 'Allow pop-ups.', variant: 'destructive' });
  };

  const th = 'text-left font-medium text-muted-foreground px-2 py-1.5';
  const td = 'px-2 py-1.5';

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Truck className="h-5 w-5" />{hi ? 'डिस्पैच · एजेंसी बिल · मिलान' : 'Dispatch · Agency Bills · Matching'}</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue="dispatch">
          <TabsList className="w-full">
            <TabsTrigger value="dispatch" className="flex-1">{hi ? 'डिस्पैच' : 'Dispatch'}</TabsTrigger>
            <TabsTrigger value="bills" className="flex-1">{hi ? 'एजेंसी बिल' : 'Agency bills'}</TabsTrigger>
            <TabsTrigger value="match" className="flex-1">{hi ? 'रसीद-बिल मिलान' : 'Matching'}</TabsTrigger>
          </TabsList>

          {/* ── Dispatch ── */}
          <TabsContent value="dispatch" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="space-y-1"><Label>{hi ? 'एजेंसी' : 'Agency'}</Label>
                <Select value={dAgency} onValueChange={v => { setDAgency(v); setDSel({}); }}><SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                  <SelectContent>{agencies.map(a => <SelectItem key={a.id} value={a.id}>{agencyName(a.id)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>{hi ? 'तारीख' : 'Date'}</Label><Input type="date" value={dDate} max={todayStr()} onChange={e => setDDate(e.target.value)} /></div>
              <div className="space-y-1"><Label>{hi ? 'वाहन नं.' : 'Vehicle no.'}</Label><Input value={dVehicle} onChange={e => setDVehicle(e.target.value.toUpperCase())} /></div>
              <div className="space-y-1"><Label>{hi ? 'ट्रांसपोर्टर' : 'Transporter'}</Label>
                <Select value={dTransporter || '__none__'} onValueChange={v => setDTransporter(v === '__none__' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">—</SelectItem>{transporters.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1 col-span-2"><Label>{hi ? 'गंतव्य (गोदाम / डिपो)' : 'Destination (godown / depot)'}</Label><Input value={dDest} onChange={e => setDDest(e.target.value)} /></div>
            </div>
            <div className="max-h-56 overflow-y-auto rounded border divide-y">
              {eligibleLots.length === 0 && <p className="text-sm text-muted-foreground p-2">{hi ? 'इस एजेंसी के लिए भेजने लायक (पोस्ट हुआ) कोई लॉट नहीं।' : 'No posted lot ready to dispatch for this agency.'}</p>}
              {eligibleLots.map(l => (
                <label key={l.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                  <span className="flex items-center gap-2"><input type="checkbox" checked={!!dSel[l.id]} onChange={e => setDSel(p => ({ ...p, [l.id]: e.target.checked }))} />{farmerName(l.farmerId)} · {procurementJForms.find(j => j.lotId === l.id)?.documentNo || ''}</span>
                  <span className="tabular-nums">{l.quantity?.value ?? 0} {hi ? 'क्विं' : 'qtl'}{l.bags ? ` · ${l.bags} ${hi ? 'बोरी' : 'bags'}` : ''} · {money(lotValue(l.id))}</span>
                </label>
              ))}
            </div>
            <Button onClick={saveDispatch} disabled={selLots.length === 0 || !dAgency}>{hi ? `डिस्पैच दर्ज करें · ${selTot.qty} क्विंटल · ${money(selTot.value)}` : `Record dispatch · ${selTot.qty} qtl · ${money(selTot.value)}`}</Button>

            <div className="space-y-2">
              {[...liveDispatches].sort((a, b) => (a.date < b.date ? 1 : -1)).map(d => (
                <div key={d.id} className="rounded-lg border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{d.dispatchNo} · {d.date} · {agencyName(d.agencyId)} <Badge variant={d.status === 'accepted' ? 'secondary' : 'outline'}>{d.status === 'accepted' ? (hi ? 'स्वीकृत' : 'Accepted') : (hi ? 'भेजा गया' : 'Dispatched')}</Badge>{billedIds.has(d.id) ? <Badge variant="outline" className="ml-1">{hi ? 'बिल में' : 'Billed'}</Badge> : null}</div>
                      <div className="text-xs text-muted-foreground">{d.lotIds.length} {hi ? 'लॉट' : 'lots'} · {d.dispatchedQty} {hi ? 'क्विं' : 'qtl'}{d.bags ? ` · ${d.bags} ${hi ? 'बोरी' : 'bags'}` : ''} · {money(d.dispatchedValue)}{d.vehicleNo ? ` · ${d.vehicleNo}` : ''}{d.destination ? ` · ${d.destination}` : ''}</div>
                      {d.status === 'accepted' && <div className="text-xs">{hi ? 'स्वीकृत' : 'Accepted'} {d.acceptedQty} · {d.acceptedDate}{(d.shortageQty || 0) > 0 ? <span className="text-red-600"> · {hi ? 'कमी' : 'shortage'} {d.shortageQty} {hi ? 'क्विं' : 'qtl'} · {money(d.shortageValue || 0)}</span> : ''}</div>}
                    </div>
                    {!billedIds.has(d.id) && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => { if (window.confirm(hi ? `डिस्पैच ${d.dispatchNo} हटाएँ?${d.shortageVoucherId ? ' कमी का वाउचर भी रद्द होगा।' : ''}` : `Delete dispatch ${d.dispatchNo}?`)) void deleteDispatch(d.id); }} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                  {d.status === 'dispatched' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      <div className="space-y-1"><Label className="text-xs">{hi ? 'एजेंसी ने माना (क्विं)' : 'Accepted (qtl)'}</Label><Input type="number" step="0.001" min={0} value={accQty[d.id] ?? String(d.dispatchedQty)} onChange={e => setAccQty(p => ({ ...p, [d.id]: e.target.value }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">{hi ? 'तारीख' : 'Date'}</Label><Input type="date" value={accDate[d.id] ?? todayStr()} onChange={e => setAccDate(p => ({ ...p, [d.id]: e.target.value }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">{hi ? 'कमी का खाता' : 'Shortage ledger'}</Label>
                        <Select value={accShortAcc[d.id] ?? shortageGuess} onValueChange={v => setAccShortAcc(p => ({ ...p, [d.id]: v }))}><SelectTrigger><SelectValue placeholder={hi ? 'खर्च खाता' : 'Expense ledger'} /></SelectTrigger>
                          <SelectContent>{leaf('expense').map(a => <SelectItem key={a.id} value={a.id}>{accLabel(a)}</SelectItem>)}</SelectContent></Select></div>
                      <Button size="sm" onClick={() => acceptDispatch(d.id, { acceptedQty: Number(accQty[d.id] ?? d.dispatchedQty), acceptedDate: accDate[d.id] ?? todayStr(), shortageAccountId: accShortAcc[d.id] ?? shortageGuess })}>{hi ? 'स्वीकृति दर्ज करें' : 'Record acceptance'}</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Agency bills ── */}
          <TabsContent value="bills" className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{hi ? 'एजेंसी' : 'Agency'}</Label>
                <Select value={bAgency} onValueChange={v => { setBAgency(v); setBSel({}); }}><SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                  <SelectContent>{agencies.map(a => <SelectItem key={a.id} value={a.id}>{agencyName(a.id)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>{hi ? 'बिल तारीख' : 'Bill date'}</Label><Input type="date" value={bDate} max={todayStr()} onChange={e => setBDate(e.target.value)} /></div>
            </div>
            <div className="rounded border divide-y">
              {billable.length === 0 && <p className="text-sm text-muted-foreground p-2">{hi ? 'इस एजेंसी का कोई स्वीकृत, बिना-बिल डिस्पैच नहीं।' : 'No accepted, unbilled dispatch for this agency.'}</p>}
              {billable.map(d => (
                <label key={d.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                  <span className="flex items-center gap-2"><input type="checkbox" checked={!!bSel[d.id]} onChange={e => setBSel(p => ({ ...p, [d.id]: e.target.checked }))} />{d.dispatchNo} · {d.date}</span>
                  <span className="tabular-nums">{d.acceptedQty} {hi ? 'क्विं' : 'qtl'} · {money(d.dispatchedValue - (d.shortageValue || 0))}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>{hi ? 'खर्च (incidentals) — दर आपकी समिति की' : 'Incidentals — your society\'s own rates'}</Label>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setBLines(p => [...p, { label: '', unit: 'perQtl', rate: '', accountId: '' }])}><Plus className="h-3.5 w-3.5" />{hi ? 'पंक्ति' : 'Line'}</Button></div>
              {bLines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 items-center">
                  <Input className="col-span-3" value={l.label} placeholder={hi ? 'जैसे मंडी शुल्क' : 'e.g. Market fee'} onChange={e => setBLines(p => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <div className="col-span-2"><Select value={l.unit} onValueChange={v => setBLines(p => p.map((x, j) => j === i ? { ...x, unit: v as IncidentalUnit } : x))}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="perQtl">₹/{hi ? 'क्विं' : 'qtl'}</SelectItem><SelectItem value="percent">% MSP</SelectItem><SelectItem value="fixed">{hi ? 'निश्चित ₹' : 'Fixed ₹'}</SelectItem></SelectContent></Select></div>
                  <Input className="col-span-2" type="number" min={0} step="0.01" value={l.rate} onChange={e => setBLines(p => p.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} />
                  <div className="col-span-3"><Select value={l.accountId} onValueChange={v => setBLines(p => p.map((x, j) => j === i ? { ...x, accountId: v } : x))}><SelectTrigger><SelectValue placeholder={hi ? 'खाता (Cr)' : 'Ledger (Cr)'} /></SelectTrigger>
                    <SelectContent>{leaf().filter(a => a.type === 'income' || a.type === 'expense' || a.type === 'liability').map(a => <SelectItem key={a.id} value={a.id}>{accLabel(a)}</SelectItem>)}</SelectContent></Select></div>
                  <span className="col-span-1 text-right text-xs tabular-nums">{money(lineAmt(l))}</span>
                  <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8 text-destructive" onClick={() => setBLines(p => p.filter((_, j) => j !== i))} aria-label="remove"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">{hi ? 'स्वीकृत करने पर खर्च बहीखाते में: Dr एजेंसी प्राप्य / Cr हर पंक्ति का खाता। MSP भाग लॉट पोस्टिंग में पहले से दर्ज है — दोबारा नहीं।' : 'On approval: Dr agency receivable / Cr each line\'s ledger. The MSP part was booked when the lots were posted — not again.'}</p>
            </div>
            <Button onClick={saveBill} disabled={!billable.some(d => bSel[d.id])}>{hi ? `बिल ड्राफ्ट · MSP ${money(bBase.value)} + खर्च ${money(bLines.reduce((t, l) => t + lineAmt(l), 0))}` : `Draft bill · MSP ${money(bBase.value)} + incidentals ${money(bLines.reduce((t, l) => t + lineAmt(l), 0))}`}</Button>

            <div className="space-y-2">
              {[...liveBills].sort((a, b) => (a.date < b.date ? 1 : -1)).map(b => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{b.billNo} · {b.date} · {agencyName(b.agencyId)} <Badge variant={b.status === 'approved' ? 'secondary' : 'outline'}>{b.status === 'approved' ? (hi ? 'स्वीकृत' : 'Approved') : (hi ? 'ड्राफ्ट' : 'Draft')}</Badge></div>
                    <div className="text-xs text-muted-foreground">{b.qty} {hi ? 'क्विं' : 'qtl'} · MSP {money(b.mspValue)} · {hi ? 'खर्च' : 'incidentals'} {money(b.incidentalTotal)} · <b>{money(b.total)}</b></div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {b.status === 'draft' && <Button size="sm" onClick={() => approveAgencyBill(b.id)}>{hi ? 'स्वीकृत करें' : 'Approve'}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => printBill(b.id)}>{hi ? 'प्रिंट' : 'Print'}</Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(hi ? `बिल ${b.billNo} हटाएँ?${b.voucherId ? ' उसका खर्च-वाउचर भी रद्द होगा।' : ''}` : `Delete bill ${b.billNo}?`)) void deleteAgencyBill(b.id); }} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Matching ── */}
          <TabsContent value="match" className="space-y-3">
            <p className="text-xs text-muted-foreground">{hi ? 'एजेंसी की रसीदें (और एजेंसी द्वारा किसानों को सीधे भुगतान) सबसे पुराने बिल से मिलाई जाती हैं।' : 'Agency receipts (and payments the agency made to farmers directly) are applied to the oldest bill first.'}</p>
            {agencies.map(a => {
              const bills = liveBills.filter(b => b.agencyId === a.id && b.status === 'approved');
              const un = billMatching.unapplied[a.id] ?? 0;
              if (!bills.length && !un) return null;
              return (
                <div key={a.id} className="rounded-lg border overflow-x-auto">
                  <div className="px-2 py-1.5 font-medium text-sm">{agencyName(a.id)}</div>
                  <table className="w-full text-sm min-w-[460px]">
                    <thead><tr className="border-y"><th className={th}>{hi ? 'बिल' : 'Bill'}</th><th className={`${th} text-right`}>{hi ? 'बिल राशि' : 'Billed'}</th><th className={`${th} text-right`}>{hi ? 'प्राप्त' : 'Received'}</th><th className={`${th} text-right`}>{hi ? 'बकाया' : 'Outstanding'}</th></tr></thead>
                    <tbody>
                      {bills.map(b => { const m = billMatching.byBill[b.id]; return (
                        <tr key={b.id} className="border-b last:border-0"><td className={td}>{b.billNo} · {b.date}</td><td className={`${td} text-right`}>{money(m?.billed ?? b.total)}</td><td className={`${td} text-right`}>{money(m?.received ?? 0)}</td><td className={`${td} text-right ${(m?.outstanding ?? 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(m?.outstanding ?? b.total)}</td></tr>
                      ); })}
                      {un > 0 && <tr><td className={td} colSpan={3}>{hi ? 'बिल से अधिक प्राप्त (अग्रिम / बिना-बिल लॉट)' : 'Received beyond bills (advance / unbilled lots)'}</td><td className={`${td} text-right`}>{money(un)}</td></tr>}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
