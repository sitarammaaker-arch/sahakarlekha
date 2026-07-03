import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileSpreadsheet, Download } from 'lucide-react';
import { downloadCSV } from '@/lib/exportUtils';
import { buildProcurementRegister, buildCommoditySummary, settlementTotals } from '@/lib/marketing/registers';

const LEGACY_CROPS: Record<string, { name: string; nameHi: string }> = {
  wheat: { name: 'Wheat', nameHi: 'गेहूँ' }, paddy: { name: 'Paddy', nameHi: 'धान' },
  mustard: { name: 'Mustard', nameHi: 'सरसों' }, gram: { name: 'Gram', nameHi: 'चना' }, bajra: { name: 'Bajra', nameHi: 'बाजरा' },
};

export default function ProcurementRegisters() {
  const { procurementLots, procurementFarmers, procurementSettlements, procurementPostingRuleResults, vouchers } = useData();
  const { crops, seasons, centres } = useMarketingData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const farmerName = (id: string) => { const f = procurementFarmers.find(x => x.id === id); return f ? `${f.farmerName} (${f.farmerCode})` : id; };
  const cropName = (id: string) => { const c = crops.find(x => x.id === id); if (c) return hi && c.nameHi ? c.nameHi : c.name; const l = LEGACY_CROPS[id]; return l ? (hi ? l.nameHi : l.name) : id; };
  const seasonName = (id?: string) => { const s = seasons.find(x => x.id === id); return s ? (hi && s.nameHi ? s.nameHi : s.name) : ''; };
  const centreName = (id?: string) => { const c = centres.find(x => x.id === id); return c ? (hi && c.nameHi ? c.nameHi : c.name) : ''; };

  // Settlement → farmer (via engine voucher → posting rule result → lot).
  const farmerBySettlement = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of procurementSettlements) {
      const ev = vouchers.find(v => v.id === s.engineVoucherId);
      const rr = ev ? procurementPostingRuleResults.find(r => r.id === ev.refId) : undefined;
      const lot = rr ? procurementLots.find(l => l.id === rr.lotId) : undefined;
      if (lot) m[s.id] = lot.farmerId;
    }
    return m;
  }, [procurementSettlements, vouchers, procurementPostingRuleResults, procurementLots]);

  // ── Procurement Register (date window) ──
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const procReg = useMemo(() => buildProcurementRegister(procurementLots, from || undefined, to || undefined), [procurementLots, from, to]);
  const exportProc = () => downloadCSV(
    [hi ? 'तिथि' : 'Date', hi ? 'किसान' : 'Farmer', hi ? 'फसल' : 'Crop', hi ? 'सीज़न' : 'Season', hi ? 'केंद्र' : 'Centre', hi ? 'मात्रा' : 'Qty', hi ? 'दर' : 'Rate', hi ? 'मूल्य' : 'Value', hi ? 'स्थिति' : 'Status'],
    procReg.rows.map(r => [r.date, farmerName(r.farmerId), cropName(r.cropId), seasonName(r.seasonId), centreName(r.centreId), r.qty, r.rate, r.value, r.status]),
    'procurement-register',
  );

  // ── Settlement Register ──
  const liveSettlements = useMemo(() => procurementSettlements.filter(s => !s.isDeleted), [procurementSettlements]);
  const stotals = useMemo(() => settlementTotals(procurementSettlements), [procurementSettlements]);
  const settleRow = (s: typeof liveSettlements[number]) => {
    const deductions = (s.deductionLines || []).reduce((a, l) => a + (l.amount?.amount || 0), 0);
    const net = s.netPayable?.amount || 0, paid = s.amountPaid?.amount || 0;
    return { no: s.settlementNo || '—', farmer: farmerBySettlement[s.id] ? farmerName(farmerBySettlement[s.id]) : '—', gross: s.gross?.amount || 0, deductions, net, paid, outstanding: +(net - paid).toFixed(2), status: s.status };
  };
  const exportSettle = () => downloadCSV(
    [hi ? 'निपटान सं.' : 'Settlement No', hi ? 'किसान' : 'Farmer', hi ? 'सकल' : 'Gross', hi ? 'कटौती' : 'Deductions', hi ? 'निवल' : 'Net', hi ? 'भुगतान' : 'Paid', hi ? 'बकाया' : 'Outstanding', hi ? 'स्थिति' : 'Status'],
    liveSettlements.map(s => { const r = settleRow(s); return [r.no, r.farmer, r.gross, r.deductions, r.net, r.paid, r.outstanding, r.status]; }),
    'settlement-register',
  );

  // ── Commodity Summary ──
  const commodity = useMemo(() => buildCommoditySummary(procurementLots), [procurementLots]);
  const exportCommodity = () => downloadCSV(
    [hi ? 'फसल' : 'Crop', hi ? 'मात्रा (क्विं)' : 'Qty (qtl)', hi ? 'मूल्य' : 'Value', hi ? 'लॉट' : 'Lots'],
    commodity.map(c => [cropName(c.cropId), c.qty, c.value, c.lots]),
    'commodity-summary',
  );

  // ── Farmer Ledger ──
  const [ledgerFarmer, setLedgerFarmer] = useState('');
  const ledgerLots = useMemo(() => procurementLots.filter(l => l.farmerId === ledgerFarmer), [procurementLots, ledgerFarmer]);
  const ledgerSettlements = useMemo(() => procurementSettlements.filter(s => !s.isDeleted && farmerBySettlement[s.id] === ledgerFarmer), [procurementSettlements, farmerBySettlement, ledgerFarmer]);
  const ledgerTotals = useMemo(() => settlementTotals(ledgerSettlements), [ledgerSettlements]);
  const ledgerProcValue = ledgerLots.reduce((s, l) => s + (l.quantity?.value || 0) * (l.mspRate?.amount || 0), 0);

  const th = 'text-left font-medium text-muted-foreground px-2 py-1.5';
  const td = 'px-2 py-1.5';

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'प्रोक्योरमेंट रजिस्टर' : 'Procurement Registers'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'खरीद · निपटान · किसान बही · जिंस सारांश' : 'Procurement · settlement · farmer ledger · commodity summary'}</p>
        </div>
      </div>

      <Tabs defaultValue="procurement">
        <TabsList className="w-full">
          <TabsTrigger value="procurement" className="flex-1">{hi ? 'खरीद' : 'Procurement'}</TabsTrigger>
          <TabsTrigger value="settlement" className="flex-1">{hi ? 'निपटान' : 'Settlement'}</TabsTrigger>
          <TabsTrigger value="farmer" className="flex-1">{hi ? 'किसान बही' : 'Farmer'}</TabsTrigger>
          <TabsTrigger value="commodity" className="flex-1">{hi ? 'जिंस' : 'Commodity'}</TabsTrigger>
        </TabsList>

        {/* Procurement Register */}
        <TabsContent value="procurement">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">{hi ? 'खरीद रजिस्टर' : 'Procurement Register'} ({procReg.count})</CardTitle>
              <div className="flex items-end gap-2 flex-wrap">
                <div><Label className="text-[11px]">{hi ? 'से' : 'From'}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-36" /></div>
                <div><Label className="text-[11px]">{hi ? 'तक' : 'To'}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-36" /></div>
                <Button size="sm" variant="outline" className="gap-1 h-8" onClick={exportProc} disabled={procReg.count === 0}><Download className="h-4 w-4" />CSV</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {procReg.count === 0 ? <p className="text-sm text-muted-foreground">{hi ? 'कोई लॉट नहीं।' : 'No lots.'}</p> : (
                <table className="w-full text-sm min-w-[640px]">
                  <thead><tr className="border-b">
                    <th className={th}>{hi ? 'तिथि' : 'Date'}</th><th className={th}>{hi ? 'किसान' : 'Farmer'}</th><th className={th}>{hi ? 'फसल' : 'Crop'}</th><th className={th}>{hi ? 'केंद्र' : 'Centre'}</th><th className={`${th} text-right`}>{hi ? 'मात्रा' : 'Qty'}</th><th className={`${th} text-right`}>{hi ? 'दर' : 'Rate'}</th><th className={`${th} text-right`}>{hi ? 'मूल्य' : 'Value'}</th>
                  </tr></thead>
                  <tbody>
                    {procReg.rows.map(r => (
                      <tr key={r.lotId} className="border-b last:border-0">
                        <td className={td}>{r.date}</td><td className={td}>{farmerName(r.farmerId)}</td><td className={td}>{cropName(r.cropId)}</td><td className={td}>{centreName(r.centreId)}</td><td className={`${td} text-right`}>{r.qty}</td><td className={`${td} text-right`}>{money(r.rate)}</td><td className={`${td} text-right`}>{money(r.value)}</td>
                      </tr>
                    ))}
                    <tr className="font-medium"><td className={td} colSpan={4}>{hi ? 'कुल' : 'Total'}</td><td className={`${td} text-right`}>{procReg.totalQty}</td><td className={td}></td><td className={`${td} text-right`}>{money(procReg.totalValue)}</td></tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlement Register */}
        <TabsContent value="settlement">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{hi ? 'निपटान रजिस्टर' : 'Settlement Register'} ({stotals.count})</CardTitle>
              <Button size="sm" variant="outline" className="gap-1 h-8" onClick={exportSettle} disabled={stotals.count === 0}><Download className="h-4 w-4" />CSV</Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {stotals.count === 0 ? <p className="text-sm text-muted-foreground">{hi ? 'कोई निपटान नहीं।' : 'No settlements.'}</p> : (
                <table className="w-full text-sm min-w-[680px]">
                  <thead><tr className="border-b">
                    <th className={th}>{hi ? 'सं.' : 'No'}</th><th className={th}>{hi ? 'किसान' : 'Farmer'}</th><th className={`${th} text-right`}>{hi ? 'सकल' : 'Gross'}</th><th className={`${th} text-right`}>{hi ? 'कटौती' : 'Ded.'}</th><th className={`${th} text-right`}>{hi ? 'निवल' : 'Net'}</th><th className={`${th} text-right`}>{hi ? 'भुगतान' : 'Paid'}</th><th className={`${th} text-right`}>{hi ? 'बकाया' : 'Outst.'}</th><th className={th}></th>
                  </tr></thead>
                  <tbody>
                    {liveSettlements.map(s => { const r = settleRow(s); return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className={td}>{r.no}</td><td className={td}>{r.farmer}</td><td className={`${td} text-right`}>{money(r.gross)}</td><td className={`${td} text-right`}>{money(r.deductions)}</td><td className={`${td} text-right`}>{money(r.net)}</td><td className={`${td} text-right`}>{money(r.paid)}</td><td className={`${td} text-right`}>{money(r.outstanding)}</td>
                        <td className={td}><Badge variant={s.status === 'approved' ? 'default' : 'secondary'} className="text-[10px]">{s.status === 'approved' ? (hi ? 'स्वीकृत' : 'Appr.') : (hi ? 'ड्राफ्ट' : 'Draft')}</Badge></td>
                      </tr>
                    ); })}
                    <tr className="font-medium"><td className={td} colSpan={2}>{hi ? 'कुल' : 'Total'}</td><td className={`${td} text-right`}>{money(stotals.gross)}</td><td className={`${td} text-right`}>{money(stotals.deductions)}</td><td className={`${td} text-right`}>{money(stotals.net)}</td><td className={`${td} text-right`}>{money(stotals.paid)}</td><td className={`${td} text-right`}>{money(stotals.outstanding)}</td><td className={td}></td></tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Farmer Ledger */}
        <TabsContent value="farmer">
          <Card>
            <CardHeader><CardTitle className="text-base">{hi ? 'किसान बही' : 'Farmer Ledger'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={ledgerFarmer} onValueChange={setLedgerFarmer}>
                <SelectTrigger className="max-w-sm"><SelectValue placeholder={hi ? 'किसान चुनें' : 'Select a farmer'} /></SelectTrigger>
                <SelectContent>{procurementFarmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmerName} ({f.farmerCode})</SelectItem>)}</SelectContent>
              </Select>
              {ledgerFarmer && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">{hi ? 'लॉट' : 'Lots'}</div><div className="font-semibold">{ledgerLots.length}</div></div>
                    <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">{hi ? 'खरीद मूल्य' : 'Proc. value'}</div><div className="font-semibold">{money(ledgerProcValue)}</div></div>
                    <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">{hi ? 'निवल देय' : 'Net payable'}</div><div className="font-semibold">{money(ledgerTotals.net)}</div></div>
                    <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">{hi ? 'बकाया' : 'Outstanding'}</div><div className={`font-semibold ${ledgerTotals.outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(ledgerTotals.outstanding)}</div></div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[420px]">
                      <thead><tr className="border-b"><th className={th}>{hi ? 'तिथि' : 'Date'}</th><th className={th}>{hi ? 'फसल' : 'Crop'}</th><th className={`${th} text-right`}>{hi ? 'मात्रा' : 'Qty'}</th><th className={`${th} text-right`}>{hi ? 'दर' : 'Rate'}</th><th className={`${th} text-right`}>{hi ? 'मूल्य' : 'Value'}</th></tr></thead>
                      <tbody>
                        {ledgerLots.length === 0 && <tr><td className={td} colSpan={5}>{hi ? 'कोई लॉट नहीं।' : 'No lots.'}</td></tr>}
                        {ledgerLots.map(l => (
                          <tr key={l.id} className="border-b last:border-0"><td className={td}>{(l.createdAt || '').slice(0, 10)}</td><td className={td}>{cropName(l.cropId)}</td><td className={`${td} text-right`}>{l.quantity?.value || 0}</td><td className={`${td} text-right`}>{money(l.mspRate?.amount || 0)}</td><td className={`${td} text-right`}>{money((l.quantity?.value || 0) * (l.mspRate?.amount || 0))}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commodity Summary */}
        <TabsContent value="commodity">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{hi ? 'जिंस सारांश' : 'Commodity Summary'}</CardTitle>
              <Button size="sm" variant="outline" className="gap-1 h-8" onClick={exportCommodity} disabled={commodity.length === 0}><Download className="h-4 w-4" />CSV</Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {commodity.length === 0 ? <p className="text-sm text-muted-foreground">{hi ? 'कोई लॉट नहीं।' : 'No lots.'}</p> : (
                <table className="w-full text-sm min-w-[420px]">
                  <thead><tr className="border-b"><th className={th}>{hi ? 'फसल' : 'Crop'}</th><th className={`${th} text-right`}>{hi ? 'मात्रा (क्विं)' : 'Qty (qtl)'}</th><th className={`${th} text-right`}>{hi ? 'मूल्य' : 'Value'}</th><th className={`${th} text-right`}>{hi ? 'लॉट' : 'Lots'}</th></tr></thead>
                  <tbody>
                    {commodity.map(c => (<tr key={c.cropId} className="border-b last:border-0"><td className={td}>{cropName(c.cropId)}</td><td className={`${td} text-right`}>{c.qty}</td><td className={`${td} text-right`}>{money(c.value)}</td><td className={`${td} text-right`}>{c.lots}</td></tr>))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
