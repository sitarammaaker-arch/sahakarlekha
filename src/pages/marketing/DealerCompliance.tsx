import { useState } from 'react';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getBankAccountIds } from '@/lib/storage';
import { todayStr } from '@/lib/dateUtils';
import { licenceStatus, suggestedValidUpto, schemeClaimBalance, LICENCE_STATUS_TEXT, type DealerLicence } from '@/lib/marketing/dealerCompliance';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { LicenceExpiryBanner } from '@/components/marketing/LicenceExpiryBanner';

const PRODUCT_GROUPS = [
  { id: 'fertiliser', hi: 'उर्वरक', en: 'Fertiliser' },
  { id: 'seed', hi: 'बीज', en: 'Seed' },
  { id: 'pesticide', hi: 'कीटनाशक', en: 'Pesticide' },
  { id: 'other', hi: 'अन्य', en: 'Other' },
];

/**
 * Marketing E1 — dealer compliance:
 *   • Licences: the FCO 1985 authorisation letter (Form A2, via Memorandum of Intimation in Form A1) and a
 *     Form O certificate of source for each source (cl. 8); validity three years (cl. 10); renewal before
 *     expiry, one-month grace with additional fee, then lapse (cl. 11). Seed / pesticide licences can be
 *     kept here too (their own validity, entered from the certificate).
 *   • Scheme claims: any state / central scheme amount the society claims — posted on entry
 *     (Dr receivable / Cr the society's chosen ledger), receipts against it. (Fertiliser subsidy itself is
 *     paid to the manufacturer under DBT, not to the dealer.)
 */
export default function DealerCompliance() {
  const { dealerLicences, saveDealerLicence, deleteDealerLicence, schemeClaims, addSchemeClaim, recordSchemeReceipt, deleteSchemeClaim, schemeReceipts } = useMarketingData();
  const { accounts, suppliers } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const today = todayStr();
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const accLabel = (a: (typeof accounts)[number]) => `${a.id.length <= 6 ? `${a.id} · ` : ''}${hi && a.nameHi ? a.nameHi : a.name}`;
  const live = dealerLicences.filter(l => !l.isDeleted);

  // ── licence form ──
  const blank = { kind: 'authorisation' as DealerLicence['kind'], productGroup: 'fertiliser', licenceNo: '', authority: '', issuedOn: '', validUpto: '', supplierId: '', sourceName: '', note: '' };
  const [lf, setLf] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const setIssued = (v: string) => setLf(p => ({ ...p, issuedOn: v, validUpto: p.validUpto || (p.kind === 'authorisation' ? suggestedValidUpto(v) || '' : '') }));
  const saveLicence = () => {
    saveDealerLicence({ ...(editId ? { id: editId } : {}), kind: lf.kind, productGroup: lf.productGroup, licenceNo: lf.licenceNo.trim() || undefined, authority: lf.authority.trim() || undefined, issuedOn: lf.issuedOn || undefined, validUpto: lf.validUpto || undefined, supplierId: lf.supplierId || undefined, sourceName: lf.sourceName.trim() || (suppliers.find(s => s.id === lf.supplierId)?.name), note: lf.note.trim() || undefined });
    setLf(blank); setEditId(null);
  };
  const editLicence = (l: DealerLicence) => { setEditId(l.id); setLf({ kind: l.kind, productGroup: l.productGroup || 'fertiliser', licenceNo: l.licenceNo || '', authority: l.authority || '', issuedOn: l.issuedOn || '', validUpto: l.validUpto || '', supplierId: l.supplierId || '', sourceName: l.sourceName || '', note: l.note || '' }); };

  // ── scheme claim form ──
  const recvDefault = accounts.find(a => a.id === '3305' && !a.isGroup)?.id || '';
  const [cf, setCf] = useState({ date: today, schemeName: '', authority: '', period: '', amount: '', creditAccountId: '', receivableAccountId: recvDefault });
  const [rcv, setRcv] = useState<Record<string, { amount: string; date: string; mode: 'bank' | 'cash'; ref: string }>>({});
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));
  const statusBadge = (l: DealerLicence) => {
    const st = licenceStatus(l.validUpto, today);
    const cls = st === 'lapsed' ? 'bg-red-100 text-red-800' : st === 'grace' || st === 'expiring' ? 'bg-amber-100 text-amber-900' : st === 'valid' ? 'bg-green-100 text-green-800' : '';
    return <Badge variant="outline" className={cls}>{hi ? LICENCE_STATUS_TEXT[st].hi : LICENCE_STATUS_TEXT[st].en}</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><ShieldCheck className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'खाद लाइसेंस व योजना दावे' : 'Dealer Licences & Scheme Claims'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'FCO 1985 प्राधिकार पत्र / Form O की वैधता, और सरकारी योजनाओं के दावे' : 'FCO 1985 authorisation / Form O validity, and government scheme claims'}</p>
        </div>
      </div>
      <LicenceExpiryBanner hi={hi} />

      <Tabs defaultValue="licences">
        <TabsList className="w-full">
          <TabsTrigger value="licences" className="flex-1">{hi ? 'लाइसेंस' : 'Licences'}</TabsTrigger>
          <TabsTrigger value="claims" className="flex-1">{hi ? 'योजना दावे' : 'Scheme claims'}</TabsTrigger>
        </TabsList>

        <TabsContent value="licences" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{editId ? (hi ? 'लाइसेंस संपादित करें' : 'Edit licence') : (hi ? 'नया लाइसेंस / Form O' : 'New licence / Form O')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1"><Label>{hi ? 'प्रकार' : 'Type'}</Label>
                  <Select value={lf.kind} onValueChange={v => setLf(p => ({ ...p, kind: v as DealerLicence['kind'] }))}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="authorisation">{hi ? 'प्राधिकार पत्र (Form A2)' : 'Authorisation letter (Form A2)'}</SelectItem><SelectItem value="sourceCertificate">{hi ? 'स्रोत प्रमाणपत्र (Form O)' : 'Certificate of source (Form O)'}</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label>{hi ? 'वस्तु' : 'Product'}</Label>
                  <Select value={lf.productGroup} onValueChange={v => setLf(p => ({ ...p, productGroup: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRODUCT_GROUPS.map(g => <SelectItem key={g.id} value={g.id}>{hi ? g.hi : g.en}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>{hi ? 'नंबर' : 'Number'}</Label><Input value={lf.licenceNo} onChange={e => setLf(p => ({ ...p, licenceNo: e.target.value }))} /></div>
                <div className="space-y-1"><Label>{hi ? 'जारीकर्ता' : 'Issued by'}</Label><Input value={lf.authority} onChange={e => setLf(p => ({ ...p, authority: e.target.value }))} placeholder={hi ? 'जैसे ज़िला कृषि अधिकारी' : 'e.g. Notified Authority'} /></div>
                <div className="space-y-1"><Label>{hi ? 'जारी तारीख' : 'Issued on'}</Label><Input type="date" value={lf.issuedOn} onChange={e => setIssued(e.target.value)} /></div>
                <div className="space-y-1"><Label>{hi ? 'वैध तक' : 'Valid up to'}</Label><Input type="date" value={lf.validUpto} onChange={e => setLf(p => ({ ...p, validUpto: e.target.value }))} /></div>
                {lf.kind === 'sourceCertificate' && <>
                  <div className="space-y-1"><Label>{hi ? 'सप्लायर' : 'Supplier'}</Label>
                    <Select value={lf.supplierId || '__none__'} onValueChange={v => setLf(p => ({ ...p, supplierId: v === '__none__' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="__none__">—</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1 col-span-2"><Label>{hi ? 'स्रोत का नाम (कंपनी / पूल एजेंसी / थोक)' : 'Source (manufacturer / pool agency / wholesaler)'}</Label><Input value={lf.sourceName} onChange={e => setLf(p => ({ ...p, sourceName: e.target.value }))} /></div>
                </>}
              </div>
              <p className="text-[11px] text-muted-foreground">{hi ? 'FCO 1985: प्राधिकार पत्र जारी तारीख से 3 वर्ष वैध (cl. 10) — "वैध तक" अपने-आप सुझाया जाता है, प्रमाणपत्र देखकर ठीक करें। हर स्रोत का अलग Form O (cl. 8)। समाप्ति से पहले नवीनीकरण; 1 माह के भीतर अतिरिक्त शुल्क से, उसके बाद व्यपगत (cl. 11)।' : 'FCO 1985: authorisation valid 3 years from issue (cl. 10) — "valid up to" is suggested; correct it from the certificate. One Form O per source (cl. 8). Renew before expiry; within one month with additional fee; after that it lapses (cl. 11).'}</p>
              <div className="flex gap-2"><Button onClick={saveLicence}>{hi ? 'सेव करें' : 'Save'}</Button>{editId && <Button variant="outline" onClick={() => { setEditId(null); setLf(blank); }}>{hi ? 'रद्द करें' : 'Cancel'}</Button>}</div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {live.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई लाइसेंस दर्ज नहीं।' : 'No licences yet.'}</p>}
            {[...live].sort((a, b) => (a.validUpto || '9').localeCompare(b.validUpto || '9')).map(l => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{l.kind === 'authorisation' ? (hi ? 'प्राधिकार पत्र' : 'Authorisation') : `Form O · ${l.sourceName || ''}`} {l.licenceNo ? <span className="font-mono">{l.licenceNo}</span> : null} {statusBadge(l)}</div>
                  <div className="text-xs text-muted-foreground">{PRODUCT_GROUPS.find(g => g.id === l.productGroup)?.[hi ? 'hi' : 'en'] || ''}{l.authority ? ` · ${l.authority}` : ''} · {l.issuedOn || '—'} → {l.validUpto || '—'}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => editLicence(l)}>{hi ? 'संपादित' : 'Edit'}</Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(hi ? 'यह लाइसेंस हटाएँ?' : 'Delete this licence?')) deleteDealerLicence(l.id); }} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="claims" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{hi ? 'नया योजना दावा' : 'New scheme claim'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1 col-span-2"><Label>{hi ? 'योजना का नाम' : 'Scheme'} *</Label><Input value={cf.schemeName} onChange={e => setCf(p => ({ ...p, schemeName: e.target.value }))} placeholder={hi ? 'जैसे बीज वितरण सब्सिडी' : 'e.g. Seed distribution subsidy'} /></div>
                <div className="space-y-1"><Label>{hi ? 'तारीख' : 'Date'}</Label><Input type="date" value={cf.date} max={today} onChange={e => setCf(p => ({ ...p, date: e.target.value }))} /></div>
                <div className="space-y-1"><Label>{hi ? 'विभाग / प्राधिकारी' : 'Department'}</Label><Input value={cf.authority} onChange={e => setCf(p => ({ ...p, authority: e.target.value }))} /></div>
                <div className="space-y-1"><Label>{hi ? 'अवधि' : 'Period'}</Label><Input value={cf.period} onChange={e => setCf(p => ({ ...p, period: e.target.value }))} placeholder={hi ? 'जैसे रबी 2026' : 'e.g. Rabi 2026'} /></div>
                <div className="space-y-1"><Label>{hi ? 'राशि' : 'Amount'} *</Label><Input type="number" min={0} step="0.01" value={cf.amount} onChange={e => setCf(p => ({ ...p, amount: e.target.value }))} /></div>
                <div className="space-y-1"><Label>{hi ? 'प्राप्य खाता (Dr)' : 'Receivable (Dr)'}</Label>
                  <Select value={cf.receivableAccountId} onValueChange={v => setCf(p => ({ ...p, receivableAccountId: v }))}><SelectTrigger><SelectValue placeholder="3305" /></SelectTrigger>
                    <SelectContent>{accounts.filter(a => !a.isGroup && a.type === 'asset').map(a => <SelectItem key={a.id} value={a.id}>{accLabel(a)}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1 col-span-2"><Label>{hi ? 'जमा खाता (Cr) — आय या खरीद-कटौती' : 'Credit ledger (Cr) — income or purchase reduction'}</Label>
                  <Select value={cf.creditAccountId} onValueChange={v => setCf(p => ({ ...p, creditAccountId: v }))}><SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                    <SelectContent>{accounts.filter(a => !a.isGroup && (a.type === 'income' || a.type === 'expense')).map(a => <SelectItem key={a.id} value={a.id}>{accLabel(a)}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <p className="text-[11px] text-muted-foreground">{hi ? 'दर्ज करने पर बहीखाते में: Dr प्राप्य / Cr चुना खाता। खाद की सब्सिडी DBT में कंपनी को मिलती है — यह रजिस्टर उन योजनाओं के लिए है जिनका पैसा समिति को मिलता है। खाता अपने CA से तय करें।' : 'On entry: Dr receivable / Cr the chosen ledger. Fertiliser subsidy under DBT goes to the manufacturer — this register is for schemes that pay the society. Confirm the ledger with your CA.'}</p>
              <Button onClick={() => { addSchemeClaim({ ...cf, amount: Number(cf.amount) }); setCf(p => ({ ...p, schemeName: '', amount: '', period: '' })); }} disabled={!cf.schemeName.trim() || !(Number(cf.amount) > 0) || !cf.creditAccountId || !cf.receivableAccountId}>{hi ? 'दावा दर्ज करें' : 'Record claim'}</Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {schemeClaims.filter(c => !c.isDeleted).sort((a, b) => (a.date < b.date ? 1 : -1)).map(c => {
              const bal = schemeClaimBalance(c, schemeReceipts);
              const f = rcv[c.id] ?? { amount: String(bal.outstanding), date: today, mode: 'bank' as const, ref: '' };
              return (
                <div key={c.id} className="rounded-lg border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{c.claimNo} · {c.schemeName} {bal.outstanding <= 0.005 ? <Badge variant="secondary">{hi ? 'प्राप्त' : 'Received'}</Badge> : null}</div>
                      <div className="text-xs text-muted-foreground">{c.date}{c.authority ? ` · ${c.authority}` : ''}{c.period ? ` · ${c.period}` : ''} · {hi ? 'दावा' : 'claim'} {money(c.amount)} · {hi ? 'प्राप्त' : 'received'} {money(bal.received)} · <b>{hi ? 'बकाया' : 'outstanding'} {money(bal.outstanding)}</b></div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => { if (window.confirm(hi ? `दावा ${c.claimNo} हटाएँ? उसका वाउचर भी रद्द होगा।` : `Delete claim ${c.claimNo}?`)) void deleteSchemeClaim(c.id); }} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {bal.outstanding > 0.005 && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <Input type="number" min={0} step="0.01" value={f.amount} onChange={e => setRcv(p => ({ ...p, [c.id]: { ...f, amount: e.target.value } }))} />
                      <Input type="date" value={f.date} onChange={e => setRcv(p => ({ ...p, [c.id]: { ...f, date: e.target.value } }))} />
                      <Select value={f.mode} onValueChange={v => setRcv(p => ({ ...p, [c.id]: { ...f, mode: v as 'bank' | 'cash' } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem></SelectContent></Select>
                      <Input value={f.ref} onChange={e => setRcv(p => ({ ...p, [c.id]: { ...f, ref: e.target.value } }))} placeholder={hi ? 'संदर्भ / UTR' : 'Ref / UTR'} />
                      <Button size="sm" onClick={() => recordSchemeReceipt(c.id, { amount: Number(f.amount), date: f.date, mode: f.mode, bankAccountId: f.mode === 'bank' ? bankAccounts[0]?.id : undefined, reference: f.ref.trim() || undefined })}>{hi ? 'प्राप्ति दर्ज' : 'Record receipt'}</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
