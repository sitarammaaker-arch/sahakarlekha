/**
 * Godowns (ECR-17 Phase 3) — godown master + godown-wise stock report.
 * Define godowns (optionally under a branch); the Header godown selector stamps
 * new stock movements. The report shows on-hand qty + value per (item × godown).
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Warehouse, Plus, Edit2, Trash2, Package, ClipboardList, ArrowLeftRight, Printer } from 'lucide-react';
import type { Godown } from '@/types';
import { computeGodownStock, godownTotals, UNASSIGNED_GODOWN } from '@/lib/godownStock';
import { buildStackCard } from '@/lib/stackCard';
import { capacityUtilisation } from '@/lib/godownCapacity';
import { computeStorageLoss } from '@/lib/storageLoss';
import { buildWarehouseDoc } from '@/lib/warehouseDoc';

const Godowns: React.FC = () => {
  const { godowns, addGodown, updateGodown, deleteGodown, branches, stockMovements, stockItems, transferStock, society } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const isAdmin = user?.role === 'admin';
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Godown | null>(null);
  const [form, setForm] = useState({ name: '', code: '', branchId: '', address: '', capacityMT: '' });

  const openNew = () => { setEditing(null); setForm({ name: '', code: '', branchId: branches.find(b => b.isHeadOffice)?.id || '', address: '', capacityMT: '' }); setOpen(true); };
  const openEdit = (g: Godown) => { setEditing(g); setForm({ name: g.name, code: g.code || '', branchId: g.branchId || '', address: g.address || '', capacityMT: g.capacityMT != null ? String(g.capacityMT) : '' }); setOpen(true); };
  const save = () => {
    if (!form.name.trim()) { toast({ title: hi ? 'नाम ज़रूरी' : 'Name required', variant: 'destructive' }); return; }
    const data = { name: form.name.trim(), code: form.code.trim(), branchId: form.branchId || undefined, address: form.address.trim(), capacityMT: form.capacityMT === '' ? undefined : Number(form.capacityMT) };
    if (editing) updateGodown(editing.id, data); else addGodown({ ...data, isActive: true });
    setOpen(false); toast({ title: hi ? 'गोदाम सहेजा गया' : 'Godown saved' });
  };
  const remove = (g: Godown) => { if (window.confirm(hi ? `${g.name} हटाएँ?` : `Delete ${g.name}?`)) { deleteGodown(g.id); toast({ title: hi ? 'गोदाम हटाया गया' : 'Godown deleted' }); } };

  const nameOfGodown = (id: string) => id === UNASSIGNED_GODOWN ? (hi ? 'बिना गोदाम' : 'Unassigned') : (godowns.find(g => g.id === id)?.name || id);
  const nameOfItem = (id: string) => stockItems.find(s => s.id === id)?.name || id;

  // ECR-20: stack card (bin card) — chronological running-balance ledger for one item × godown.
  const [scItem, setScItem] = useState('');
  const [scGodown, setScGodown] = useState('');
  const effItem = scItem || stockItems[0]?.id || '';
  const effGodown = scGodown || UNASSIGNED_GODOWN;
  const stackCard = useMemo(
    () => effItem ? buildStackCard(stockMovements as unknown as Parameters<typeof buildStackCard>[0], effItem, effGodown) : [],
    [stockMovements, effItem, effGodown],
  );
  const typeLabel = (t: string) => hi
    ? ({ purchase: 'खरीद', sale: 'बिक्री', opening: 'ओपनिंग', adjustment: 'समायोजन' } as Record<string, string>)[t] || t
    : t;

  // ECR-20: print a Warehouse Receipt (inward) or Gate Pass (outward) for a stack-card row.
  const printWarehouseDoc = (e: { type: string; inQty: number; outQty: number; date?: string; referenceNo?: string }) => {
    const isIn = e.inQty > 0;
    const qty = isIn ? e.inQty : -e.outQty;
    const item = stockItems.find(s => s.id === effItem);
    const doc = buildWarehouseDoc({
      movementType: e.type, qty, date: e.date, referenceNo: e.referenceNo,
      docNo: `${isIn ? 'WHR' : 'GP'}/${e.referenceNo || e.date || ''}`,
      societyName: society.name, godownName: nameOfGodown(effGodown), itemName: nameOfItem(effItem), itemUnit: item?.unit,
    });
    const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const w = window.open('', '_blank', 'width=720,height=820');
    if (!w) { toast({ title: hi ? 'प्रिंट विंडो खुल नहीं सकी (popup blocked)' : 'Print window blocked', variant: 'destructive' }); return; }
    const rows = doc.fields.map(f => `<tr><td class="l">${esc(f.label)}</td><td class="v">${esc(f.value || '')}</td></tr>`).join('');
    const manual = doc.manualFields.map(l => `<tr><td class="l">${esc(l)}</td><td class="v blank"></td></tr>`).join('');
    w.document.write(`<!doctype html><html lang="hi"><head><meta charset="utf-8"><title>${esc(doc.docNo)}</title><style>body{font-family:system-ui,sans-serif;padding:28px;color:#111}.no{float:right;font-size:12px;color:#555}h1{font-size:18px;margin:0}h2{font-size:14px;color:#555;margin:4px 0 18px}table{width:100%;border-collapse:collapse}td{padding:9px 6px;border-bottom:1px solid #ddd;font-size:13px}td.l{width:48%;color:#555}td.v.blank{height:22px}.sign{margin-top:52px;display:flex;justify-content:space-between;font-size:12px;color:#555;text-align:center}</style></head><body onload="window.print()"><div class="no">${esc(doc.docNo)}</div><h1>${esc(doc.societyName)}</h1><h2>${esc(doc.title)}</h2><table>${rows}${manual}</table><div class="sign"><span>_______________<br/>तैयारकर्ता</span><span>_______________<br/>अधिकृत हस्ताक्षर</span></div></body></html>`);
    w.document.close();
  };

  const stock = useMemo(() => computeGodownStock(stockMovements as unknown as Parameters<typeof computeGodownStock>[0]), [stockMovements]);
  const totals = useMemo(() => godownTotals(stock), [stock]);
  const byGodown = useMemo(() => {
    const map = new Map<string, typeof stock>();
    for (const r of stock) { const arr = map.get(r.godownId) || []; arr.push(r); map.set(r.godownId, arr); }
    return [...map.entries()];
  }, [stock]);
  // ECR-20: on-hand quantity per godown (for capacity utilisation).
  const usedQtyByGodown = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of stock) m[r.godownId] = (m[r.godownId] || 0) + r.qty;
    return m;
  }, [stock]);

  // ECR-20: inter-godown transfer dialog.
  const [txOpen, setTxOpen] = useState(false);
  const [tx, setTx] = useState({ itemId: '', from: '', to: '', qty: '' });
  const txAvailable = useMemo(
    () => stock.filter(r => r.itemId === tx.itemId && r.godownId === tx.from).reduce((s, r) => s + r.qty, 0),
    [stock, tx.itemId, tx.from],
  );
  const openTransfer = () => { setTx({ itemId: stockItems[0]?.id || '', from: '', to: '', qty: '' }); setTxOpen(true); };
  const submitTransfer = () => {
    const qty = Number(tx.qty);
    if (transferStock({ itemId: tx.itemId, fromGodownId: tx.from, toGodownId: tx.to, qty })) setTxOpen(false);
  };

  // ECR-20: storage-loss vs norm — items exceeding the society's permitted godown loss %.
  const normPct = society.storageLossNormPct ?? 0;
  const overNorm = useMemo(
    () => normPct > 0
      ? computeStorageLoss(stockMovements as unknown as Parameters<typeof computeStorageLoss>[0], normPct).filter(r => !r.withinNorm).sort((a, b) => b.excessPct - a.excessPct)
      : [],
    [stockMovements, normPct],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Warehouse className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{hi ? 'गोदाम' : 'Godowns'}</h1>
            <p className="text-sm text-muted-foreground">{hi ? 'गोदाम-वार स्टॉक (Header में सक्रिय गोदाम चुनें)' : 'Godown-wise stock (pick the active godown in the Header)'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stockItems.length > 0 && godowns.length > 0 && (
            <Button variant="outline" onClick={openTransfer} className="gap-2"><ArrowLeftRight className="h-4 w-4" />{hi ? 'स्थानांतरण' : 'Transfer'}</Button>
          )}
          {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />{hi ? 'नया गोदाम' : 'New Godown'}</Button>}
        </div>
      </div>

      {/* Godown master */}
      {godowns.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {hi ? 'कोई गोदाम नहीं। पहला गोदाम बनाएँ — फिर Header में उसे चुनकर खरीद/बिक्री उसी में दर्ज होगी।' : 'No godowns yet. Create one, then select it in the Header so purchases/sales are stamped to it.'}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{hi ? 'नाम' : 'Name'}</TableHead><TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
              <TableHead>{hi ? 'शाखा' : 'Branch'}</TableHead><TableHead className="text-right">{hi ? 'क्षमता (MT)' : 'Capacity (MT)'}</TableHead><TableHead className="text-right">{hi ? 'उपयोग' : 'Utilisation'}</TableHead><TableHead className="text-right">{hi ? 'स्टॉक मूल्य' : 'Stock Value'}</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {godowns.map(g => {
                const util = capacityUtilisation(usedQtyByGodown[g.id] || 0, g.capacityMT);
                return (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.code || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{branches.find(b => b.id === g.branchId)?.name || '—'}</TableCell>
                  <TableCell className="text-right text-sm">{util.capacityMT ?? '—'}</TableCell>
                  <TableCell className={`text-right text-sm ${util.overCapacity ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    {util.utilisationPct == null ? '—' : `${util.utilisationPct}%${util.overCapacity ? (hi ? ' (क्षमता से अधिक)' : ' (over)') : ''}`}
                  </TableCell>
                  <TableCell className="text-right">{fmt(totals[g.id] || 0)}</TableCell>
                  <TableCell>{isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(g)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(g)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {/* Godown-wise stock report */}
      {stock.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-primary" />{hi ? 'गोदाम-वार स्टॉक' : 'Godown-wise Stock'}</h2>
          {byGodown.map(([godownId, rows]) => (
            <Card key={godownId}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between">
                <span>{nameOfGodown(godownId)}</span>
                <span className="text-sm font-normal text-muted-foreground">{fmt(totals[godownId] || 0)}</span>
              </CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                    <TableHead className="text-right">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                    <TableHead className="text-right">{hi ? 'मूल्य' : 'Value'}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.itemId}>
                        <TableCell>{nameOfItem(r.itemId)}</TableCell>
                        <TableCell className="text-right">{r.qty}</TableCell>
                        <TableCell className="text-right">{fmt(r.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ECR-20: Stack card (bin card) — per-item-per-godown running-balance ledger */}
      {stockItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />{hi ? 'स्टॉक कार्ड (बिन कार्ड)' : 'Stack Card (Bin Card)'}</h2>
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs">{hi ? 'वस्तु' : 'Item'}</Label>
                  <select value={effItem} onChange={e => setScItem(e.target.value)} className="w-56 h-9 rounded-md border bg-background px-2 text-sm mt-1">
                    {stockItems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">{hi ? 'गोदाम' : 'Godown'}</Label>
                  <select value={effGodown} onChange={e => setScGodown(e.target.value)} className="w-56 h-9 rounded-md border bg-background px-2 text-sm mt-1">
                    {godowns.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    <option value={UNASSIGNED_GODOWN}>{hi ? 'बिना गोदाम' : 'Unassigned'}</option>
                  </select>
                </div>
              </div>
              {stackCard.length === 0 ? (
                <p className="text-sm text-muted-foreground">{hi ? 'इस वस्तु/गोदाम के लिए कोई हलचल नहीं।' : 'No movements for this item / godown.'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{hi ? 'तारीख' : 'Date'}</TableHead>
                      <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                      <TableHead>{hi ? 'संदर्भ' : 'Ref'}</TableHead>
                      <TableHead className="text-right">{hi ? 'आवक' : 'In'}</TableHead>
                      <TableHead className="text-right">{hi ? 'जावक' : 'Out'}</TableHead>
                      <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                      <TableHead className="text-right">{hi ? 'दस्तावेज़' : 'Doc'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {stackCard.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{e.date || '—'}</TableCell>
                          <TableCell className="text-sm">{typeLabel(e.type)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.referenceNo || '—'}</TableCell>
                          <TableCell className="text-right text-emerald-600">{e.inQty || ''}</TableCell>
                          <TableCell className="text-right text-red-500">{e.outQty || ''}</TableCell>
                          <TableCell className={`text-right font-medium ${e.balance < 0 ? 'text-red-600' : ''}`}>{e.balance}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title={e.inQty > 0 ? (hi ? 'गोदाम रसीद (WHR)' : 'Warehouse Receipt') : (hi ? 'निकासी पर्ची (Gate Pass)' : 'Gate Pass')} onClick={() => printWarehouseDoc(e)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ECR-20: storage-loss vs norm */}
      {normPct > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Warehouse className="h-5 w-5 text-primary" />{hi ? `भंडारण हानि (norm ${normPct}%)` : `Storage Loss (norm ${normPct}%)`}</h2>
          {overNorm.length === 0 ? (
            <Card><CardContent className="pt-4 text-sm text-muted-foreground">{hi ? 'सभी वस्तुएँ norm के भीतर हैं।' : 'All items are within the norm.'}</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                  <TableHead className="text-right">{hi ? 'आवक' : 'Inward'}</TableHead>
                  <TableHead className="text-right">{hi ? 'हानि' : 'Loss'}</TableHead>
                  <TableHead className="text-right">{hi ? 'हानि %' : 'Loss %'}</TableHead>
                  <TableHead className="text-right">{hi ? 'norm से अधिक' : 'Over norm'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {overNorm.map(r => (
                    <TableRow key={r.itemId}>
                      <TableCell>{nameOfItem(r.itemId)}</TableCell>
                      <TableCell className="text-right">{r.inwardQty}</TableCell>
                      <TableCell className="text-right">{r.lossQty}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{r.actualLossPct}%</TableCell>
                      <TableCell className="text-right text-red-600">+{r.excessPct}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* ECR-20: inter-godown transfer dialog */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" />{hi ? 'गोदाम स्थानांतरण' : 'Inter-godown Transfer'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{hi ? 'वस्तु' : 'Item'}</Label>
              <select value={tx.itemId} onChange={e => setTx(p => ({ ...p, itemId: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                {stockItems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{hi ? 'से (स्रोत)' : 'From'}</Label>
                <select value={tx.from} onChange={e => setTx(p => ({ ...p, from: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">—</option>
                  {godowns.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  <option value={UNASSIGNED_GODOWN}>{hi ? 'बिना गोदाम' : 'Unassigned'}</option>
                </select>
              </div>
              <div><Label>{hi ? 'को (गंतव्य)' : 'To'}</Label>
                <select value={tx.to} onChange={e => setTx(p => ({ ...p, to: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">—</option>
                  {godowns.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  <option value={UNASSIGNED_GODOWN}>{hi ? 'बिना गोदाम' : 'Unassigned'}</option>
                </select>
              </div>
            </div>
            <div><Label>{hi ? 'मात्रा' : 'Quantity'}</Label>
              <Input type="number" min="0" value={tx.qty} onChange={e => setTx(p => ({ ...p, qty: e.target.value }))} />
              {tx.itemId && tx.from && <p className="text-xs text-muted-foreground mt-1">{hi ? 'स्रोत में उपलब्ध' : 'Available at source'}: <span className={txAvailable < Number(tx.qty || 0) ? 'text-red-600 font-medium' : ''}>{txAvailable}</span></p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTxOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={submitTransfer}>{hi ? 'स्थानांतरित करें' : 'Transfer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? (hi ? 'गोदाम संपादित करें' : 'Edit Godown') : (hi ? 'नया गोदाम' : 'New Godown')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{hi ? 'नाम' : 'Name'} *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{hi ? 'कोड' : 'Code'}</Label><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
              <div><Label>{hi ? 'शाखा' : 'Branch'}</Label>
                <select value={form.branchId} onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">—</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{hi ? 'क्षमता (MT)' : 'Capacity (MT)'}</Label><Input type="number" min="0" value={form.capacityMT} onChange={e => setForm(p => ({ ...p, capacityMT: e.target.value }))} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
              <div><Label>{hi ? 'पता' : 'Address'}</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={save}>{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Godowns;
