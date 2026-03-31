import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Truck, Copy, CheckCircle2, Hash } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

interface EWayEntry {
  id: string;
  type: 'sale' | 'purchase';
  docNo: string;
  date: string;
  partyName: string;
  partyGst?: string;
  items: Array<{ name: string; hsn: string; qty: number; unit: string; taxable: number; gstRate: number }>;
  totalTaxable: number;
  totalGst: number;
  grandTotal: number;
  transportMode: string;
  vehicleNo: string;
  distance: number;
  ewbNo: string;
}

const transportModes = ['Road', 'Rail', 'Air', 'Ship'];

export default function EWayBill() {
  const { sales, purchases, stockItems, society } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const societyId = user?.societyId || 'SOC001';

  const [savedBills, setSavedBills] = useState<EWayEntry[]>([]);
  const [mode, setMode] = useState<'list' | 'generate'>('list');
  const [ewbDialog, setEwbDialog] = useState<{ open: boolean; billId: string; ewbNo: string }>({ open: false, billId: '', ewbNo: '' });
  const [sourceType, setSourceType] = useState<'sale' | 'purchase'>('sale');
  const [selectedDoc, setSelectedDoc] = useState('');
  const [transportMode, setTransportMode] = useState('Road');
  const [vehicleNo, setVehicleNo] = useState('');
  const [distance, setDistance] = useState('');
  const [generatedJson, setGeneratedJson] = useState<string>('');

  // Load from Supabase
  useEffect(() => {
    if (!societyId) return;
    supabase
      .from('eway_bills')
      .select('*')
      .eq('society_id', societyId)
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('EWayBill load error:', error.message); return; }
        const parsed = (data || []).map((b: any) => ({
          ...b,
          items: Array.isArray(b.items) ? b.items : [],
        })) as EWayEntry[];
        setSavedBills(parsed);
      });
  }, [societyId]);

  const eligibleSales = useMemo(() =>
    sales.filter(s => !(s as any).isDeleted && s.grandTotal >= 50000),
    [sales]);

  const eligiblePurchases = useMemo(() =>
    purchases.filter(p => !(p as any).isDeleted && p.grandTotal >= 50000),
    [purchases]);

  const currentList = sourceType === 'sale' ? eligibleSales : eligiblePurchases;

  const handleGenerate = async () => {
    const doc = sourceType === 'sale'
      ? sales.find(s => s.id === selectedDoc)
      : purchases.find(p => p.id === selectedDoc);

    if (!doc) return;

    const isSale = sourceType === 'sale';
    const s = doc as any;

    const itemList = (s.items || []).map((item: any) => {
      const stockItem = stockItems.find(si => si.id === item.itemId);
      return {
        name: item.itemName,
        hsn: stockItem?.hsnCode || stockItem?.sacCode || '9999',
        qty: item.qty,
        unit: item.unit,
        taxable: item.amount,
        gstRate: s.cgstPct * 2 || s.igstPct || 0,
      };
    });

    const payload = {
      version: '1.0.1',
      billLists: [{
        fromGstin: society.gstNo || 'GSTIN_NOT_SET',
        fromTrdName: society.name,
        fromAddr1: society.address || '',
        fromPinCode: society.pincode || '000000',
        fromStateCode: society.stateCode || '09',
        toGstin: isSale ? (s.customerGst || 'URP') : (s.supplierGst || 'URP'),
        toTrdName: isSale ? s.customerName : s.supplierName,
        toAddr1: '',
        toPinCode: '000000',
        toStateCode: society.stateCode || '09',
        transactionType: isSale ? 1 : 2,
        supplyType: isSale ? 'O' : 'I',
        subSupplyType: 1,
        docType: 'INV',
        docNo: isSale ? s.saleNo : s.purchaseNo,
        docDate: s.date,
        totalValue: s.totalAmount,
        cgstValue: s.cgstAmount || 0,
        sgstValue: s.sgstAmount || 0,
        igstValue: s.igstAmount || 0,
        cessValue: 0,
        totInvValue: s.grandTotal,
        transMode: transportModes.indexOf(transportMode) + 1,
        transDistance: parseInt(distance) || 0,
        vehicleNo: vehicleNo.toUpperCase(),
        vehicleType: 'R',
        itemList,
      }],
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    setGeneratedJson(jsonStr);

    const entry: EWayEntry & { society_id: string } = {
      id: `ewb_${Date.now()}`,
      type: sourceType,
      docNo: isSale ? s.saleNo : s.purchaseNo,
      date: s.date,
      partyName: isSale ? s.customerName : s.supplierName,
      items: itemList,
      totalTaxable: s.netAmount,
      totalGst: s.taxAmount,
      grandTotal: s.grandTotal,
      transportMode,
      vehicleNo: vehicleNo.toUpperCase(),
      distance: parseInt(distance) || 0,
      ewbNo: '',
      society_id: societyId,
    };

    const { error } = await supabase.from('eway_bills').insert(entry);
    if (error) {
      console.error('EWayBill save error:', error.message);
    } else {
      setSavedBills(prev => [entry, ...prev]);
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([generatedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eway-bill-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedJson);
    toast({ title: hi ? 'JSON कॉपी हुआ' : 'JSON copied to clipboard' });
  };

  const handleSaveEwbNo = async () => {
    const { billId, ewbNo } = ewbDialog;
    if (!ewbNo.trim()) return;
    const { error } = await supabase.from('eway_bills').update({ ewbNo: ewbNo.trim() }).eq('id', billId);
    if (error) {
      toast({ title: hi ? 'त्रुटि हुई' : 'Error saving EWB No', variant: 'destructive' });
      return;
    }
    setSavedBills(prev => prev.map(b => b.id === billId ? { ...b, ewbNo: ewbNo.trim() } : b));
    toast({ title: hi ? 'EWB नंबर सहेजा गया' : 'EWB No saved' });
    setEwbDialog({ open: false, billId: '', ewbNo: '' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'e-Way Bill' : 'e-Way Bill'}</h1>
          <p className="text-muted-foreground text-sm">
            {hi ? 'NIC पोर्टल के लिए JSON पेलोड बनाएं (₹50,000+ के लेनदेन)' : 'Generate JSON payload for NIC portal (transactions ≥ ₹50,000)'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={mode === 'list' ? 'default' : 'outline'} onClick={() => setMode('list')}>
            {hi ? 'बिल सूची' : 'Bill List'}
          </Button>
          <Button variant={mode === 'generate' ? 'default' : 'outline'} onClick={() => { setMode('generate'); setGeneratedJson(''); }}>
            <Truck className="h-4 w-4 mr-2" />{hi ? 'नया बनाएं' : 'Generate New'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'पात्र बिक्री' : 'Eligible Sales'}</p>
          <p className="font-bold text-lg">{eligibleSales.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'पात्र खरीद' : 'Eligible Purchases'}</p>
          <p className="font-bold text-lg">{eligiblePurchases.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'बने हुए JSON' : 'Generated'}</p>
          <p className="font-bold text-lg">{savedBills.length}</p>
        </CardContent></Card>
      </div>

      {mode === 'generate' && (
        <Card>
          <CardHeader><CardTitle className="text-base">{hi ? 'e-Way Bill JSON बनाएं' : 'Generate e-Way Bill JSON'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{hi ? 'प्रकार' : 'Document Type'}</Label>
                <Select value={sourceType} onValueChange={v => { setSourceType(v as any); setSelectedDoc(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">{hi ? 'बिक्री' : 'Sale'}</SelectItem>
                    <SelectItem value="purchase">{hi ? 'खरीद' : 'Purchase'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{hi ? 'दस्तावेज़ चुनें' : 'Select Document'}</Label>
                <Select value={selectedDoc} onValueChange={setSelectedDoc}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'चुनें...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    {currentList.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {sourceType === 'sale' ? d.saleNo : d.purchaseNo} — {sourceType === 'sale' ? d.customerName : d.supplierName} — {fmt(d.grandTotal)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{hi ? 'परिवहन माध्यम' : 'Transport Mode'}</Label>
                <Select value={transportMode} onValueChange={setTransportMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {transportModes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{hi ? 'वाहन संख्या' : 'Vehicle Number'}</Label>
                <Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="UP32AB1234" />
              </div>
              <div>
                <Label>{hi ? 'दूरी (km)' : 'Distance (km)'}</Label>
                <Input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="100" />
              </div>
            </div>

            <Button onClick={handleGenerate} disabled={!selectedDoc}>
              {hi ? 'JSON बनाएं' : 'Generate JSON'}
            </Button>

            {generatedJson && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{hi ? 'JSON तैयार है' : 'JSON ready'}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      <Copy className="h-4 w-4 mr-1" />{hi ? 'कॉपी' : 'Copy'}
                    </Button>
                    <Button size="sm" onClick={handleDownloadJson}>
                      <Download className="h-4 w-4 mr-1" />{hi ? 'डाउनलोड' : 'Download'}
                    </Button>
                  </div>
                </div>
                <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto max-h-64 font-mono">
                  {generatedJson}
                </pre>
                <p className="text-xs text-muted-foreground">
                  {hi ? '* इस JSON को NIC e-Way Bill पोर्टल पर अपलोड करें: ewaybillgst.gov.in' : '* Upload this JSON to NIC e-Way Bill portal: ewaybillgst.gov.in'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'list' && (
        <Card>
          <CardHeader><CardTitle className="text-base">{hi ? 'बनाए गए e-Way Bills' : 'Generated e-Way Bills'}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead>{hi ? 'दस्तावेज़' : 'Document'}</TableHead>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'पार्टी' : 'Party'}</TableHead>
                  <TableHead className="text-right">{hi ? 'कुल' : 'Total'}</TableHead>
                  <TableHead>{hi ? 'वाहन' : 'Vehicle'}</TableHead>
                  <TableHead>{hi ? 'EWB नंबर' : 'EWB No.'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {hi ? 'कोई e-Way Bill नहीं बनाया गया' : 'No e-Way Bills generated yet'}
                    </TableCell>
                  </TableRow>
                ) : savedBills.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Badge variant={b.type === 'sale' ? 'default' : 'secondary'} className="text-xs">
                        {b.type === 'sale' ? (hi ? 'बिक्री' : 'Sale') : (hi ? 'खरीद' : 'Purchase')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{b.docNo}</TableCell>
                    <TableCell>{b.date}</TableCell>
                    <TableCell>{b.partyName}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(b.grandTotal)}</TableCell>
                    <TableCell className="font-mono text-xs">{b.vehicleNo || '—'}</TableCell>
                    <TableCell>
                      {b.ewbNo ? (
                        <span className="flex items-center gap-1 text-green-700 font-mono text-sm font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />{b.ewbNo}
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => setEwbDialog({ open: true, billId: b.id, ewbNo: '' })}>
                          <Hash className="h-3 w-3" />{hi ? 'दर्ज करें' : 'Enter'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* EWB No Dialog */}
      <Dialog open={ewbDialog.open} onOpenChange={o => setEwbDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{hi ? 'EWB नंबर दर्ज करें' : 'Enter EWB Number'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>{hi ? 'e-Way Bill नंबर' : 'e-Way Bill No.'}</Label>
              <Input
                value={ewbDialog.ewbNo}
                onChange={e => setEwbDialog(d => ({ ...d, ewbNo: e.target.value }))}
                placeholder="e.g. 331200012345678"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEwbDialog({ open: false, billId: '', ewbNo: '' })} className="flex-1">
                {hi ? 'रद्द करें' : 'Cancel'}
              </Button>
              <Button onClick={handleSaveEwbNo} disabled={!ewbDialog.ewbNo.trim()} className="flex-1">
                {hi ? 'सहेजें' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
